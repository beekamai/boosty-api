/* resources/blog.ts — blog: profile, subscribers, subscription levels, blacklist. */
import { BaseResource } from "../http";
import { BlogProfile } from "../types/blog";
import { SubscribersResponse } from "../types/subscriber";
import { SubscriptionLevelsResponse } from "../types/subscription";
import { BlacklistResponse } from "../types/blacklist";

export interface SubscribersOptions {
    /** Sort field, e.g. "on_time". */
    sortBy?: string;
    /** Direction: "gt" | "lt". */
    order?: string;
    limit?: number;
    offset?: string;
    /** Active subscribers only. */
    withFollowers?: boolean;
}

export class BlogResource extends BaseResource {
    /**
     * Blog profile.
     * @verified GET /v1/blog/{blog} (confirmed by a live 200 response).
     */
    async profile(blogName: string): Promise<BlogProfile> {
        const json = await this.core.request("GET", `/v1/blog/${blogName}`);
        return new BlogProfile(json);
    }

    /**
     * Blog subscribers (requires blog owner permissions).
     * @verified GET /v1/blog/{blog}/subscribers (used in the original demo)
     */
    async subscribers(blogName: string, options: SubscribersOptions = {}): Promise<SubscribersResponse> {
        const json = await this.core.request("GET", `/v1/blog/${blogName}/subscribers`, {
            params: {
                sort_by: options.sortBy,
                order: options.order,
                limit: options.limit,
                offset: options.offset,
                with_follow: options.withFollowers,
            },
        });
        return new SubscribersResponse(json);
    }

    /**
     * Blog subscription levels.
     * @verified GET /v1/blog/{blog}/subscription_level/ (confirmed by a live 200 response).
     */
    async subscriptionLevels(
        blogName: string,
        options: { showFreeLevel?: boolean } = {}
    ): Promise<SubscriptionLevelsResponse> {
        const json = await this.core.request("GET", `/v1/blog/${blogName}/subscription_level/`, {
            params: { show_free_level: options.showFreeLevel },
        });
        return new SubscriptionLevelsResponse(json);
    }

    /**
     * Users in the blog blacklist.
     * @verified GET /v1/blacklist/?blog_url={blog}
     */
    async blacklist(blogName: string): Promise<BlacklistResponse> {
        const json = await this.core.request("GET", `/v1/blacklist/`, {
            params: { blog_url: blogName },
        });
        return new BlacklistResponse(json);
    }
}
