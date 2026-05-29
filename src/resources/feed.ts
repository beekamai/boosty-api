/* resources/feed.ts — general feed and search. */
import { BaseResource } from "../http";
import { PostsResponse } from "../types/post";

export class FeedResource extends BaseResource {
    /**
     * Personal post feed (based on the user's subscriptions). Requires authorization.
     * @verified GET /v1/feed/post/ (confirmed by a live 200 response).
     *   The response has the shape `{ data: { posts, blogs, counters }, extra }` — we normalize it to PostsResponse,
     *   extracting `data.posts`. The raw `blogs`/`counters` are available via `feed.postsRaw()`.
     */
    async posts(options: { limit?: number; offset?: string; onlyAllowed?: boolean } = {}): Promise<PostsResponse> {
        const json = await this.postsRaw(options);
        return new PostsResponse({ data: json?.data?.posts ?? [], extra: json?.extra });
    }

    /** Raw feed response `{ data: { posts, blogs, counters }, extra }`. @verified */
    async postsRaw(options: { limit?: number; offset?: string; onlyAllowed?: boolean } = {}): Promise<any> {
        return this.core.request("GET", `/v1/feed/post/`, {
            params: {
                limit: options.limit,
                offset: options.offset,
                only_allowed: options.onlyAllowed,
            },
        });
    }

    /**
     * Search blogs. Requires authorization.
     * @verified GET /v1/search/blog/ — parameters verified on the live API:
     *   `search_query` and `limit` are required (responds 401 anonymously).
     */
    async searchBlogs(query: string, options: { limit?: number; offset?: string } = {}): Promise<unknown> {
        return this.core.request("GET", `/v1/search/blog/`, {
            params: { search_query: query, limit: options.limit ?? 10, offset: options.offset },
        });
    }
}
