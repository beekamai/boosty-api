/* Caller-supplied ids must land in the request path as one encoded segment, never as extra path/query/fragment. */
import { describe, expect, test } from "bun:test";
import {
    ABCAuthDataResolver,
    API,
    apiPath,
    Auth,
    AuthData,
    type EditedDeferredAccess,
    type EditedPost,
    type HTTPClient,
    type NewPost,
} from "../src";

/* Keeps tokens in memory so ./auth.json is never read or written. */
class MemoryResolver extends ABCAuthDataResolver {
    loadAuthData(): AuthData {
        this.authData ??= new AuthData({ access_token: "test-token", user_agent: "test" });
        return this.authData;
    }
    saveAuthData(): void {}
}

function setup() {
    const calls: { method: string; url: URL }[] = [];
    const http: HTTPClient = {
        request: async (url, options) => {
            calls.push({ method: options.method ?? "GET", url: new URL(url) });
            return new Response("{}", { status: 200 });
        },
    };
    return { api: new API(http, new Auth(new MemoryResolver())), calls };
}

/* Ids that are encoded into one segment; ids with "/" or "\" are rejected outright (see the last test). */
const HOSTILE = ["a?b=c", "a#b", "%2e%2e", "%2F", "..x", "a b&c"];

/* [name, call with every id = v, path template where {} is the encoded id] */
const CASES: [string, (api: API, v: string) => Promise<unknown>, string][] = [
    ["posts.list", (a, v) => a.posts.list(v), "/v1/blog/{}/post/"],
    ["posts.get", (a, v) => a.posts.get(v, v), "/v1/blog/{}/post/{}"],
    ["posts.create", (a, v) => a.posts.create(v, { title: "t" } as NewPost), "/v1/blog/{}/post/"],
    ["posts.update", (a, v) => a.posts.update(v, v, { title: "t" } as EditedPost), "/v1/blog/{}/post/{}"],
    ["posts.delete", (a, v) => a.posts.delete(v, v), "/v1/blog/{}/post/{}"],
    ["posts.getDeferredAccess", (a, v) => a.posts.getDeferredAccess(v, v), "/v1/blog/{}/post/{}/deferred_access"],
    [
        "posts.updateDeferredAccess",
        (a, v) => a.posts.updateDeferredAccess(v, v, {} as EditedDeferredAccess),
        "/v1/blog/{}/post/{}/deferred_access",
    ],
    ["comments.list", (a, v) => a.comments.list(v, v), "/v1/blog/{}/post/{}/comment/"],
    ["comments.replies", (a, v) => a.comments.replies(v, v, 1), "/v1/blog/{}/post/{}/comment/"],
    ["comments.create", (a, v) => a.comments.create(v, v, []), "/v1/blog/{}/post/{}/comment/"],
    ["comments.like", (a, v) => a.comments.like(v, v, v), "/v1/blog/{}/post/{}/comment/{}/reaction"],
    ["comments.unlike", (a, v) => a.comments.unlike(v, v, v), "/v1/blog/{}/post/{}/comment/{}/reaction"],
    ["blog.profile", (a, v) => a.blog.profile(v), "/v1/blog/{}"],
    ["blog.subscribers", (a, v) => a.blog.subscribers(v), "/v1/blog/{}/subscribers"],
    ["blog.subscriptionLevels", (a, v) => a.blog.subscriptionLevels(v), "/v1/blog/{}/subscription_level/"],
    ["media.list", (a, v) => a.media.list(v), "/v1/blog/{}/media_album/"],
    ["social.likePost", (a, v) => a.social.likePost(v, v), "/v1/blog/{}/post/{}/like"],
    ["social.unlikePost", (a, v) => a.social.unlikePost(v, v), "/v1/blog/{}/post/{}/like"],
    ["social.voteOption", (a, v) => a.social.voteOption(v, v, v), "/v1/poll/{}/vote"],
    ["social.removeVote", (a, v) => a.social.removeVote(v, v, v), "/v1/poll/{}/vote"],
    ["messaging.messages", (a, v) => a.messaging.messages(v), "/v1/dialog/{}/message/"],
    ["messaging.sendMessage", (a, v) => a.messaging.sendMessage(v, []), "/v1/dialog/{}/message"],
];

describe("path segment encoding", () => {
    test("unlike with a traversal id sends nothing instead of deleting another resource", async () => {
        const { api, calls } = setup();
        await expect(api.comments.unlike("blog", "1", "../../../../v1/blog/blog/post/1")).rejects.toThrow(TypeError);
        expect(calls).toHaveLength(0);
    });

    test("a query or fragment inside an id stays in its segment", async () => {
        const { api, calls } = setup();
        await api.comments.unlike("blog", "1", "7?x=1#y");
        expect(calls).toHaveLength(1);
        expect(calls[0]!.method).toBe("DELETE");
        expect(calls[0]!.url.pathname).toBe("/v1/blog/blog/post/1/comment/7%3Fx%3D1%23y/reaction");
    });

    for (const [name, call, template] of CASES) {
        test(`${name} keeps every id inside its own segment`, async () => {
            for (const id of HOSTILE) {
                const { api, calls } = setup();
                await call(api, id);
                expect(calls).toHaveLength(1);
                const { url } = calls[0]!;
                expect(url.pathname).toBe(template.replaceAll("{}", encodeURIComponent(id)));
                expect(url.pathname.split("/").length).toBe(template.split("/").length);
                expect(url.hash).toBe("");
                expect(url.searchParams.has("b")).toBe(false);
            }
        });
    }

    test("apiPath is exported for api.request callers", () => {
        expect(apiPath`/v1/blog/${"a?b"}/post/${42}`).toBe("/v1/blog/a%3Fb/post/42");
        expect(() => apiPath`/v1/blog/${"../x"}`).toThrow(TypeError);
        expect(() => apiPath`/v1/blog/${undefined as any}/post/`).toThrow(TypeError);
        expect(() => apiPath`/v1/blog/${null as any}/post/`).toThrow(TypeError);
    });

    test("numeric ids are accepted as-is", async () => {
        const { api, calls } = setup();
        await api.social.voteOption("blog", 42, 7);
        expect(calls[0]!.url.pathname).toBe("/v1/poll/42/vote");
    });

    test("ordinary ids are not altered", async () => {
        const { api, calls } = setup();
        await api.comments.like("my-blog_1", "a1b2c3d4-0000-4000-8000-000000000000", 123);
        expect(calls[0]!.url.pathname).toBe("/v1/blog/my-blog_1/post/a1b2c3d4-0000-4000-8000-000000000000/comment/123/reaction");
    });

    for (const bad of ["", ".", "..", "x\uD83E", "../../x", "a/b", "..\\x", "a\\b"]) {
        test(`${JSON.stringify(bad)} is rejected before any request is sent`, async () => {
            const { api, calls } = setup();
            await expect(api.comments.unlike("blog", "1", bad)).rejects.toThrow(TypeError);
            await expect(api.posts.delete("blog", bad)).rejects.toThrow(TypeError);
            await expect(api.blog.profile(bad)).rejects.toThrow(TypeError);
            expect(calls).toHaveLength(0);
        });
    }
});
