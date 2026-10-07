/* StatsResource against a fake HTTP client: verb, path, query and response wrapping. */
import { describe, expect, spyOn, test } from "bun:test";
import { API, Auth, AuthData, ABCAuthDataResolver, type HTTPClient } from "../src";
import { StatsResource } from "../src/resources/stats";
import { BlogEvent, StatReport } from "../src/types/stats";

class MemoryResolver extends ABCAuthDataResolver {
    loadAuthData(): AuthData {
        return (this.authData = new AuthData());
    }
    saveAuthData(): void {}
}

function fakeStats(body: unknown) {
    const calls: { method: string; url: URL }[] = [];
    const http: HTTPClient = {
        async request(url, init) {
            calls.push({ method: init.method ?? "GET", url: new URL(url) });
            return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
        },
    };
    const api = new API(http, new Auth(new MemoryResolver()));
    return { stats: new StatsResource(api), calls };
}

const ODD_BODIES = [null, {}, { data: null }, { data: {} }];

describe("stats paths and queries", () => {
    test("summary", async () => {
        const { stats, calls } = fakeStats({ balance: 1, followersCount: 2 });
        const s = await stats.summary("blog");
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/blog/stat/blog/current");
        expect(s.followersCount).toBe(2);
    });

    test("metrics sends from and to", async () => {
        const { stats, calls } = fakeStats({ totalMoney: 5 });
        expect((await stats.metrics("blog", 10, 20)).totalMoney).toBe(5);
        expect(calls[0].url.pathname).toBe("/v1/blog/stat/blog/metrics");
        expect(calls[0].url.search).toBe("?from=10&to=20");
    });

    test("charts maps snake_case cursor and keeps only array series", async () => {
        const { stats, calls } = fakeStats({ donations: [{ year: 1, month: 2, day: 3, count: 4 }], other: 1 });
        const c = await stats.charts("blog", { lastTime: 7, limit: 3 });
        expect(calls[0].url.pathname).toBe("/v1/blog/blog/stat/data");
        expect(calls[0].url.search).toBe("?last_time=7&limit=3");
        expect(Object.keys(c.series)).toEqual(["donations"]);
    });

    test("events joins arrays with commas and wraps rows", async () => {
        const { stats, calls } = fakeStats({
            data: [{ eventType: "subscribe", createdAt: 1, user: { id: 1, name: "x" } }],
            extra: { isLast: true, total: 1, offset: "0" },
        });
        const r = await stats.events("blog", { eventTypes: ["subscribe", "recurrent"], userIds: [1, 2], from: 1, to: 2, limit: 5 });
        const q = calls[0].url.searchParams;
        expect(calls[0].url.pathname).toBe("/v1/blog/stat/blog/events");
        expect(q.get("event_types")).toBe("subscribe,recurrent");
        expect(q.get("user_ids")).toBe("1,2");
        expect(q.get("limit")).toBe("5");
        expect(r.events[0]).toBeInstanceOf(BlogEvent);
        expect(r.extra?.isLast).toBe(true);
    });

    test("visits and payment sources send type, period and the default order", async () => {
        const { stats, calls } = fakeStats({ data: { all: { viewCount: 1, viewUniqCount: 1 }, visits: [{ source: "a" }] } });
        const v = await stats.visits("blog", { type: "referer", period: "month", sortBy: "view_count" });
        expect(calls[0].url.pathname).toBe("/v1/blog/stat/blog/visits");
        expect(calls[0].url.search).toBe("?type=referer&period=month&order=gt&sort_by=view_count");
        expect(v.visits).toHaveLength(1);
        await stats.paymentSources("blog", { type: "utm", period: "day", order: "lt" });
        expect(calls[1].url.pathname).toBe("/v1/blog/stat/blog/payments/analytics");
        expect(calls[1].url.search).toBe("?type=utm&period=day&order=lt");
    });

    test("referrals and referral users", async () => {
        const { stats, calls } = fakeStats({ regs: 1, data: { referrals: [{ id: 1 }] } });
        expect((await stats.referrals("blog")).regs).toBe(1);
        expect(calls[0].url.pathname).toBe("/v1/blog/referral/blog/stat/");
        const u = await stats.referralUsers("blog", { limit: 2, offset: 0, onlyBloggers: false });
        expect(calls[1].url.pathname).toBe("/v1/blog/referral/blog/user/");
        expect(calls[1].url.search).toBe("?limit=2&offset=0&only_bloggers=false");
        expect(u.referrals).toHaveLength(1);
    });

    test("searchUsers sends chunk", async () => {
        const { stats, calls } = fakeStats({ data: [{ id: 1 }] });
        expect((await stats.searchUsers("blog", "ab", { limit: 3 })).users).toHaveLength(1);
        expect(calls[0].url.pathname).toBe("/v1/blog/stat/blog/search");
        expect(calls[0].url.search).toBe("?chunk=ab&limit=3");
    });

    test("the request log names the route but not the query values", async () => {
        const log = spyOn(console, "log").mockImplementation(() => {});
        try {
            await fakeStats({ data: [] }).stats.searchUsers("blog", "alice@example.com");
            const lines = log.mock.calls.map((args) => args.join(" "));
            expect(lines.some((l) => l.includes("/v1/blog/stat/blog/search"))).toBe(true);
            expect(lines.some((l) => l.includes("alice"))).toBe(false);
        } finally {
            log.mockRestore();
        }
    });

    test("empty list filters are left out instead of sent as key=", async () => {
        const { stats, calls } = fakeStats({});
        await stats.events("blog", { eventTypes: [], userIds: [] });
        expect(calls[0].url.search).toBe("");
    });

    test("post stat encodes the post id as one segment", async () => {
        const { stats, calls } = fakeStats({ views: 3 });
        const p = await stats.post("blog", "a?b#c");
        expect(calls[0].url.pathname).toBe("/v1/blog/stat/blog/post/a%3Fb%23c");
        expect(p.views).toBe(3);
    });

    test("report and reportInfo", async () => {
        const { stats, calls } = fakeStats({ data: { report: { type: "donations", status: "ok", url: "u" } } });
        const r = await stats.report("blog", "donations", { separator: ";", period: "month", from: 1 });
        expect(calls[0].url.pathname).toBe("/v1/blog/stat/blog/csv/donations");
        expect(calls[0].url.search).toBe("?separator=%3B&from=1&period=month");
        expect(r.report).toBeInstanceOf(StatReport);
        await stats.reportInfo("blog", "holds");
        expect(calls[1].url.pathname).toBe("/v1/blog/stat/blog/csv/holds/info");
        expect(calls[1].url.search).toBe("");
        expect(calls.map((c) => c.method)).toEqual(["GET", "GET"]);
    });

    test("a blog name cannot steer the path", async () => {
        const { stats } = fakeStats({});
        await expect(stats.summary("a/../b")).rejects.toThrow(TypeError);
        await expect(stats.summary("..")).rejects.toThrow(TypeError);
    });
});

describe("stats tolerate odd bodies", () => {
    test("lists fall back to empty arrays", async () => {
        for (const body of ODD_BODIES) {
            const { stats } = fakeStats(body);
            expect((await stats.events("b")).events).toEqual([]);
            expect((await stats.visits("b", { type: "utm", period: "day" })).visits).toEqual([]);
            expect((await stats.paymentSources("b", { type: "utm", period: "day" })).payments).toEqual([]);
            expect((await stats.referralUsers("b")).referrals).toEqual([]);
            expect((await stats.searchUsers("b", "x")).users).toEqual([]);
            expect((await stats.charts("b")).series).toEqual({});
            expect((await stats.report("b", "payouts")).report).toBeNull();
            expect((await stats.reportInfo("b", "payouts")).report).toBeNull();
        }
    });

    test("plain objects survive null", async () => {
        const { stats } = fakeStats(null);
        expect(await stats.summary("b")).toBeDefined();
        expect(await stats.metrics("b", 1, 2)).toBeDefined();
        expect(await stats.referrals("b")).toBeDefined();
        expect(await stats.post("b", "p")).toBeDefined();
    });
});

describe("stats review guards", () => {
    test("events skip null rows", async () => {
        const r = await fakeStats({ data: [null, { eventType: "subscribe" }] }).stats.events("b");
        expect(r.events).toHaveLength(1);
        expect(r.events[0]).toBeInstanceOf(BlogEvent);
    });

    test("a non-JSON response is not echoed into the log", async () => {
        const http: HTTPClient = { request: async () => new Response("alice@example.com;100", { status: 200 }) };
        const api = new API(http, new Auth(new MemoryResolver()));
        const warn = spyOn(console, "warn").mockImplementation(() => {});
        const log = spyOn(console, "log").mockImplementation(() => {});
        try {
            expect(await api.request<string>("GET", "/v1/x")).toBe("alice@example.com;100");
            const lines = warn.mock.calls.map((args) => args.join(" "));
            expect(lines.some((l) => l.includes("not JSON"))).toBe(true);
            expect(lines.some((l) => l.includes("alice"))).toBe(false);
        } finally {
            warn.mockRestore();
            log.mockRestore();
        }
    });
});
