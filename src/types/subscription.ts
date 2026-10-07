import { BaseObject } from "./base";
import { TeaserContent } from "./teaser";

export class Currency extends BaseObject {
    declare RUB: number;
    /** USD and EUR are absent for blogs without foreign currency conversion. */
    declare USD?: number;
    declare EUR?: number;
}

export class Tag extends BaseObject {
    declare id: number;
    declare title: string;
}

export class SubscriptionLevel extends BaseObject {
    declare id: number;
    declare price: number;
    declare name?: string;
    /** Unix time, seconds. */
    declare createdAt?: number;
    declare changePrice?: number;
    declare data?: TeaserContent[];
    declare deleted?: boolean;
    declare isArchived?: boolean;
    declare ownerId?: number;
    declare currencyPrices?: Currency;
    declare promos?: Record<string, any> | any[];
    declare isHidden?: boolean;
    declare isLimited?: boolean;
    /** Duplicates isHidden / isArchived / isLimited. */
    declare flags?: { isHidden?: boolean; isArchived?: boolean; isLimited?: boolean };
    declare count?: { availableSlots?: number };
}

export class SubscriptionLevelsResponse extends BaseObject {
    declare data: SubscriptionLevel[];

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((l: any) => new SubscriptionLevel(l));
    }
}
