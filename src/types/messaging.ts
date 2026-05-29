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

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.chatmate) this.chatmate = new Chatmate(data.chatmate);
        if (data.lastMessage) this.lastMessage = new Message(data.lastMessage);
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
