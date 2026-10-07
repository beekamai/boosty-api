/* Resources against a fake HTTP client: what goes on the wire and how responses are wrapped. */
import { describe, expect, test } from "bun:test";
import { API, Auth, AuthData, ABCAuthDataResolver, BlogProfile, DonationInfo, Message, Notification, SubscriptionLevel, type HTTPClient } from "../src";

/** Anonymous auth kept in memory: the default resolver reads and rewrites ./auth.json. */
class MemoryResolver extends ABCAuthDataResolver {
    loadAuthData(): AuthData {
        return (this.authData = new AuthData());
    }
    saveAuthData(): void {}
}

function fakeApi(body: unknown) {
    const urls: URL[] = [];
    const calls: { method: string; url: URL; body: string | null }[] = [];
    const http: HTTPClient = {
        async request(url, init) {
            urls.push(new URL(url));
            calls.push({ method: init.method ?? "GET", url: new URL(url), body: typeof init.body === "string" ? init.body : null });
            return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
        },
    };
    return { api: new API(http, new Auth(new MemoryResolver())), urls, calls };
}

const FEED = {
    data: {
        notificationStandalone: {
            events: [
                { id: 9, type: "subscriber_new", isRead: false, eventTime: 1, author: { id: 1, name: "a" }, subscriptionLevel: { id: 2, price: 100 } },
                { id: 10, type: "donation_new", isRead: true, eventTime: 2, donation: { id: 3, amount: 50, currencyAmounts: { RUB: 50 } } },
            ],
            count: { total: 1, unread: 1, byEventType: [{ type: "subscriber_new", total: 1, unread: 1 }] },
            updateTime: 5,
        },
    },
};

describe("notifications", () => {
    test("feed comes from the standalone event list and is lifted to the top level", async () => {
        const { api, calls } = fakeApi(FEED);
        const feed = await api.messaging.notifications();
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/notification/standalone/event/");
        expect(feed.events[0]).toBeInstanceOf(Notification);
        expect(feed.events[0].subscriptionLevel).toBeInstanceOf(SubscriptionLevel);
        expect(feed.events[1].donation).toBeInstanceOf(DonationInfo);
        expect(feed.events[1].donation?.amount).toBe(50);
        expect(feed.count?.unread).toBe(1);
        expect(feed.updateTime).toBe(5);
    });

    test("odd bodies give an empty feed", async () => {
        for (const body of [null, {}, { data: { notificationStandalone: { events: {} } } }]) {
            expect((await fakeApi(body).api.messaging.notifications()).events).toEqual([]);
        }
    });

    test("marking read sends the ids comma-joined, like the web client", async () => {
        const { api, calls } = fakeApi(FEED);
        await api.messaging.markNotificationsRead([1, 2]);
        expect(calls[0].method).toBe("PUT");
        expect(calls[0].url.pathname).toBe("/v1/notification/standalone/read/");
        expect(new URLSearchParams(calls[0].body!).get("event_id")).toBe("1,2");
    });

    test("an empty id list never sends a write", async () => {
        for (const call of [(a: API) => a.messaging.deleteNotifications([]), (a: API) => a.messaging.markNotificationsRead([])]) {
            const { api, calls } = fakeApi(FEED);
            await call(api);
            expect(calls.map((c) => c.method)).toEqual(["GET"]);
        }
    });

    test("deleting one notification targets its id", async () => {
        const { api, calls } = fakeApi(null);
        await api.messaging.deleteNotification(9);
        expect(calls[0].method).toBe("DELETE");
        expect(calls[0].url.pathname).toBe("/v1/notification/standalone/event/9");
    });
});

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
