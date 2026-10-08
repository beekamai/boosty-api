/* Billing resource against a fake HTTP client: wire format of every call and tolerance to odd bodies. */
import { describe, expect, test } from "bun:test";
import { API, Auth, AuthData, ABCAuthDataResolver, type HTTPClient } from "../src";
import {
    BroadcastMessageStat,
    DonationSale,
    Payer,
    Payout,
    PayoutHistoryItem,
    PayoutMethod,
} from "../src/types/income";

class MemoryResolver extends ABCAuthDataResolver {
    loadAuthData(): AuthData {
        const data = new AuthData();
        data.access_token = "tok";
        data.expires_at = String(Math.floor(Date.now() / 1000) + 3600);
        return (this.authData = data);
    }
    saveAuthData(): void {}
}

function fakeApi(body: unknown) {
    const calls: { method: string; url: URL; body: string | null; auth: string | null }[] = [];
    const http: HTTPClient = {
        async request(url, init) {
            const headers = new Headers(init.headers);
            calls.push({
                method: init.method ?? "GET",
                url: new URL(url),
                body: typeof init.body === "string" ? init.body : null,
                auth: headers.get("Authorization"),
            });
            return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
        },
    };
    return { api: new API(http, new Auth(new MemoryResolver())), calls };
}

const ODD = [null, {}, { data: null }, { data: {} }, { data: { donationsSales: {} } }];

describe("income lists", () => {
    test("donations: path, query and wrapping", async () => {
        const { api, calls } = fakeApi({
            data: { donationsSales: [{ id: 1, amount: 5, type: "post", user: { id: 2, name: "n", email: "e" } }] },
            extra: { total: 1, offset: "7" },
        });
        const r = await api.income.donations("my blog", { limit: 2, offset: 0, sortBy: "amount", order: "lt", type: "post", targetId: 9 });
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/blog/my%20blog/sales/donation/");
        expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
            limit: "2", offset: "0", sort_by: "amount", order: "lt", type: "post", target_id: "9",
        });
        expect(r.data[0]).toBeInstanceOf(DonationSale);
        expect(r.data[0].user).toBeInstanceOf(Payer);
        expect(r.extra).toEqual({ total: 1, offset: "7" });
    });

    test("unset options send no query", async () => {
        const { api, calls } = fakeApi({});
        await api.income.donations("b");
        expect(calls[0].url.search).toBe("");
    });

    test("postSales and bundleSales join ids with commas", async () => {
        const { api, calls } = fakeApi({ data: { postsSales: [{ x: 1 }], bundlesSales: [{ y: 2 }] } });
        const posts = await api.income.postSales("b", { postIds: [1, "2"] });
        const bundles = await api.income.bundleSales("b", { bundleIds: [3, 4], limit: 1 });
        expect(calls[0].url.pathname).toBe("/v1/blog/b/sales/post/");
        expect(calls[0].url.searchParams.get("post_ids")).toBe("1,2");
        expect(calls[1].url.pathname).toBe("/v1/blog/b/sales/bundle/");
        expect(calls[1].url.searchParams.get("bundle_ids")).toBe("3,4");
        expect(posts.data[0].x).toBe(1);
        expect(bundles.data[0].y).toBe(2);
    });

    test("holds and broadcastSales take limit and string offset", async () => {
        const { api, calls } = fakeApi({
            data: {
                holds: [{ h: 1 }],
                dialogBroadcastMessagesStat: [{ id: 3, sentCount: 4, data: [{ type: "text", content: "c" }] }],
            },
        });
        const holds = await api.income.holds("b", { limit: 5, offset: 10 });
        const bc = await api.income.broadcastSales("b", { limit: 1 });
        expect(calls[0].url.pathname).toBe("/v1/blog/b/sales/hold/");
        expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({ limit: "5", offset: "10" });
        expect(calls[1].url.pathname).toBe("/v1/blog/b/sales/dialog_broadcast_message/");
        expect(holds.data).toHaveLength(1);
        expect(bc.data[0]).toBeInstanceOf(BroadcastMessageStat);
        expect(bc.data[0].data[0].type).toBe("text");
    });

    test("odd bodies give empty lists", async () => {
        for (const body of ODD) {
            const { api } = fakeApi(body);
            expect((await api.income.donations("b")).data).toEqual([]);
            expect((await api.income.postSales("b")).data).toEqual([]);
            expect((await api.income.bundleSales("b")).data).toEqual([]);
            expect((await api.income.holds("b")).data).toEqual([]);
            expect((await api.income.broadcastSales("b")).data).toEqual([]);
            expect((await api.income.postSalesByDate("b", 1, 2)).data).toEqual([]);
            expect(await api.income.payouts("b")).toEqual([]);
            expect(await api.income.payoutMethods()).toEqual([]);
            expect((await api.income.payoutHistory("b")).data).toEqual([]);
        }
    });
});

describe("income list hygiene", () => {
    test("null items are skipped instead of failing the page", async () => {
        const d = await fakeApi({ data: { donationsSales: [null, { id: 1, amount: 5 }, "x"] } }).api.income.donations("b");
        expect(d.data).toHaveLength(1);
        expect(d.data[0]).toBeInstanceOf(DonationSale);
        const h = await fakeApi({ data: [null, { id: 2 }] }).api.income.payoutHistory("b", { offset: "next" });
        expect(h.data).toHaveLength(1);
        expect((await fakeApi({ data: [null, { id: 3 }] }).api.income.payouts("b"))).toHaveLength(1);
    });

    test("empty id lists are left out instead of sent as key=", async () => {
        const { api, calls } = fakeApi({});
        await api.income.postSales("b", { postIds: [] });
        await api.income.bundleSales("b", { bundleIds: [] });
        expect(calls.map((c) => c.url.search)).toEqual(["", ""]);
    });
});

describe("income by date", () => {
    test("by_date sends from/to, days sends date, for posts and bundles", async () => {
        const { api, calls } = fakeApi({ data: [{ d: 1 }] });
        const a = await api.income.postSalesByDate("b", 10, 20);
        await api.income.bundleSalesByDate("b", 10, 20);
        await api.income.postSalesDays("b", 30);
        await api.income.bundleSalesDays("b", 30);
        expect(calls.map((c) => c.url.pathname)).toEqual([
            "/v1/blog/b/post/paid/by_date",
            "/v1/blog/b/bundle/paid/by_date",
            "/v1/blog/b/post/paid/days",
            "/v1/blog/b/bundle/paid/days",
        ]);
        expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({ from: "10", to: "20" });
        expect(Object.fromEntries(calls[1].url.searchParams)).toEqual({ from: "10", to: "20" });
        expect(Object.fromEntries(calls[2].url.searchParams)).toEqual({ date: "30" });
        expect(Object.fromEntries(calls[3].url.searchParams)).toEqual({ date: "30" });
        expect(a.data[0].d).toBe(1);
        expect(calls.every((c) => c.method === "GET")).toBe(true);
    });
});

describe("payouts", () => {
    test("methods, bound payouts and history", async () => {
        const m = fakeApi({ payoutMethods: [{ paySystem: "x", currency: "RUB", pay_system: "x" }] });
        const methods = await m.api.income.payoutMethods();
        expect(m.calls[0].url.pathname).toBe("/v1/payout/methods");
        expect(methods[0]).toBeInstanceOf(PayoutMethod);

        const p = fakeApi({ data: [{ id: 1, isActive: true, priority: 2, lastPayout: { date: 3, status: "done" } }] });
        const payouts = await p.api.income.payouts("b");
        expect(p.calls[0].url.pathname).toBe("/v1/blog/b/payout/");
        expect(payouts[0]).toBeInstanceOf(Payout);
        expect(payouts[0].lastPayout?.status).toBe("done");

        const h = fakeApi({ data: [{ id: 1, amountWoFee: 2 }], extra: { total: 9, offset: "2" } });
        const hist = await h.api.income.payoutHistory("b", { limit: 2, offset: 4 });
        expect(h.calls[0].url.pathname).toBe("/v1/blog/b/payout/history/");
        expect(Object.fromEntries(h.calls[0].url.searchParams)).toEqual({ limit: "2", offset: "4" });
        expect(hist.data[0]).toBeInstanceOf(PayoutHistoryItem);
        expect(hist.extra?.total).toBe(9);
    });

    test("default currency goes anonymous even with a session", async () => {
        const { api, calls } = fakeApi({ defaultCurrency: "USD" });
        expect((await api.income.defaultCurrency()).defaultCurrency).toBe("USD");
        expect(calls[0].url.pathname).toBe("/v1/payment/default_currency");
        expect(calls[0].auth).toBeNull();
    });

    test("blog names are encoded as one path segment", async () => {
        const { api } = fakeApi({});
        await expect(api.income.payouts("a/b")).rejects.toThrow(TypeError);
    });
});

describe("deprecated sales", () => {
    test("still posts the form to /v1/stat/sales/", async () => {
        const { api, calls } = fakeApi({});
        await api.income.sales({ type: "donation", limit: 3 });
        expect(calls[0].method).toBe("POST");
        expect(calls[0].url.pathname).toBe("/v1/stat/sales/");
        expect(new URLSearchParams(calls[0].body!).get("type")).toBe("donation");
    });
});

describe("income review guards", () => {
    test("payout methods skip null items", async () => {
        expect(await fakeApi({ payoutMethods: [null, { paySystem: "x" }] }).api.income.payoutMethods()).toHaveLength(1);
    });

    test("a null cursor sends no offset", async () => {
        const { api, calls } = fakeApi({});
        await api.income.payoutHistory("b", { offset: null as any });
        await api.income.donations("b", { offset: null as any });
        expect(calls.map((c) => c.url.searchParams.has("offset"))).toEqual([false, false]);
    });
});
