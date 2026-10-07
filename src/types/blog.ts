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
export class SearchBlogsResponse extends BaseObject {
    declare data: { searchBlogs: { rank: number; blog: BlogProfile }[] };
    declare extra?: { offset?: string; isLast?: boolean };

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        const inner = data?.data && typeof data.data === "object" ? data.data : {};
        const results = inner.searchBlogs;
        this.data = {
            ...inner,
            searchBlogs: (Array.isArray(results) ? results : [])
                .filter((r: any) => r && typeof r === "object")
                .map((r: any) => (r.blog && typeof r.blog === "object" ? { ...r, blog: new BlogProfile(r.blog) } : r)),
        };
    }
}
