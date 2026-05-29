import { BaseObject } from "./base";

/** Request body for updating deferred access to a post. */
export class EditedDeferredAccess extends BaseObject {
    declare isCommentsDenied: boolean;
    declare price: number;
    declare applyTime: number;
}

export class DeferredAccess extends EditedDeferredAccess {
    declare post?: { id: string };
}

export class DeferredAccessResponse extends BaseObject {
    declare data: DeferredAccess;

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = new DeferredAccess(data.data ?? {});
    }
}
