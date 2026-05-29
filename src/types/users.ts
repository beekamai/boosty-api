import { BaseObject } from "./base";

export class BaseUser extends BaseObject {
    declare id: number;
    declare name: string;
    declare hasAvatar?: boolean;
    declare avatarUrl?: string;
    declare isVerifiedStreamer?: boolean;
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
    declare hasBlog?: boolean;
    declare signalAccessToken?: string;
    declare createdAt?: string;
}
