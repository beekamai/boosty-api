/* resources/stats.ts — blog owner's analytics: totals, charts, events, visits, referrals, reports. */
import { BaseResource, apiPath, commaList } from "../http";
import {
    BlogCharts,
    BlogEventsResponse,
    BlogMetrics,
    BlogSummary,
    PaymentSourcesResponse,
    PostStat,
    ReferralStats,
    ReferralUsersResponse,
    StatReportResponse,
    StatSearchResponse,
    VisitsResponse,
} from "../types/stats";

/** Window of the visit and payment source tables (the API rejects "year" and "all"). */
export type StatPeriod = "day" | "week" | "month";

/** What the source tables group by. */
export type StatSourceType = "referer" | "utm";

export interface SourceStatOptions {
    type: StatSourceType;
    period: StatPeriod;
    limit?: number;
    offset?: string | number;
    /** "gt" or "lt": descending or ascending. The API rejects a request without it, so "gt" is the default. */
    order?: "gt" | "lt";
    /** Visits: "view_count" or "view_uniq_count". Payments: no accepted value found. */
    sortBy?: string;
    timestamp?: number;
}

export interface StatEventsOptions {
    /** Unix time, seconds. */
    from?: number;
    to?: number;
    /** For example "subscribe", "unsubscribe", "recurrent", "buy_post", "donation_target", "payout". */
    eventTypes?: string[];
    userIds?: number[];
    limit?: number;
    offset?: string | number;
}

/** Report kinds the API accepts; any other value is 400 invalid_param stat_type. */
export type ReportType = "donations" | "subscriptions" | "holds" | "payouts";

export class StatsResource extends BaseResource {
    /**
     * Balance, income, holds and follower count of the blog.
     * @verified GET /v1/blog/stat/{blog}/current (live 200 on the owner's blog)
     */
    async summary(blogName: string): Promise<BlogSummary> {
        return new BlogSummary(await this.core.request("GET", apiPath`/v1/blog/stat/${blogName}/current`));
    }

    /**
     * Money and counts per source for a period.
     * @verified GET /v1/blog/stat/{blog}/metrics (live 200 on the owner's blog)
     * @param from period start, unix seconds. Required: without it the API answers 400 invalid_param.
     * @param to period end, unix seconds.
     */
    async metrics(blogName: string, from: number, to: number): Promise<BlogMetrics> {
        const json = await this.core.request("GET", apiPath`/v1/blog/stat/${blogName}/metrics`, { params: { from, to } });
        return new BlogMetrics(json);
    }

    /**
     * Daily series per metric, newest first.
     * @verified GET /v1/blog/{blog}/stat/data (live 200 on the owner's blog)
     * @param options.lastTime paging cursor, unix seconds.
     */
    async charts(blogName: string, options: { lastTime?: number; limit?: number } = {}): Promise<BlogCharts> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogName}/stat/data`, {
            params: { last_time: options.lastTime, limit: options.limit },
        });
        return new BlogCharts(json);
    }

    /**
     * Money and subscription events of the blog. Rows carry the subscriber's e-mail.
     * @verified GET /v1/blog/stat/{blog}/events (live 200 on the owner's blog)
     */
    async events(blogName: string, options: StatEventsOptions = {}): Promise<BlogEventsResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/stat/${blogName}/events`, {
            params: {
                from: options.from,
                to: options.to,
                event_types: commaList(options.eventTypes),
                user_ids: commaList(options.userIds),
                limit: options.limit,
                offset: options.offset,
            },
        });
        return new BlogEventsResponse(json);
    }

    /**
     * Visits grouped by referer or utm tag.
     * @verified GET /v1/blog/stat/{blog}/visits (live 200 on the owner's blog; type, period and order are required)
     */
    async visits(blogName: string, options: SourceStatOptions): Promise<VisitsResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/stat/${blogName}/visits`, {
            params: sourceParams(options),
        });
        return new VisitsResponse(json);
    }

    /**
     * Payments grouped by referer or utm tag.
     * @verified GET /v1/blog/stat/{blog}/payments/analytics (live 200 on the owner's blog; the table was empty)
     */
    async paymentSources(blogName: string, options: SourceStatOptions): Promise<PaymentSourcesResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/stat/${blogName}/payments/analytics`, {
            params: sourceParams(options),
        });
        return new PaymentSourcesResponse(json);
    }

    /**
     * Referral programme totals.
     * @verified GET /v1/blog/referral/{blog}/stat/ (live 200 on the owner's blog)
     */
    async referrals(blogName: string): Promise<ReferralStats> {
        return new ReferralStats(await this.core.request("GET", apiPath`/v1/blog/referral/${blogName}/stat/`));
    }

    /**
     * Users brought in by the referral programme.
     * @verified GET /v1/blog/referral/{blog}/user/ (live 200 on the owner's blog; the list was empty)
     */
    async referralUsers(
        blogName: string,
        options: { limit?: number; offset?: number | string; onlyBloggers?: boolean } = {}
    ): Promise<ReferralUsersResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/referral/${blogName}/user/`, {
            params: { limit: options.limit, offset: options.offset, only_bloggers: options.onlyBloggers },
        });
        return new ReferralUsersResponse(json);
    }

    /**
     * Search among the blog's subscribers.
     * @verified GET /v1/blog/stat/{blog}/search (live 200 on the owner's blog; no match, so rows are untyped)
     * @param chunk the search string, at least 3 characters: shorter or missing answers 400 invalid_param.
     */
    async searchUsers(blogName: string, chunk: string, options: { limit?: number } = {}): Promise<StatSearchResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/stat/${blogName}/search`, {
            params: { chunk, limit: options.limit },
        });
        return new StatSearchResponse(json);
    }

    /**
     * Statistics of one post.
     * @experimental GET /v1/blog/stat/{blog}/post/{postId} — from the web client; the owner had no posts, an unknown post is 404.
     */
    async post(blogName: string, postId: string): Promise<PostStat> {
        return new PostStat(await this.core.request("GET", apiPath`/v1/blog/stat/${blogName}/post/${postId}`));
    }

    /**
     * Build a report and return its descriptor (`report.url` is the file link). The server creates the report on this call.
     * @verified GET /v1/blog/stat/{blog}/csv/donations (live 200 on the owner's blog; the body is JSON, not CSV)
     * @param options.from period start, unix seconds.
     * @param options.period period name, for example "month".
     */
    async report(
        blogName: string,
        type: ReportType,
        options: { separator?: string; from?: number; to?: number; period?: string } = {}
    ): Promise<StatReportResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/stat/${blogName}/csv/${type}`, {
            params: { separator: options.separator, from: options.from, to: options.to, period: options.period },
        });
        return new StatReportResponse(json);
    }

    /**
     * The last generated report of a type, `report` is null when there is none.
     * @verified GET /v1/blog/stat/{blog}/csv/{type}/info (live 200 for donations, subscriptions, holds, payouts)
     */
    async reportInfo(blogName: string, type: ReportType): Promise<StatReportResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/stat/${blogName}/csv/${type}/info`);
        return new StatReportResponse(json);
    }
}

function sourceParams(o: SourceStatOptions) {
    return {
        type: o.type,
        period: o.period,
        limit: o.limit,
        offset: o.offset,
        order: o.order ?? "gt",
        sort_by: o.sortBy,
        timestamp: o.timestamp,
    };
}
