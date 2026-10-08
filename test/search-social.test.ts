/* Search, targets, reactions, polls and the blog additions against a fake HTTP client: verb, path, query, body. */
import { describe, expect, test } from "bun:test";
import { API, Auth, AuthData, ABCAuthDataResolver, Post, SubscriptionLevel, type HTTPClient } from "../src";
import { SearchResource } from "../src/resources/search";
import { TargetsResource } from "../src/resources/targets";
import { Target } from "../src/types/target";
import { UnsubscribeAnswer, VotersResponse, Poll, PollOption } from "../src/types/poll";
import { BlogProfile } from "../src/types/blog";

class MemoryResolver extends ABCAuthDataResolver {
    loadAuthData(): AuthData {
        return (this.authData = new AuthData());
    }
    saveAuthData(): void {}
}

function fakeApi(body: unknown) {
    const calls: { method: string; url: URL; body: string | null }[] = [];
    const http: HTTPClient = {
        async request(url, init) {
            calls.push({ method: init.method ?? "GET", url: new URL(url), body: typeof init.body === "string" ? init.body : null });
            return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
        },
    };
    const api = new API(http, new Auth(new MemoryResolver()));
    return { api, calls, search: new SearchResource(api), targets: new TargetsResource(api) };
}

const q = (u: URL) => Object.fromEntries(u.searchParams);
const ODD = [null, {}, { data: null }, { data: {} }, { data: { searchPosts: {}, searchTags: "x", blogs: 1 } }];

describe("search", () => {
    const POSTS = {
        data: {
            searchPosts: [{ post: { id: "p1", title: "t" }, blog: { blogUrl: "b" }, rank: 0.5, headline: { title: "<em>t</em>" } }],
            blogs: [{ blogUrl: "b" }],
        },
        extra: { isLast: true, offset: "o" },
    };

    test("feed search: limit defaults to 10, filters are renamed, arrays comma-joined", async () => {
        const { search, calls } = fakeApi(POSTS);
        const r = await search.postsInFeed("cats", { onlyBought: true, from: 5, to: 9, tagIds: [1, 2] });
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/search/feed/post/");
        expect(q(calls[0].url)).toEqual({
            search_query: "cats", limit: "10", only_allowed: "false", only_bought: "true", from_ts: "5", to_ts: "9", tags_ids: "1,2",
        });
        expect(r.hits[0].post).toBeInstanceOf(Post);
        expect(r.hits[0].blog).toBeInstanceOf(BlogProfile);
        expect(r.hits[0].headline?.title).toBe("<em>t</em>");
        expect(r.blogs[0]).toBeInstanceOf(BlogProfile);
        expect(r.extra).toEqual({ isLast: true, offset: "o" });
    });

    test("blog post search maps attachment filters to the web client's names", async () => {
        const { search, calls } = fakeApi(POSTS);
        await search.postsInBlog("some blog", "x", {
            limit: 3, offset: "z", onlyAllowed: true, subscriptionLevelIds: [7], hasImage: true, hasAudioFile: false,
            hasAudio: true, hasVideoFile: true, hasVideo: false, hasFile: true, from: 1, to: 2,
        });
        expect(calls[0].url.pathname).toBe("/v1/search/blog/post/");
        expect(q(calls[0].url)).toEqual({
            blog_url: "some blog", search_query: "x", limit: "3", offset: "z", only_allowed: "true", subscription_level: "7",
            has_image: "true", has_audio_file: "false", has_audio: "true", has_ok_video: "true", has_video: "false",
            has_file: "true", from_ts: "1", to_ts: "2",
        });
    });

    test("blog suggestions and feed tags", async () => {
        const sug = fakeApi({ data: { searchBlogs: [{ rank: 1, blog: { blogUrl: "b" } }] }, extra: {} });
        const s = await sug.search.blogSuggest("a", { limit: 4 });
        expect(sug.calls[0].url.pathname).toBe("/v1/search/blog/suggest/");
        expect(q(sug.calls[0].url)).toEqual({ search_query: "a", limit: "4" });
        expect(s.data.searchBlogs[0].blog).toBeInstanceOf(BlogProfile);

        const tags = fakeApi({ data: { searchTags: [{ tag: { id: 3, title: "t" }, rank: 1 }] }, extra: { isLast: true } });
        const t = await tags.search.feedTags("t");
        expect(tags.calls[0].url.pathname).toBe("/v1/search/feed/tag/");
        expect(q(tags.calls[0].url)).toEqual({ search_query: "t", limit: "10" });
        expect(t.tags[0].tag.id).toBe(3);
        expect(t.extra?.isLast).toBe(true);
    });

    test("odd bodies give empty lists", async () => {
        for (const body of ODD) {
            const { search } = fakeApi(body);
            const r = await search.postsInFeed("a");
            expect(r.hits).toEqual([]);
            expect(r.blogs).toEqual([]);
            expect((await search.feedTags("a")).tags).toEqual([]);
        }
        const { search } = fakeApi({ data: { searchPosts: [null, {}] } });
        expect((await search.postsInBlog("b", "a")).hits).toHaveLength(1);
    });
});

describe("targets", () => {
    const T = { id: 4, type: "money", targetSum: 100, currencyTargetSums: { RUB: 100 }, finishTime: null };

    test("list and get", async () => {
        const { targets, calls } = fakeApi({ data: [T, null] });
        const list = await targets.list("my blog", { type: "money", showDeleted: true });
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/target/my%20blog/");
        expect(q(calls[0].url)).toEqual({ type: "money", show_deleted: "true" });
        expect(list.data).toHaveLength(1);
        expect(list.data[0]).toBeInstanceOf(Target);
        expect(list.data[0].currencyTargetSums?.RUB).toBe(100);

        const one = fakeApi(T);
        const t = await one.targets.get(4, { currency: "USD" });
        expect(one.calls[0].url.pathname).toBe("/v1/target/4");
        expect(q(one.calls[0].url)).toEqual({ currency: "USD" });
        expect(t.id).toBe(4);
    });

    test("odd bodies", async () => {
        for (const body of [null, {}, { data: {} }]) {
            expect((await fakeApi(body).targets.list("b")).data).toEqual([]);
        }
        expect(await fakeApi(null).targets.get(1)).toBeInstanceOf(Target);
    });

    test("writes send the web client's bodies", async () => {
        const { targets, calls } = fakeApi(T);
        await targets.createMoney("b", "new", 500);
        await targets.createSubscribers("b", "subs", 20);
        await targets.edit(4, { description: "d", targetSum: 7 });
        await targets.remove(4);
        expect(calls.map((c) => [c.method, c.url.pathname])).toEqual([
            ["POST", "/v1/target/money"],
            ["POST", "/v1/target/subscribers"],
            ["PUT", "/v1/target/4"],
            ["DELETE", "/v1/target/4"],
        ]);
        expect(calls[0].body).toBe("blog_url=b&description=new&target_sum=500");
        expect(calls[1].body).toBe("blog_url=b&description=subs&target_sum=20");
        expect(calls[2].body).toBe("target_id=4&description=d&target_sum=7");
        expect(calls[3].body).toBeNull();
    });
});

describe("reactions", () => {
    test("comments go through the reaction endpoint; a like is the like reaction", async () => {
        const { api, calls } = fakeApi({});
        await api.comments.react("b", "p", 5, "fire", "post");
        await api.comments.like("b", "p", 5);
        await api.comments.removeReaction("b", "p", 5);
        expect(await api.comments.unlike("b", "p", 5)).toBe(true);
        const path = "/v1/blog/b/post/p/comment/5/reaction";
        expect(calls.map((c) => [c.method, c.url.pathname])).toEqual([
            ["POST", path], ["POST", path], ["DELETE", path], ["DELETE", path],
        ]);
        expect(q(calls[0].url)).toEqual({ from_page: "post" });
        expect(calls[0].body).toBe("reaction=fire");
        expect(calls[1].body).toBe("reaction=like");
        expect(calls[2].body).toBeNull();
    });

    test("posts: reactions on /reaction, likes on /like as the web client does", async () => {
        const { api, calls } = fakeApi({});
        await api.social.reactToPost("b", "p", "laugh");
        await api.social.likePost("b", "p", "feed");
        await api.social.removePostReaction("b", "p", "feed");
        expect(await api.social.unlikePost("b", "p")).toBe(true);
        const reaction = "/v1/blog/b/post/p/reaction";
        const like = "/v1/blog/b/post/p/like";
        expect(calls.map((c) => [c.method, c.url.pathname])).toEqual([
            ["POST", reaction], ["POST", like], ["DELETE", reaction], ["DELETE", like],
        ]);
        expect(calls[0].body).toBe("reaction=laugh");
        expect(q(calls[1].url)).toEqual({ from_page: "feed" });
        expect(q(calls[2].url)).toEqual({ from_page: "feed" });
    });
});

describe("polls", () => {
    test("voting posts the comma-joined option ids to /poll/:id/vote, the blog name is ignored", async () => {
        const { api, calls } = fakeApi({});
        await api.social.voteOption("ignored", 9, 31);
        await api.social.vote(9, [31, 32], { other: "x y", isAnonymous: true });
        expect(await api.social.removeVote("ignored", 9, 31)).toBe(true);
        expect(calls.map((c) => [c.method, c.url.pathname])).toEqual([
            ["POST", "/v1/poll/9/vote"], ["POST", "/v1/poll/9/vote"], ["DELETE", "/v1/poll/9/vote"],
        ]);
        expect(calls[0].body).toBe("answer=31");
        expect(calls[1].body).toBe("answer=31%2C32&other=x+y&is_anonymous=true");
        expect(calls[2].body).toBeNull();
    });

    test("an empty vote is refused before any request", async () => {
        const { api, calls } = fakeApi({});
        await expect(api.social.vote(9, [])).rejects.toThrow(TypeError);
        expect(calls).toHaveLength(0);
    });

    test("blog.poll and blog.pollVoters", async () => {
        const poll = fakeApi({ id: 9, title: ["t"], options: [{ id: 1, text: "a", voters: { data: { voters: [{ id: 2, name: "n" }] } } }] });
        const p = await poll.api.blog.poll("b", 9, { votersLimit: 3 });
        expect(poll.calls[0].url.pathname).toBe("/v1/blog/b/poll/9");
        expect(q(poll.calls[0].url)).toEqual({ voters_limit: "3" });
        expect(p).toBeInstanceOf(Poll);
        expect(p.options?.[0]).toBeInstanceOf(PollOption);
        expect(p.options?.[0].voters?.data?.voters[0].name).toBe("n");
        for (const body of [null, {}]) expect((await fakeApi(body).api.blog.poll("b", 1)).options).toBeUndefined();

        const voters = fakeApi({ data: { voters: [{ id: 2 }] }, extra: { isLast: true } });
        const v = await voters.api.blog.pollVoters("b", 9, { option: 1, limit: 5, offset: 10 });
        expect(voters.calls[0].url.pathname).toBe("/v1/blog/b/poll/9/vote/");
        expect(q(voters.calls[0].url)).toEqual({ option: "1", limit: "5", offset: "10" });
        expect(v).toBeInstanceOf(VotersResponse);
        expect(v.data?.voters).toHaveLength(1);
        for (const body of [null, {}, { data: {} }, { data: { voters: null } }]) {
            const r = await fakeApi(body).api.blog.pollVoters("b", 1);
            expect(r.data === undefined || r.data.voters.length === 0).toBe(true);
        }
    });
});

describe("blog additions", () => {
    test("subscriptionLevel", async () => {
        const { api, calls } = fakeApi({ id: 3, price: 100, count: { content: { post: 2 } } });
        const l = await api.blog.subscriptionLevel("b", 3, { withContentCounters: true });
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/blog/b/subscription/level/3");
        expect(q(calls[0].url)).toEqual({ with_content_counters: "true" });
        expect(l).toBeInstanceOf(SubscriptionLevel);
        expect((l.count as any)?.content.post).toBe(2);
        expect(await fakeApi(null).api.blog.subscriptionLevel("b", 1)).toBeInstanceOf(SubscriptionLevel);
    });

    test("unsubscribeReasons", async () => {
        const body = { data: { unsubscribeAnswers: [{ levelId: 1, answerIds: [], user: { id: 2, name: "n" }, isAnonimous: false }] }, extra: { total: 1 } };
        const { api, calls } = fakeApi(body);
        const r = await api.blog.unsubscribeReasons("b", { limit: 5, levelIds: [1, 2], from: 3 });
        expect(calls[0].url.pathname).toBe("/v1/blog/b/unsubscribe_reasons/");
        expect(q(calls[0].url)).toEqual({ limit: "5", level_ids: "1,2", from: "3" });
        expect(r.answers[0]).toBeInstanceOf(UnsubscribeAnswer);
        expect(r.answers[0].user?.name).toBe("n");
        expect(r.extra?.total).toBe(1);
        for (const odd of ODD) expect((await fakeApi(odd).api.blog.unsubscribeReasons("b")).answers).toEqual([]);
    });
});

describe("review guards", () => {
    test("votes with an empty id are refused before any request", async () => {
        const { api, calls } = fakeApi({});
        await expect(api.social.vote(9, [""])).rejects.toThrow(TypeError);
        await expect(api.social.vote(9, [undefined as any])).rejects.toThrow(TypeError);
        await expect(api.social.vote(9, [1, null as any])).rejects.toThrow(TypeError);
        await expect(api.social.voteOption("b", 9, "")).rejects.toThrow(TypeError);
        expect(calls).toHaveLength(0);
    });

    test("targets.edit refuses a partial change at runtime", async () => {
        const { api, calls } = fakeApi({});
        await expect(api.targets.edit(4, { description: "d" } as any)).rejects.toThrow(TypeError);
        await expect(api.targets.edit(4, { targetSum: 7 } as any)).rejects.toThrow(TypeError);
        expect(calls).toHaveLength(0);
    });

    test("empty list filters are left out", async () => {
        const { api, calls } = fakeApi({});
        await api.search.postsInFeed("x", { tagIds: [] });
        await api.search.postsInBlog("b", "x", { subscriptionLevelIds: [] });
        await api.blog.unsubscribeReasons("b", { levelIds: [], answers: [] });
        expect(calls.map((c) => [...c.url.searchParams.keys()].filter((k) => ["tags_ids", "subscription_level", "level_ids", "answers"].includes(k))))
            .toEqual([[], [], []]);
    });

    test("poll options skip null items", async () => {
        const p = await fakeApi({ id: 9, options: [null, { id: 1, text: "a" }] }).api.blog.poll("b", 9);
        expect(p.options).toHaveLength(1);
    });
});
