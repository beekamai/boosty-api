import { BaseObject } from "./base";
import { BaseUser } from "./users";

/**
 * Blog subscriber (GET /v1/blog/{blog}/subscribers). Fields verified against a live response:
 * payments — total paid by the subscriber over all time; price — current tier price;
 * onTime — subscription start date (unix sec); nextPayTime — next charge date;
 * status — "active" etc.; level — tier object (name/price/currencyPrices/...).
 */
export class Subscriber extends BaseUser {
    declare email?: string;
    declare payments?: number;
    declare price?: number;
    declare status?: string;
    declare subscribed?: boolean;
    declare onTime?: number;
    declare nextPayTime?: number;
    declare isFeePaid?: boolean;
    declare isOfficial?: boolean;
    declare canWrite?: boolean;
    declare isBlackListed?: boolean;
    declare level?: Record<string, any>;
    declare levelId?: number;
}

export class SubscribersResponse extends BaseObject {
    declare data: Subscriber[];
    /** Boosty returns total/offset/limit at the top level (without a nested extra). */
    declare total?: number;
    declare offset?: number | string;
    declare limit?: number;

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((s: any) => new Subscriber(s));
    }
}
