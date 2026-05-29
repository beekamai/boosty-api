import { BaseObject } from "./base";

/** Notification (GET /v1/notification/). */
export class Notification extends BaseObject {
    declare id: number;
    declare type?: string;
    declare createdAt?: string;
    declare isRead?: boolean;
    declare data?: Record<string, any>;
}

export class NotificationsResponse extends BaseObject {
    declare data: Notification[];
    declare extra?: { isLast?: boolean; offset?: string };

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((n: any) => new Notification(n));
    }
}
