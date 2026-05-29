import { BaseObject } from "./base";
import { DonatorUser } from "./users";

export class Donator extends BaseObject {
    declare id?: number;
    declare bloggerId?: number;
    declare targetId?: number;
    declare createdAt?: string;
    declare user?: DonatorUser;
    declare amount?: number;
    declare type?: string;
    declare isFeePaid?: boolean;

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.user) this.user = new DonatorUser(data.user);
    }
}

export class DonatorsResponseExtra extends BaseObject {
    declare isLast?: boolean;
    declare offset?: number;
}

export class DonatorsResponse extends BaseObject {
    declare data: Donator[];
    declare extra?: DonatorsResponseExtra;

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((d: any) => new Donator(d));
        if (data.extra) this.extra = new DonatorsResponseExtra(data.extra);
    }
}
