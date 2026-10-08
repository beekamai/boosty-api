/* resources/blog.ts — blog: profile, subscribers, subscription levels, blacklist. */
import { BaseResource, apiPath, commaList } from "../http";
import { BlogProfile } from "../types/blog";
import { SubscribersResponse } from "../types/subscriber";
import { SubscriptionLevel, SubscriptionLevelsResponse } from "../types/subscription";
import { Poll, UnsubscribeAnswersResponse, VotersResponse } from "../types/poll";
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
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogName}`);
        return new BlogProfile(json);
    }

    /**
     * Blog subscribers (requires blog owner permissions).
     * @verified GET /v1/blog/{blog}/subscribers (used in the original demo)
     */
    async subscribers(blogName: string, options: SubscribersOptions = {}): Promise<SubscribersResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogName}/subscribers`, {
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
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogName}/subscription_level/`, {
            params: { show_free_level: options.showFreeLevel },
        });
        return new SubscriptionLevelsResponse(json);
    }

    /**
     * One subscription level with its details.
     * @verified GET /v1/blog/{blog}/subscription/level/{levelId} (live 200 on the owner's blog;
     *   withContentCounters adds `count.content` per content type)
     */
    async subscriptionLevel(
        blogName: string,
        levelId: number | string,
        options: { withContentCounters?: boolean } = {}
    ): Promise<SubscriptionLevel> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogName}/subscription/level/${levelId}`, {
            params: { with_content_counters: options.withContentCounters },
        });
        return new SubscriptionLevel(json ?? {});
    }

    /**
     * A poll of the blog.
     * @experimental GET /v1/blog/{blog}/poll/{pollId} — from the web client (no poll was reachable for a live call)
     */
    async poll(blogName: string, pollId: number | string, options: { votersLimit?: number } = {}): Promise<Poll> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogName}/poll/${pollId}`, {
            params: { voters_limit: options.votersLimit },
        });
        return new Poll(json ?? {});
    }

    /**
     * Voters of one poll option.
     * @experimental GET /v1/blog/{blog}/poll/{pollId}/vote/ — from the web client (`option`, `limit`, `offset`)
     */
    async pollVoters(
        blogName: string,
        pollId: number | string,
        options: { option?: number; limit?: number; offset?: number } = {}
    ): Promise<VotersResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogName}/poll/${pollId}/vote/`, {
            params: { option: options.option, limit: options.limit, offset: options.offset },
        });
        return new VotersResponse(json);
    }

    /**
     * Answers to the "why did you unsubscribe" survey (blog owner only).
     * @verified GET /v1/blog/{blog}/unsubscribe_reasons/ (live 200 on the owner's blog; no param is required)
     */
    async unsubscribeReasons(
        blogName: string,
        options: {
            limit?: number;
            offset?: string;
            sortBy?: string;
            order?: string;
            levelIds?: number[];
            answers?: number[];
            from?: number;
            to?: number;
        } = {}
    ): Promise<UnsubscribeAnswersResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogName}/unsubscribe_reasons/`, {
            params: {
                limit: options.limit,
                offset: options.offset,
                sort_by: options.sortBy,
                order: options.order,
                level_ids: commaList(options.levelIds),
                answers: commaList(options.answers),
                from: options.from,
                to: options.to,
            },
        });
        return new UnsubscribeAnswersResponse(json);
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
