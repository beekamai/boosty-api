import { BaseObject } from "./base";
import { BlogUser } from "./users";
import type { ContentItem } from "./content";

/** Blog profile (GET /v1/blog/{blog}). */
export class BlogProfile extends BaseObject {
    declare blogUrl: string;
    declare title?: string;
    declare owner?: BlogUser;
    declare isSubscribed?: boolean;
    declare subscriptionKind?: string;
    declare signedQuery?: string;
    declare flags?: Record<string, boolean>;
    declare count?: { posts?: number; subscribers?: number; showcase?: number };
    declare currency?: string;
    declare accessRights?: Record<string, boolean>;
    declare socialLinks?: { type: string; url: string }[];
    declare isOwner?: boolean;
    declare coverUrl?: string;
    declare description?: ContentItem[];

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.owner) this.owner = new BlogUser(data.owner);
    }
}

/** Blog search result (GET /v1/search/blog/). */
export interface SearchBlogsResponse {
    data: { searchBlogs: { rank: number; blog: BlogProfile }[] };
    extra: { offset: string; isLast: boolean };
}
