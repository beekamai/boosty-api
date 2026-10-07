/* types/search.ts — post and tag search results. */
import { BaseObject } from "./base";
import { BlogProfile } from "./blog";
import { Post } from "./post";

/** Matched fragments with highlighting markup, as returned by the search. */
export class SearchHeadline extends BaseObject {
    declare title?: string;
    declare teaser?: string;
    declare data?: string;
    declare tags?: string;
}

export class SearchPostHit extends BaseObject {
    declare post: Post;
    declare blog?: BlogProfile;
    declare rank?: number;
    declare headline?: SearchHeadline;

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.post = new Post(data.post && typeof data.post === "object" ? data.post : {});
        if (data.blog && typeof data.blog === "object") this.blog = new BlogProfile(data.blog);
        if (data.headline && typeof data.headline === "object") this.headline = new SearchHeadline(data.headline);
    }
}

export interface SearchExtra {
    isLast?: boolean;
    offset?: string;
}

/**
 * Post search result. The API wraps it as `{ data: { searchPosts, blogs? }, extra }`;
 * the lists are lifted to `hits` and `blogs`. The feed search also returns the authors' blogs in `blogs`.
 */
export class SearchPostsResponse extends BaseObject {
    declare hits: SearchPostHit[];
    declare blogs: BlogProfile[];
    declare extra?: SearchExtra;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        const inner = data?.data && typeof data.data === "object" ? data.data : {};
        const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
        this.hits = list(inner.searchPosts).map((h: any) => new SearchPostHit(h));
        this.blogs = list(inner.blogs).map((b: any) => new BlogProfile(b));
    }
}

export class FeedTag extends BaseObject {
    declare id: number;
    declare title: string;
}

export class SearchTagHit extends BaseObject {
    declare tag: FeedTag;
    declare rank?: number;

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.tag = new FeedTag(data.tag && typeof data.tag === "object" ? data.tag : {});
    }
}

/** Feed tag search result (`{ data: { searchTags }, extra }`); the list is lifted to `tags`. */
export class SearchTagsResponse extends BaseObject {
    declare tags: SearchTagHit[];
    declare extra?: SearchExtra;

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        const list = data?.data?.searchTags;
        this.tags = (Array.isArray(list) ? list : [])
            .filter((x: unknown) => x && typeof x === "object")
            .map((t: any) => new SearchTagHit(t));
    }
}
