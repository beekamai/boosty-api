import { BaseObject } from "./base";
import { BlogUser } from "./users";
import { Content } from "./content"; // Import Content from content.ts, which now uses Video from media-types
import { CommentsResponse } from "./comment";
import { Currency, SubscriptionLevel, Tag } from "./subscription";
import { Poll } from "./poll";
import { Reactions } from "./reactions";
import { DonatorsResponse } from "./donator";
import { TeaserContent } from "./teaser";
import { Counter } from "./counters";
import { API } from "../client";
import { renderText, Entity } from "../utils/post";

export class Count extends BaseObject {
    declare likes?: number;
    declare comments?: number;
    declare reactions?: Reactions;
    declare views?: number;
}

export class React extends BaseObject {
    declare actor?: string;
}

export class Post extends BaseObject {
    declare id?: string;
    declare createdAt?: string;
    declare updatedAt?: string;
    declare publishTime?: string;
    declare isPublished?: boolean;
    declare user?: BlogUser;
    declare title?: string;
    declare data?: Content[];
    declare contentCounters?: Counter[];
    declare tags?: Tag[];
    declare hasAccess?: boolean;
    declare teaser?: TeaserContent[];
    declare count?: Count;
    declare comments?: CommentsResponse;
    declare isCommentsDenied?: boolean;
    declare isLiked?: boolean;
    declare price?: number;
    declare signedQuery?: string;
    declare subscriptionLevel?: SubscriptionLevel;
    declare poll?: Poll;
    declare advertiserInfo?: string;
    declare reacted?: React;
    declare isWaitingVideo?: boolean;
    declare currencyPrices?: Currency;
    declare isRecord?: boolean;
    declare donators?: DonatorsResponse;
    declare donations?: number | Record<string, any>;
    declare int_id?: number;
    declare isBlocked?: boolean;
    declare isDeleted?: boolean;
    declare showViewsCounter?: boolean;
    declare isPinned?: boolean;
    declare sortOrder?: number;
    declare reactionsDisabled?: boolean;
    declare showcaseStatus?: string;
    declare frame?: Record<string, any> | null;

    constructor(data: Record<string, any> = {}) {
        super(data);
        // Instantiate the nested comment list so its items become Comment models.
        if (data.comments) this.comments = new CommentsResponse(data.comments);
    }

    get url(): string {
        return `https://boosty.to/${this.user?.blogUrl ?? ""}/posts/${this.id ?? ""}`;
    }

    get text(): [string, Entity[]] {
        return renderText(this.data);
    }

    async getComments(
        boostyApi: API,
        offset?: string,
        limit?: number,
        replyLimit?: number,
        order?: string
    ): Promise<CommentsResponse> {
        return boostyApi.getPostComments(this.user?.blogUrl ?? "", this.id ?? "", { offset, limit, replyLimit, order });
    }
}

export class PostsResponseExtra extends BaseObject {
    declare isLast?: boolean;
    declare offset?: string;
}

export class PostsResponse extends BaseObject {
    declare data?: Post[];
    declare extra?: PostsResponseExtra;

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((p: any) => new Post(p));
        if (data.extra) this.extra = new PostsResponseExtra(data.extra);
    }
}

export class EditedPost extends BaseObject {
    title: string = "";
    declare data?: Content[];
    price: number = 300;
    declare teaser_data?: TeaserContent[];
    tags: string = "";
    deny_comments: boolean = false;
    wait_video: boolean = false;
    declare publish_time?: number;
    declare advertiser_info?: string;
}

export class NewPost extends EditedPost {
    has_chat: boolean = false;
}