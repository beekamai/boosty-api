import { BaseObject } from "./base";
import { BaseUser } from "./users";

/** Blog summary (GET /v1/blog/stat/{blog}/current). Money is in the blog currency. */
export class BlogSummary extends BaseObject {
    declare balance: number;
    declare hold: number;
    declare income: number;
    declare payoutSum: number;
    declare paidCount: number;
    declare followersCount: number;
    declare commissionFee: number;
    declare hasReferralDiscount: boolean;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
    }
}

/** Totals for a period (GET /v1/blog/stat/{blog}/metrics): counts and `*Money` sums per source. */
export class BlogMetrics extends BaseObject {
    declare totalMoney: number;
    declare incSubscribers: number;
    declare incSubscribersMoney: number;
    declare upSubscribers: number;
    declare upSubscribersMoney: number;
    declare decSubscribers: number;
    declare incFollowers: number;
    declare decFollowers: number;
    declare recurrents: number;
    declare recurrentsMoney: number;
    declare postsSale: number;
    declare postSaleMoney: number;
    declare messagesSale: number;
    declare messagesSaleMoney: number;
    declare bundlesSale: number;
    declare bundleSaleMoney: number;
    declare giftsSale: number;
    declare giftsSaleMoney: number;
    declare donations: number;
    declare donationsMoney: number;
    declare holds: number;
    declare referal: number;
    declare referalMoney: number;
    declare referalMoneyOut: number;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
    }
}

/** One day of a chart series. */
export interface ChartPoint {
    year: number;
    month: number;
    day: number;
    count: number;
}

/** Daily series per metric (GET /v1/blog/{blog}/stat/data): `totalMoney`, `incSubscribers`, `donations`... */
export class BlogCharts extends BaseObject {
    declare series: Record<string, ChartPoint[]>;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        this.series = {};
        for (const [key, value] of Object.entries(data ?? {})) {
            if (Array.isArray(value)) this.series[key] = value;
        }
    }
}

/** Page marker shared by the stat lists. `offset` is a string for events/visits and a number for referral users. */
export interface StatExtra {
    offset?: string | number;
    total?: number;
    isLast?: boolean;
}

/** A money or subscription event (GET /v1/blog/stat/{blog}/events). */
export class BlogEvent extends BaseObject {
    /** For example "subscribe", "recurrent", "buy_post", "donation_target", "payout". */
    declare eventType: string;
    declare switchType?: string;
    declare amount?: number;
    /** Unix time, seconds. */
    declare createdAt: number;
    declare bloggerId?: number;
    declare isFeePaid?: boolean;
    declare levelId?: number;
    declare period?: number;
    /** Carries the subscriber's e-mail. */
    declare user?: BaseUser;

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.user) this.user = new BaseUser(data.user);
    }
}

export class BlogEventsResponse extends BaseObject {
    declare events: BlogEvent[];
    declare extra?: StatExtra;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        this.events = (Array.isArray(data?.data) ? data.data : []).filter((x: any) => x && typeof x === "object").map((e: any) => new BlogEvent(e));
        if (data?.extra) this.extra = data.extra;
    }
}

/** Views of one source (a referer host or a utm tag). */
export interface VisitSource {
    source?: string;
    viewCount: number;
    viewUniqCount: number;
}

/** Visits by source (GET /v1/blog/stat/{blog}/visits): the `all` total and a page of `visits`. */
export class VisitsResponse extends BaseObject {
    declare all?: VisitSource;
    declare visits: VisitSource[];
    declare extra?: StatExtra;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        if (data?.data?.all) this.all = data.data.all;
        this.visits = Array.isArray(data?.data?.visits) ? data.data.visits : [];
        if (data?.extra) this.extra = data.extra;
    }
}

/** Payments by source (GET /v1/blog/stat/{blog}/payments/analytics). Row fields are not typed: none were seen live. */
export class PaymentSourcesResponse extends BaseObject {
    declare payments: Record<string, any>[];
    declare extra?: StatExtra;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        this.payments = Array.isArray(data?.data?.payments) ? data.data.payments : [];
        if (data?.extra) this.extra = data.extra;
    }
}

/** Referral programme totals (GET /v1/blog/referral/{blog}/stat/). */
export class ReferralStats extends BaseObject {
    declare balance: number;
    declare referral: number;
    declare regs: number;
    declare referralMoney: number;
    declare actualTariff?: { referralBountyPercent: number; discountCommission: number; commission: number };

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
    }
}

/** Users brought in by the referral programme (GET /v1/blog/referral/{blog}/user/). Row fields are not typed. */
export class ReferralUsersResponse extends BaseObject {
    declare referrals: Record<string, any>[];
    declare extra?: StatExtra;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        this.referrals = Array.isArray(data?.data?.referrals) ? data.data.referrals : [];
        if (data?.extra) this.extra = data.extra;
    }
}

/** Subscriber search (GET /v1/blog/stat/{blog}/search). Rows are not typed: no match was seen live. */
export class StatSearchResponse extends BaseObject {
    declare users: Record<string, any>[];

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        this.users = Array.isArray(data?.data) ? data.data : [];
    }
}

/** Statistics of one post (GET /v1/blog/stat/{blog}/post/{postId}). Fields are not typed: the owner had no posts. */
export class PostStat extends BaseObject {
    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
    }
}

/** A generated report: `url` is the file link, `status` the build state. */
export class StatReport extends BaseObject {
    declare type: string;
    declare status: string;
    declare url?: string;
    declare webUrl?: string;
    /** Unix time, seconds. */
    declare createdAt?: number;
    declare period?: string | null;
    declare startDate?: number | null;
    declare endDate?: number | null;

    constructor(data: Record<string, any> = {}) {
        super(data);
    }
}

/** Report envelope: `{ data: { report } }`, `report` is null when none was generated yet (info). */
export class StatReportResponse extends BaseObject {
    declare report: StatReport | null;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        const report = data?.data?.report;
        this.report = report ? new StatReport(report) : null;
    }
}
