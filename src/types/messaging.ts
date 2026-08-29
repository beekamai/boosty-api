import { BaseObject } from "./base";
import { BaseUser } from "./users";

/** Conversation partner (the real Boosty response field is `chatmate`, not `user`). */
export class Chatmate extends BaseUser {
    declare isBlogger?: boolean;
    declare isOfficial?: boolean;
    /** Profile URL/identifier (often equals the userId as a string). */
    declare url?: string;
    declare currency?: string;
    declare blogCurrency?: string;
    declare hasAdultContent?: boolean;
    declare acceptedCurrencies?: string[];
}

/**
 * Permissions for a conversation with a user. `canWrite` is the one that matters before writing
 * first: not every subscriber can be messaged (closed DMs, blacklist, donation-gated inbox).
 */
export class DialogRelation extends BaseObject {
    /** Relation kind, e.g. "subscriber". */
    declare type?: string;
    /** We are allowed to write to them. */
    declare canWrite?: boolean;
    /** They are allowed to write to us. */
    declare canWriteMe?: boolean;
    /** Writing requires a donation first. */
    declare needDonation?: boolean;
    declare isBlackListed?: boolean;
    declare isChatmateBlackListed?: boolean;
    declare chatmateRequiresVerificationForPayments?: boolean;
    /** When the relation started (subscription time for subscribers). */
    declare startAt?: number;
}

/** Donation attached to a message in a conversation. */
export class DonationInfo extends BaseObject {
    declare amount: number;
    declare type?: string;
    declare createdAt?: number;
    declare isFeePaid?: boolean;
    declare currencyAmounts?: { RUB?: number; USD?: number; [k: string]: number | undefined };
    declare user?: BaseUser & { email?: string };
}

/** Message in a conversation. */
export class Message extends BaseObject {
    declare id: number;
    declare dialogId?: number;
    declare createdAt?: number | string;
    declare authorId?: number;
    declare author?: BaseUser;
    declare data?: any[];
    declare isRead?: boolean;
    declare isDeleted?: boolean;
    declare isPaid?: boolean;
    declare price?: number;
    /** Present if the message is a donation. */
    declare donation?: DonationInfo;
}

export class MessagesResponseExtra extends BaseObject {
    declare isLast?: boolean;
    declare offset?: string;
}

export class MessagesResponse extends BaseObject {
    declare data: Message[];
    declare extra?: MessagesResponseExtra;

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((m: any) => new Message(m));
        if (data.extra) this.extra = new MessagesResponseExtra(data.extra);
    }
}

/** Conversation (direct messages with a blogger). */
export class Dialog extends BaseObject {
    declare id: number;
    declare chatId?: number;
    /** Conversation partner — the real Boosty response field. */
    declare chatmate?: Chatmate;
    declare lastMessage?: Message;
    /** Unread count (the real field is `unreadMsgCount`; `unreadCount` is an alias kept for compatibility). */
    declare unreadMsgCount?: number;
    declare unreadCount?: number;
    declare isBlocked?: boolean;
    declare createdAt?: number;
    /** Permissions for this conversation. */
    declare relation?: DialogRelation;
    /** Centrifugo channel for live updates. */
    declare wsChannel?: string;
    declare signedQuery?: string;

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.chatmate) this.chatmate = new Chatmate(data.chatmate);
        if (data.lastMessage) this.lastMessage = new Message(data.lastMessage);
        if (data.relation) this.relation = new DialogRelation(data.relation);
    }
}

/**
 * Result of probing a conversation with a user (`GET /v1/dialog?user_id=…`).
 * `id` is present only when the conversation already exists — otherwise it has to be created first.
 */
export class DialogWithUser extends BaseObject {
    declare id?: number;
    declare relation?: DialogRelation;
    declare chatmate?: Chatmate;
    /** Recent messages — returned only for an existing conversation. */
    declare messages?: Message[];
    declare unreadMsgCount?: number;
    declare createdAt?: number;

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.chatmate) this.chatmate = new Chatmate(data.chatmate);
        if (data.relation) this.relation = new DialogRelation(data.relation);
        if (Array.isArray(data.messages)) this.messages = data.messages.map((m: any) => new Message(m));
    }
}

export class DialogsResponse extends BaseObject {
    declare data: Dialog[];
    declare extra?: { isLast?: boolean; offset?: string };

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((d: any) => new Dialog(d));
    }
}
