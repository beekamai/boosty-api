import { BaseObject } from "./base";
import { BaseUser } from "./users";
import { SubscriptionLevel } from "./subscription";
import { DonationInfo } from "./messaging";

/** An event of the notification feed (GET /v1/notification/standalone/event/). */
export class Notification extends BaseObject {
    declare id: number;
    /** For example "subscriber_new" or "donation_new". */
    declare type: string;
    /** Unix time, seconds. */
    declare eventTime?: number;
    declare isRead?: boolean;
    declare isFeePaid?: boolean;
    declare author?: BaseUser;
    declare aggregation?: { id: number; type: string };
    /** Present on subscription events. */
    declare subscriptionLevel?: SubscriptionLevel;
    /** Present on donation events ("donation_new"). */
    declare donation?: DonationInfo;

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.author) this.author = new BaseUser(data.author);
        if (data.subscriptionLevel) this.subscriptionLevel = new SubscriptionLevel(data.subscriptionLevel);
        if (data.donation) this.donation = new DonationInfo(data.donation);
    }
}

export interface NotificationCount {
    total: number;
    unread: number;
}

/**
 * The notification feed. The API wraps it as `{ data: { notificationStandalone: { events, count, updateTime } } }`;
 * the feed fields are lifted to the top level.
 */
export class NotificationsResponse extends BaseObject {
    declare events: Notification[];
    declare count?: NotificationCount & { byEventType?: (NotificationCount & { type: string })[] };
    /** Unix time, seconds. */
    declare updateTime?: number;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        const feed = data?.data?.notificationStandalone ?? {};
        this.events = (Array.isArray(feed.events) ? feed.events : []).map((e: any) => new Notification(e));
        if (feed.count) this.count = feed.count;
        if (feed.updateTime !== undefined) this.updateTime = feed.updateTime;
    }
}
