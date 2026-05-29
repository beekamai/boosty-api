import { BaseObject } from "./base";
import { TeaserContent } from "./teaser";

export class Currency extends BaseObject {
    declare USD: number;
    declare RUB: number;
}

export class Tag extends BaseObject {
    declare id: number;
    declare title: string;
}

export class SubscriptionLevel extends BaseObject {
    declare id: number;
    declare price: number;
    declare name?: string;
    declare createdAt?: string;
    declare changePrice?: number;
    declare data?: TeaserContent[];
    declare deleted?: boolean;
    declare isArchived?: boolean;
    declare ownerId?: number;
    declare currencyPrices?: Currency;
    declare promos?: Record<string, any> | any[];
    declare isHidden?: boolean;
    declare isLimited?: boolean;
}

export class SubscriptionLevelsResponse extends BaseObject {
    declare data: SubscriptionLevel[];

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((l: any) => new SubscriptionLevel(l));
    }
}
