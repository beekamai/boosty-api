/* Resources against a fake HTTP client: what goes on the wire and how responses are wrapped. */
import { describe, expect, test } from "bun:test";
import { API, Auth, AuthData, ABCAuthDataResolver, BlogProfile, Message, type HTTPClient } from "../src";

/** Anonymous auth kept in memory: the default resolver reads and rewrites ./auth.json. */
class MemoryResolver extends ABCAuthDataResolver {
    loadAuthData(): AuthData {
        return (this.authData = new AuthData());
    }
    saveAuthData(): void {}
}

function fakeApi(body: unknown) {
    const urls: URL[] = [];
    const http: HTTPClient = {
        async request(url) {
            urls.push(new URL(url));
            return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
        },
    };
    return { api: new API(http, new Auth(new MemoryResolver())), urls };
}

describe("resources", () => {
    test("comments.replies asks the comment list for parent_id", async () => {
        const { api, urls } = fakeApi({ data: [], extra: { isLast: true } });
        await api.comments.replies("blog", "post-id", 12510116, { limit: 5 });
        expect(urls[0].pathname).toBe("/v1/blog/blog/post/post-id/comment/");
        expect(urls[0].searchParams.get("parent_id")).toBe("12510116");
        expect(urls[0].searchParams.get("limit")).toBe("5");
    });

    test("media.list unwraps data.mediaPosts", async () => {
        const { api } = fakeApi({ data: { mediaPosts: [{ post: { id: "p" }, media: [{ type: "image" }] }] }, extra: { isLast: true, offset: "x" } });
        const page = await api.media.list("blog", { type: "image" });
        expect(page.data).toHaveLength(1);
        expect(page.data[0].media[0].type).toBe("image");
    });

    test("feed.searchBlogs returns BlogProfile instances", async () => {
        const { api } = fakeApi({ data: { searchBlogs: [{ rank: 1, blog: { blogUrl: "b", owner: { name: "o" } } }] }, extra: { isLast: true } });
        const res = await api.feed.searchBlogs("q");
        expect(res.data.searchBlogs[0].blog).toBeInstanceOf(BlogProfile);
        expect(res.data.searchBlogs[0].blog.blogUrl).toBe("b");
    });

    test("messaging.dialogWithUser wraps the paged messages object", async () => {
        const { api } = fakeApi({ id: 1, messages: { data: [{ id: 7, createdAt: 1 }], extra: { isFirst: true, isLast: true } } });
        const dialog = await api.messaging.dialogWithUser(42);
        expect(dialog.messages?.data[0]).toBeInstanceOf(Message);
        expect(dialog.messages?.extra?.isFirst).toBe(true);
    });

    test("feed.searchBlogs survives odd bodies and keeps sibling fields", async () => {
        for (const body of [null, {}, { data: "x" }, { data: { searchBlogs: {} } }, { data: { searchBlogs: [null, { rank: 1 }] } }]) {
            const { api } = fakeApi(body);
            const res = await api.feed.searchBlogs("q");
            expect(Array.isArray(res.data.searchBlogs)).toBe(true);
        }
        const { api } = fakeApi({ data: { searchBlogs: [], total: 5 } });
        expect((await api.feed.searchBlogs("q")).data).toEqual({ searchBlogs: [], total: 5 } as any);
    });
});
