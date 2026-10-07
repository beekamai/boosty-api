/* resources/search.ts — search over posts, blogs and tags. Blog search by name: `feed.searchBlogs`. */
import { BaseResource, commaList } from "../http";
import { SearchBlogsResponse } from "../types/blog";
import { SearchPostsResponse, SearchTagsResponse } from "../types/search";

export interface SearchPageOptions {
    /** Required by the API; defaults to 10. */
    limit?: number;
    offset?: string;
}

export interface SearchPostsOptions extends SearchPageOptions {
    onlyAllowed?: boolean;
    /** Unix time, seconds. */
    from?: number;
    /** Unix time, seconds. */
    to?: number;
}

export interface SearchFeedPostsOptions extends SearchPostsOptions {
    onlyBought?: boolean;
    tagIds?: number[];
}

export interface SearchBlogPostsOptions extends SearchPostsOptions {
    subscriptionLevelIds?: number[];
    hasImage?: boolean;
    hasAudioFile?: boolean;
    hasAudio?: boolean;
    /** Boosty-hosted video ("has_ok_video"). */
    hasVideoFile?: boolean;
    hasVideo?: boolean;
    hasFile?: boolean;
}

export class SearchResource extends BaseResource {
    /**
     * Posts of the feed matching the query.
     * @verified GET /v1/search/feed/post/ (live 200; `limit` is required, 400 invalid_param without it)
     */
    async postsInFeed(query: string, options: SearchFeedPostsOptions = {}): Promise<SearchPostsResponse> {
        const json = await this.core.request("GET", "/v1/search/feed/post/", {
            params: {
                search_query: query,
                limit: options.limit ?? 10,
                offset: options.offset,
                only_allowed: options.onlyAllowed ?? false,
                only_bought: options.onlyBought,
                from_ts: options.from,
                to_ts: options.to,
                tags_ids: commaList(options.tagIds),
            },
        });
        return new SearchPostsResponse(json);
    }

    /**
     * Posts of one blog matching the query.
     * @verified GET /v1/search/blog/post/?blog_url= (live 200; `limit` is required, 400 invalid_param without it)
     */
    async postsInBlog(blogName: string, query: string, options: SearchBlogPostsOptions = {}): Promise<SearchPostsResponse> {
        const json = await this.core.request("GET", "/v1/search/blog/post/", {
            params: {
                blog_url: blogName,
                search_query: query,
                limit: options.limit ?? 10,
                offset: options.offset,
                only_allowed: options.onlyAllowed,
                subscription_level: commaList(options.subscriptionLevelIds),
                has_image: options.hasImage,
                has_audio_file: options.hasAudioFile,
                has_audio: options.hasAudio,
                has_ok_video: options.hasVideoFile,
                has_video: options.hasVideo,
                has_file: options.hasFile,
                from_ts: options.from,
                to_ts: options.to,
            },
        });
        return new SearchPostsResponse(json);
    }

    /**
     * Blog suggestions for a partial query (same result shape as `feed.searchBlogs`).
     * @verified GET /v1/search/blog/suggest/ (live 200)
     */
    async blogSuggest(query: string, options: SearchPageOptions = {}): Promise<SearchBlogsResponse> {
        const json = await this.core.request("GET", "/v1/search/blog/suggest/", {
            params: { search_query: query, limit: options.limit ?? 10, offset: options.offset },
        });
        return new SearchBlogsResponse(json);
    }

    /**
     * Feed tags matching the query.
     * @verified GET /v1/search/feed/tag/ (live 200)
     */
    async feedTags(query: string, options: SearchPageOptions = {}): Promise<SearchTagsResponse> {
        const json = await this.core.request("GET", "/v1/search/feed/tag/", {
            params: { search_query: query, limit: options.limit ?? 10, offset: options.offset },
        });
        return new SearchTagsResponse(json);
    }
}
