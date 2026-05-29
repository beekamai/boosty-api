/* resources/income.ts — author income: feed of sales/donations/subscription payments. */
import { BaseResource } from "../http";

export type SaleType = "subscription" | "donation" | "purchase" | "single" | "all";

export class IncomeResource extends BaseResource {
    /**
     * Feed of the author's financial operations (subscriptions, donations, one-time purchases).
     * The type of each operation is in its own field, which allows separating donations from subscription payments.
     *
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
}
