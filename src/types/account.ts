import { BaseObject } from "./base";

/** One logged-in device of the account (GET /v1/user/session/). */
export class ActiveSession extends BaseObject {
    declare id: string;
    /** Unix time, seconds. */
    declare createdAt?: number;
    /** Unix time, seconds. */
    declare lastActiveAt?: number;
    declare type?: string;
    declare country?: string;
    /** IP address of the last request. */
    declare remoteAddr?: string;
    declare deviceInfo?: { model?: string; brand?: string; os?: string; userAgent?: string; [key: string]: any };
    declare flags?: { isOnline?: boolean; isCurrent?: boolean; [key: string]: any };
}

/** Active sessions. The API wraps them as `{ data: { sessions } }`; the list is lifted to the top level. */
export class ActiveSessionsResponse extends BaseObject {
    declare sessions: ActiveSession[];

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        const list = data?.data?.sessions;
        this.sessions = (Array.isArray(list) ? list : []).filter((x: any) => x && typeof x === "object").map((s: any) => new ActiveSession(s));
    }
}

/** A page of the user's subscriptions (GET /v1/user/subscriptions); items are left untyped. */
export class SubscriptionsResponse extends BaseObject {
    declare data: BaseObject[];
    declare total?: number;
    declare offset?: number;
    declare limit?: number;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        this.data = (Array.isArray(data?.data) ? data.data : []).filter((x: any) => x && typeof x === "object").map((s: any) => new BaseObject(s));
    }
}

/** Transports of notifications, as the API names them. */
export type NotificationTransport = "standalone" | "mobile_push" | "telegram" | "mail";

/**
 * Notification switches, as the web client sends them in the path of the update call.
 * The read side names the same switches in camelCase ("new_comment" is `newComment`).
 */
export type NotificationSwitch =
    | "new_comment"
    | "new_donation"
    | "new_message"
    | "buy_message"
    | "other_news"
    | "new_promo"
    | "new_referal"
    | "new_target"
    | "new_post"
    | "buy_post"
    | "buy_bundle"
    | "new_referal_blogger"
    | "new_reply"
    | "new_stream"
    | "new_subscriber"
    | "level_subscribers_limit_reached";

/**
 * Notification settings (GET /v1/notification/settings/?transports=...).
 * `settings` maps each requested transport to its switches: `{ mail: { newComment: true, ... } }`.
 */
export class NotificationSettingsResponse extends BaseObject {
    declare settings: Partial<Record<NotificationTransport, Record<string, boolean>>>;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        const s = data?.settings;
        this.settings = s && typeof s === "object" && !Array.isArray(s) ? s : {};
    }
}

/**
 * A saved payment card. Only the id is typed: no live account had saved cards, so the other fields
 * stay behind the index signature.
 */
export class PaymentBind extends BaseObject {
    declare id: number | string;
}

/** Saved cards (GET /v1/payment/bind/list). */
export class PaymentBindsResponse extends BaseObject {
    declare data: PaymentBind[];
    declare extra?: { allowDeleteLastBind?: boolean; [key: string]: any };

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        this.data = (Array.isArray(data?.data) ? data.data : []).filter((x: any) => x && typeof x === "object").map((b: any) => new PaymentBind(b));
    }
}

/** Currencies the user can pick for their blog (GET /v1/user/current/blog_currency/available/). */
export class BlogCurrenciesResponse extends BaseObject {
    declare currencies: string[];

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        const list = data?.data?.currencies;
        this.currencies = Array.isArray(list) ? list : [];
    }
}

/** Who may start a conversation with the user (the body of POST /v1/user/dialog_settings). */
export interface DialogSettingsUpdate {
    sendMsgLevelId?: number;
    canSendAll?: boolean;
    canSendDonation?: boolean;
    canSendMyAuthors?: boolean;
    canSendPaidSubscribers?: boolean;
    canSendSubscribers?: boolean;
    canSendPayers?: boolean;
}

/** Fields of PUT /v1/user/current that the web client sends from the settings page. */
export interface ProfileUpdate {
    name?: string;
    email?: string;
    canViewAdultContent?: boolean;
    sendMsgRule?: string;
    sendMsgLevelId?: number;
}
