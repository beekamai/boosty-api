import { BaseObject } from "./base";
import { BlogUser } from "./users";
import { Currency } from "./subscription";

/** Blog profile (GET /v1/blog/{blog}). */
export class BlogProfile extends BaseObject {
    declare blogUrl: string;
    declare title?: string;
    declare owner?: BlogUser;
    declare hasAccess?: boolean;
    declare isSubscribed?: boolean;
    declare subscriptionKind?: string;
    declare signedQuery?: string;
    declare flags?: Record<string, boolean>;
    declare count?: { posts?: number; subscribers?: number; comments?: number };
    declare currencyPrices?: Currency;
    declare isOwner?: boolean;
    declare coverUrl?: string;
    declare description?: any[];

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.owner) this.owner = new BlogUser(data.owner);
    }
}
