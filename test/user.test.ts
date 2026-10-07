/* UserResource against a fake HTTP client: verb, path, query, form body and response wrapping. */
import { describe, expect, test } from "bun:test";
import { API, Auth, AuthData, ABCAuthDataResolver, type HTTPClient } from "../src";
import { UserResource } from "../src/resources/user";
import { ActiveSession, PaymentBind } from "../src/types/account";
import { CurrentUser } from "../src/types/users";

class MemoryResolver extends ABCAuthDataResolver {
    loadAuthData(): AuthData {
        return (this.authData = new AuthData());
    }
    saveAuthData(): void {}
}

function fake(body: unknown) {
    const calls: { method: string; url: URL; body: string | null }[] = [];
    const http: HTTPClient = {
        async request(url, init) {
            calls.push({ method: init.method ?? "GET", url: new URL(url), body: typeof init.body === "string" ? init.body : null });
            return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
        },
    };
    return { user: new UserResource(new API(http, new Auth(new MemoryResolver()))), calls };
}

describe("user reads", () => {
    test("subscriptions sends paging and with_follow", async () => {
        const { user, calls } = fake({ data: [{ id: 1 }], total: 1, offset: 0, limit: 2 });
        const res = await user.subscriptions({ limit: 2, offset: 4, withFollow: true });
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/user/subscriptions");
        expect(calls[0].url.searchParams.get("limit")).toBe("2");
        expect(calls[0].url.searchParams.get("offset")).toBe("4");
        expect(calls[0].url.searchParams.get("with_follow")).toBe("true");
        expect(res.data).toHaveLength(1);
        expect(res.total).toBe(1);
    });

    test("subscriptions defaults with_follow to false and survives odd bodies", async () => {
        for (const body of [null, {}, { data: null }]) {
            const { user, calls } = fake(body);
            expect((await user.subscriptions()).data).toEqual([]);
            expect(calls[0].url.searchParams.get("with_follow")).toBe("false");
        }
    });

    test("sessions lifts sessions out of data", async () => {
        const { user, calls } = fake({ data: { sessions: [{ id: "s1", flags: { isCurrent: true } }] } });
        const res = await user.sessions();
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/user/session/");
        expect(res.sessions[0]).toBeInstanceOf(ActiveSession);
        expect(res.sessions[0].flags?.isCurrent).toBe(true);
        for (const body of [null, {}, { data: {} }, { data: { sessions: "x" } }]) {
            expect((await fake(body).user.sessions()).sessions).toEqual([]);
        }
    });

    test("notificationSettings requests all transports by default", async () => {
        const { user, calls } = fake({ settings: { mail: { newComment: true } } });
        const res = await user.notificationSettings();
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/notification/settings/");
        expect(calls[0].url.searchParams.get("transports")).toBe("standalone,mobile_push,telegram,mail");
        expect(res.settings.mail?.newComment).toBe(true);
        await user.notificationSettings(["mail"]);
        expect(calls[1].url.searchParams.get("transports")).toBe("mail");
        for (const body of [null, {}, { settings: [] }]) {
            expect((await fake(body).user.notificationSettings()).settings).toEqual({});
        }
    });

    test("paymentCards", async () => {
        const { user, calls } = fake({ data: [{ id: 7, extraField: 1 }], extra: { allowDeleteLastBind: true } });
        const res = await user.paymentCards({ currency: "RUB" });
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/payment/bind/list");
        expect(calls[0].url.searchParams.get("payment_partner")).toBe("advpay");
        expect(calls[0].url.searchParams.get("deleted")).toBe("false");
        expect(calls[0].url.searchParams.get("currency")).toBe("RUB");
        expect(res.data[0]).toBeInstanceOf(PaymentBind);
        expect(res.extra?.allowDeleteLastBind).toBe(true);
        expect((await fake(null).user.paymentCards()).data).toEqual([]);
    });

    test("availableBlogCurrencies", async () => {
        const { user, calls } = fake({ data: { currencies: ["RUB"] } });
        expect((await user.availableBlogCurrencies()).currencies).toEqual(["RUB"]);
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/user/current/blog_currency/available/");
        for (const body of [null, {}, { data: { currencies: null } }]) {
            expect((await fake(body).user.availableBlogCurrencies()).currencies).toEqual([]);
        }
    });
});

describe("user writes", () => {
    test("updateProfile sends only the given fields, snake_case, form-encoded", async () => {
        const { user, calls } = fake({ id: 1, name: "new" });
        const res = await user.updateProfile({ name: "new", canViewAdultContent: true });
        expect(res).toBeInstanceOf(CurrentUser);
        expect(calls[0].method).toBe("PUT");
        expect(calls[0].url.pathname).toBe("/v1/user/current");
        expect(new URLSearchParams(calls[0].body ?? "").toString()).toBe("name=new&can_view_adult_content=true");
    });

    test("updateProfile refuses an empty update without a request", async () => {
        const { user, calls } = fake({});
        await expect(user.updateProfile({})).rejects.toThrow(TypeError);
        await expect(user.updateProfile({ name: undefined })).rejects.toThrow(TypeError);
        expect(calls).toHaveLength(0);
    });

    test("updateNotificationSetting puts the value in the path-addressed switch", async () => {
        const { user, calls } = fake({});
        await user.updateNotificationSetting("mail", "new_comment", false);
        expect(calls[0].method).toBe("PUT");
        expect(calls[0].url.pathname).toBe("/v1/notification/settings/mail/new_comment");
        expect(calls[0].body).toBe("value=false");
        await expect(user.updateNotificationSetting("mail", "../x" as any, true)).rejects.toThrow(TypeError);
    });

    test("updateDialogSettings posts the full set: omitted switches keep their current values", async () => {
        const { user, calls } = fake({
            id: 1,
            dialogSettings: {
                sendMsgLevelId: 1,
                canSendAll: true,
                canSendDonation: true,
                canSendMyAuthors: false,
                canSendPaidSubscribers: true,
                canSendSubscribers: true,
                candSendPayers: true,
            },
        });
        await user.updateDialogSettings({ canSendAll: false, sendMsgLevelId: 3, canSendDonation: undefined });
        expect(calls[0].method).toBe("GET");
        expect(calls[0].url.pathname).toBe("/v1/user/current");
        expect(calls[1].method).toBe("POST");
        expect(calls[1].url.pathname).toBe("/v1/user/dialog_settings");
        expect(Object.fromEntries(new URLSearchParams(calls[1].body ?? ""))).toEqual({
            send_msg_level_id: "3",
            can_send_all: "false",
            can_send_donation: "true",
            can_send_my_authors: "false",
            can_send_paid_subscribers: "true",
            can_send_subscribers: "true",
            can_send_payers: "true",
        });
    });

    test("setLocale sends the language part only", async () => {
        const { user, calls } = fake({});
        await user.setLocale("en_US");
        expect(calls[0].method).toBe("POST");
        expect(calls[0].url.pathname).toBe("/v1/user/locale");
        expect(calls[0].body).toBe("lang=en");
    });

    test("endSessions needs explicit confirmation and sends nothing without it", async () => {
        const { user, calls } = fake({});
        await expect((user.endSessions as any)()).rejects.toThrow(TypeError);
        await expect(user.endSessions({ includingCurrent: false } as any)).rejects.toThrow(TypeError);
        expect(calls).toHaveLength(0);
        await user.endSessions({ includingCurrent: true });
        expect(calls[0].method).toBe("DELETE");
        expect(calls[0].url.pathname).toBe("/v1/user/session/");
        expect(calls[0].body).toBeNull();
    });
});

describe("user write guards", () => {
    test("updateProfile treats null fields as absent", async () => {
        const { user, calls } = fake({});
        await expect(user.updateProfile({ name: null } as any)).rejects.toThrow(TypeError);
        expect(calls).toHaveLength(0);
    });

    test("updateDialogSettings refuses to post a partial set when the current switches are unknown", async () => {
        const { user, calls } = fake({ id: 1 });
        await expect(user.updateDialogSettings({ canSendAll: false })).rejects.toThrow(TypeError);
        expect(calls.map((c) => c.method)).toEqual(["GET"]);
    });

    test("updateDialogSettings: a null value does not wipe the current switch", async () => {
        const settings = { sendMsgLevelId: 1, canSendAll: true, canSendDonation: true, canSendMyAuthors: true,
            canSendPaidSubscribers: true, canSendSubscribers: true, candSendPayers: false };
        const { user, calls } = fake({ id: 1, dialogSettings: settings });
        await user.updateDialogSettings({ canSendDonation: null } as any);
        const body = new URLSearchParams(calls[1].body ?? "");
        expect(body.get("can_send_donation")).toBe("true");
        expect(body.get("can_send_payers")).toBe("false");
        expect(body.has("cand_send_payers")).toBe(false);
    });

    test("sessions skip null items", async () => {
        const { user } = fake({ data: { sessions: [null, { id: "s2" }, 5] } });
        expect((await user.sessions()).sessions).toHaveLength(1);
    });
});
