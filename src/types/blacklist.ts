import { BaseObject } from "./base";
import { BaseUser } from "./users";

export class BlacklistedUser extends BaseUser {
    declare blacklistedAt?: number;
}

export class BlacklistResponse extends BaseObject {
    declare data: BlacklistedUser[];

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((u: any) => new BlacklistedUser(u));
    }
}
