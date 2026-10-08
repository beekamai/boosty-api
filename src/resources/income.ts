/* resources/income.ts — the blog owner's billing: sales, donations, holds, payouts. */
import { BaseResource, apiPath, commaList } from "../http";
import {
    BroadcastMessageStatsResponse,
    BundleSalesResponse,
    DefaultCurrency,
    DonationSalesResponse,
    HoldsResponse,
    Payout,
    PayoutHistoryResponse,
    PayoutMethod,
    PostSalesResponse,
    SalesSeries,
} from "../types/income";

export type SaleType = "subscription" | "donation" | "purchase" | "single" | "all";

/** Sort key of the sales lists. */
export type SalesSortBy = "time" | "amount";
/** Sort direction of the sales lists: "gt" newest or largest first, "lt" oldest or smallest first (checked live). */
export type SalesOrder = "gt" | "lt";

/** Paging and sorting shared by the sales lists. `offset` is the cursor from the previous page's `extra.offset`. */
export interface SalesListOptions {
    limit?: number;
    offset?: number | string;
    sortBy?: SalesSortBy;
    order?: SalesOrder;
}

/** The web client sends offsets as strings. */
function cursor(offset: number | string | undefined): string | undefined {
    return offset == null ? undefined : String(offset);
}

function salesQuery(options: SalesListOptions) {
    return { limit: options.limit, offset: cursor(options.offset), sort_by: options.sortBy, order: options.order };
}

export class IncomeResource extends BaseResource {
    /**
     * Feed of the author's financial operations (subscriptions, donations, one-time purchases).
     * The type of each operation is in its own field, which allows separating donations from subscription payments.
     *
     * @deprecated The web client does not use this endpoint. Use `postSales`, `donations`, `bundleSales`,
     *   `holds` and `payoutHistory` instead.
     * @verified path POST /v1/stat/sales/ exists; body is ONLY form-urlencoded
     *   (JSON → 415 invalid_content_type). The endpoint is bound to the account, not the blog.
     * @remarks If the monetization/statistics section is not activated for the account, Boosty
     *   responds 404 `{"error":"not_found","error_description":"Category disabled"}`.
     *   This is a server-side access flag — enabled in the author's dashboard (verification/monetization),
     *   it cannot be bypassed in code. Observed on a real blog: the path is alive, the category is disabled.
     */
    async sales(
        options: { type?: SaleType; limit?: number; offset?: string; period?: string } = {}
    ): Promise<any> {
        return this.core.request("POST", "/v1/stat/sales/", {
            form: {
                type: options.type,
                limit: options.limit,
                offset: options.offset,
                period: options.period,
            },
        });
    }

    /**
     * Paid post sales of the blog. Pass `postIds` to restrict to your own post ids.
     * @verified GET /v1/blog/{blog}/sales/post/ (live 200 on the owner's blog; empty list there, so item fields are untyped)
     */
    async postSales(
        blogUrl: string,
        options: SalesListOptions & { postIds?: (number | string)[] } = {}
    ): Promise<PostSalesResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/sales/post/`, {
            params: { ...salesQuery(options), post_ids: commaList(options.postIds) },
        });
        return new PostSalesResponse(json ?? {});
    }

    /**
     * Donations received by the blog, with the donor and amount.
     * `type` narrows by what the donation was attached to (live values: "post", "dialog"; others answer 400);
     * `targetId` narrows to one post or dialog.
     * @verified GET /v1/blog/{blog}/sales/donation/ (live 200 on the owner's blog)
     */
    async donations(
        blogUrl: string,
        options: SalesListOptions & { type?: string; targetId?: number } = {}
    ): Promise<DonationSalesResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/sales/donation/`, {
            params: { ...salesQuery(options), type: options.type, target_id: options.targetId },
        });
        return new DonationSalesResponse(json ?? {});
    }

    /**
     * Paid bundle sales of the blog. Pass `bundleIds` to restrict to your own bundle ids.
     * @verified GET /v1/blog/{blog}/sales/bundle/ (live 200 on the owner's blog; empty list there, so item fields are untyped)
     */
    async bundleSales(
        blogUrl: string,
        options: SalesListOptions & { bundleIds?: (number | string)[] } = {}
    ): Promise<BundleSalesResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/sales/bundle/`, {
            params: { ...salesQuery(options), bundle_ids: commaList(options.bundleIds) },
        });
        return new BundleSalesResponse(json ?? {});
    }

    /**
     * Payments the platform is still holding before they reach the balance.
     * @verified GET /v1/blog/{blog}/sales/hold/ (live 200 on the owner's blog; empty list there, so item fields are untyped)
     */
    async holds(blogUrl: string, options: { limit?: number; offset?: number | string } = {}): Promise<HoldsResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/sales/hold/`, {
            params: { limit: options.limit, offset: cursor(options.offset) },
        });
        return new HoldsResponse(json ?? {});
    }

    /**
     * Statistics of paid mass mailings to dialogs: sent, viewed, sold, earned.
     * @verified GET /v1/blog/{blog}/sales/dialog_broadcast_message/ (live 200 on the owner's blog)
     */
    async broadcastSales(
        blogUrl: string,
        options: { limit?: number; offset?: number | string } = {}
    ): Promise<BroadcastMessageStatsResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/sales/dialog_broadcast_message/`, {
            params: { limit: options.limit, offset: cursor(options.offset) },
        });
        return new BroadcastMessageStatsResponse(json ?? {});
    }

    /**
     * Paid post sales within a time range. `from` and `to` are unix seconds and both are required.
     * @verified GET /v1/blog/{blog}/post/paid/by_date (live 200 on the owner's blog; empty there, so items are untyped; no params → 400)
     */
    async postSalesByDate(blogUrl: string, from: number, to: number): Promise<SalesSeries> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/post/paid/by_date`, {
            params: { from, to },
        });
        return new SalesSeries(json ?? {});
    }

    /**
     * Days of one month that have paid post sales. `date` is a unix timestamp in seconds inside the month
     * (an ISO string is rejected with 400, milliseconds with 500).
     * @verified GET /v1/blog/{blog}/post/paid/days (live 200 on the owner's blog; empty there, so items are untyped; no date → 400)
     */
    async postSalesDays(blogUrl: string, date: number): Promise<SalesSeries> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/post/paid/days`, {
            params: { date },
        });
        return new SalesSeries(json ?? {});
    }

    /**
     * Paid bundle sales within a time range. `from` and `to` are unix seconds and both are required.
     * @verified GET /v1/blog/{blog}/bundle/paid/by_date (live 200 on the owner's blog; empty there, so items are untyped)
     */
    async bundleSalesByDate(blogUrl: string, from: number, to: number): Promise<SalesSeries> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/bundle/paid/by_date`, {
            params: { from, to },
        });
        return new SalesSeries(json ?? {});
    }

    /**
     * Days of one month that have paid bundle sales. `date` is a unix timestamp in seconds inside the month.
     * @verified GET /v1/blog/{blog}/bundle/paid/days (live 200 on the owner's blog; empty there, so items are untyped)
     */
    async bundleSalesDays(blogUrl: string, date: number): Promise<SalesSeries> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/bundle/paid/days`, {
            params: { date },
        });
        return new SalesSeries(json ?? {});
    }

    /**
     * Payout systems the platform offers (system, currency).
     * @verified GET /v1/payout/methods (live 200 on the owner's blog)
     */
    async payoutMethods(): Promise<PayoutMethod[]> {
        const json = await this.core.request("GET", "/v1/payout/methods");
        const list = json?.payoutMethods;
        return Array.isArray(list) ? list.filter((x: any) => x && typeof x === "object").map((m: any) => new PayoutMethod(m)) : [];
    }

    /**
     * Payout destinations bound to the blog, with their priority, active flag and last payout status.
     * `destination` holds the owner's private payout details.
     * @verified GET /v1/blog/{blog}/payout/ (live 200 on the owner's blog)
     */
    async payouts(blogUrl: string): Promise<Payout[]> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/payout/`);
        return Array.isArray(json?.data) ? json.data.filter((x: any) => x && typeof x === "object").map((p: any) => new Payout(p)) : [];
    }

    /**
     * History of payouts to the owner, page by page.
     * @verified GET /v1/blog/{blog}/payout/history/ (live 200 on the owner's blog)
     */
    async payoutHistory(
        blogUrl: string,
        options: { limit?: number; offset?: number | string } = {}
    ): Promise<PayoutHistoryResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogUrl}/payout/history/`, {
            params: { limit: options.limit, offset: cursor(options.offset) },
        });
        return new PayoutHistoryResponse(json ?? {});
    }

    /**
     * Default currency the platform picks for a guest. Sent anonymously on purpose: with a session the
     * endpoint answers 400 `bad_data`, and the web client only calls it for guests.
     * @verified GET /v1/payment/default_currency (live 200 anonymous; 400 bad_data with a session)
     */
    async defaultCurrency(): Promise<DefaultCurrency> {
        const json = await this.core.request("GET", "/v1/payment/default_currency", { anon: true });
        return new DefaultCurrency(json ?? {});
    }
}
