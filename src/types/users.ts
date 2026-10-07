import { BaseObject } from "./base";

export class BaseUser extends BaseObject {
    declare id: number;
    declare name: string;
    declare hasAvatar?: boolean;
    declare avatarUrl?: string;
    declare isVerifiedStreamer?: boolean;
    declare isOfficial?: boolean;
    /** The user's currency, for example "RUB". */
    declare currency?: string;
}

export class BlogUser extends BaseUser {
    declare blogUrl: string;
    declare flags?: Record<string, boolean>;
}

export class Voter extends BaseUser {
    declare vkplayProfileLink?: string;
}

export class DonatorUser extends Voter {
    declare email?: string;
}

export class Commentator extends BaseUser {
    declare nickColor?: number;
    declare displayName?: string;
    declare vkplayProfileLink?: string;
}

/** Currently authenticated user (GET /v1/user/current). */
export class CurrentUser extends BaseUser {
    declare email?: string;
    declare blogUrl?: string;
    declare isBlogger?: boolean;
    declare blog?: { url: string; [key: string]: any };
    declare locale?: string;
    declare timezone?: number;
    declare defaultCurrency?: string;
    /* The API spells one key `candSendPayers` (sic), though the update call takes `can_send_payers`. */
    declare dialogSettings?: { sendMsgLevelId?: number; canSendAll?: boolean; [key: string]: any };
    /** Notification switches: `{ newComment: { mail, telegram, standalone, mobile_push } }`. */
    declare notifications?: Record<string, Record<string, boolean>>;
}
