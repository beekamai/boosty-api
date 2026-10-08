/* types/income.ts — models of the blog owner's billing: sales, donations, payouts. */
import { BaseObject } from "./base";
import { BaseUser } from "./users";

/** Paging block of the billing lists. `offset` is an opaque cursor string, `total` the overall count. */
export interface SalesExtra {
    offset?: string;
    total?: number;
}

/** A user who paid; `email` is visible to the blog owner on donations. */
export class Payer extends BaseUser {
    declare email?: string;
    declare canWrite?: boolean;
}

/** One donation received by the blog (GET /v1/blog/{blog}/sales/donation/). */
export class DonationSale extends BaseObject {
    declare id: number;
    declare amount: number;
    /** What the donation was attached to, for example "post" or "dialog". */
    declare type?: string;
    declare targetId?: number;
    declare bloggerId?: number;
    /** Unix time, seconds. */
    declare createdAt?: number;
    declare isFeePaid?: boolean;
    declare user?: Payer;

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.user) this.user = new Payer(data.user);
    }
}

/** A paid post sale. Item fields were not seen live (the list was empty); read them via the index signature. */
export class PostSale extends BaseObject {}

/** A bundle sale. Item fields were not seen live (the list was empty). */
export class BundleSale extends BaseObject {}

/** A held payment. Item fields were not seen live (the list was empty). */
export class BlogHold extends BaseObject {}

function items<T>(json: any, key: string, make: (d: any) => T): T[] {
    const list = json?.data?.[key];
    return Array.isArray(list) ? list.filter((x: any) => x && typeof x === "object").map(make) : [];
}

function extraOf(json: any): SalesExtra | undefined {
    return json?.extra && typeof json.extra === "object" ? json.extra : undefined;
}

export class DonationSalesResponse extends BaseObject {
    declare data: DonationSale[];
    declare extra?: SalesExtra;

    constructor(json: Record<string, any> = {}) {
        super(json);
        this.data = items(json, "donationsSales", (d) => new DonationSale(d));
        this.extra = extraOf(json);
    }
}

export class PostSalesResponse extends BaseObject {
    declare data: PostSale[];
    declare extra?: SalesExtra;

    constructor(json: Record<string, any> = {}) {
        super(json);
        this.data = items(json, "postsSales", (d) => new PostSale(d));
        this.extra = extraOf(json);
    }
}

export class BundleSalesResponse extends BaseObject {
    declare data: BundleSale[];
    declare extra?: SalesExtra;

    constructor(json: Record<string, any> = {}) {
        super(json);
        this.data = items(json, "bundlesSales", (d) => new BundleSale(d));
        this.extra = extraOf(json);
    }
}

export class HoldsResponse extends BaseObject {
    declare data: BlogHold[];
    declare extra?: SalesExtra;

    constructor(json: Record<string, any> = {}) {
        super(json);
        this.data = items(json, "holds", (d) => new BlogHold(d));
        this.extra = extraOf(json);
    }
}

/** One block of a broadcast message body. */
export interface BroadcastMessageBlock {
    type?: string;
    content?: string;
    modificator?: string;
}

/** Statistics of one paid mass mailing to dialogs. */
export class BroadcastMessageStat extends BaseObject {
    declare id: number;
    declare price?: number;
    declare sentCount?: number;
    declare viewsCount?: number;
    declare salesCount?: number;
    declare totalAmount?: number;
    /** Unix time, seconds. */
    declare createdAt?: number;
    declare data: BroadcastMessageBlock[];

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = Array.isArray(data.data) ? data.data : [];
    }
}

export class BroadcastMessageStatsResponse extends BaseObject {
    declare data: BroadcastMessageStat[];
    declare extra?: SalesExtra;

    constructor(json: Record<string, any> = {}) {
        super(json);
        this.data = items(json, "dialogBroadcastMessagesStat", (d) => new BroadcastMessageStat(d));
        this.extra = extraOf(json);
    }
}

/** Per-day or per-range paid sales counters. Item fields were not seen live (the lists were empty). */
export class SalesSeries extends BaseObject {
    declare data: Record<string, any>[];

    constructor(json: Record<string, any> = {}) {
        super(json);
        this.data = Array.isArray(json?.data) ? json.data : [];
    }
}

/** A payout system the platform can pay out through (GET /v1/payout/methods). */
export class PayoutMethod extends BaseObject {
    declare paySystem?: string;
    declare currency?: string;
    /** Same value as `paySystem`, in the raw snake_case spelling the API also sends. */
    declare pay_system?: string;
}

/** Outcome of the most recent payout to a destination. */
export interface LastPayout {
    /** Unix time, seconds. */
    date?: number;
    status?: string;
}

/** A payout destination bound to the blog (GET /v1/blog/{blog}/payout/). `destination` is private. */
export class Payout extends BaseObject {
    declare id: number;
    declare paySystem?: string;
    declare systemId?: string;
    declare payType?: string;
    declare currency?: string;
    declare destination?: string;
    declare priority?: number;
    declare isActive?: boolean;
    declare lastPayout?: LastPayout;
}

/** One finished or pending payout (GET /v1/blog/{blog}/payout/history/). */
export class PayoutHistoryItem extends BaseObject {
    declare id: number;
    declare amount?: number;
    /** Amount without the fee. */
    declare amountWoFee?: number;
    declare currency?: string;
    declare status?: string;
    declare paySystem?: string;
    declare systemId?: string;
    declare destination?: string;
    /** Unix time, seconds. */
    declare updatedAt?: number;
}

export class PayoutHistoryResponse extends BaseObject {
    declare data: PayoutHistoryItem[];
    declare extra?: SalesExtra;

    constructor(json: Record<string, any> = {}) {
        super(json);
        this.data = Array.isArray(json?.data) ? json.data.filter((x: any) => x && typeof x === "object").map((d: any) => new PayoutHistoryItem(d)) : [];
        this.extra = extraOf(json);
    }
}

/** Default currency of a guest (GET /v1/payment/default_currency, anonymous only). */
export class DefaultCurrency extends BaseObject {
    declare defaultCurrency?: string;
}
