import { BaseObject } from "./base";
import { Commentator } from "./users";
import { Reactions, Reacted, ReactionCounter } from "./reactions";
import type { ContentItem } from "./content";

/** Reply to a comment. */
export class Reply extends BaseObject {
    declare id: string;
    declare intId?: number;
    /** Unix time, seconds. */
    declare createdAt?: number;
    declare updatedAt?: number;
    declare isUpdated?: boolean;
    declare isBlocked?: boolean;
    declare isDeleted?: boolean;
    declare author?: Commentator;
    declare reactions?: Reactions;
    declare reactionCounters?: ReactionCounter[];
    declare reacted?: Reacted;
    declare replyCount?: number;
    declare post?: { id: string };
    declare data?: ContentItem[];
    declare replyToUser?: Commentator;
    declare replyId?: number;
    declare parentId?: number;
}

export class RepliesResponseExtra extends BaseObject {
    declare isLast?: boolean;
    declare isFirst?: boolean;
}

export class RepliesResponse extends BaseObject {
    declare data: Reply[];
    declare extra: RepliesResponseExtra;

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((r: any) => new Reply(r));
        this.extra = new RepliesResponseExtra(data.extra ?? {});
    }
}

/** Comment on a post. */
export class Comment extends BaseObject {
    declare id: string;
    declare intId?: number;
    /** Unix time, seconds. */
    declare createdAt?: number;
    declare updatedAt?: number;
    declare isUpdated?: boolean;
    declare isBlocked?: boolean;
    declare isDeleted?: boolean;
    declare author?: Commentator;
    declare reactions?: Reactions;
    declare reactionCounters?: ReactionCounter[];
    declare reacted?: Reacted;
    declare replyCount?: number;
    declare replies?: RepliesResponse;
    declare post?: { id: string };
    declare data?: ContentItem[];

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.replies) this.replies = new RepliesResponse(data.replies);
    }
}

export class CommentsResponseExtra extends BaseObject {
    declare isLast?: boolean;
    declare isFirst?: boolean;
}

export class CommentsResponse extends BaseObject {
    declare data: Comment[];
    declare extra: CommentsResponseExtra;

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((c: any) => new Comment(c));
        this.extra = new CommentsResponseExtra(data.extra ?? {});
    }
}
