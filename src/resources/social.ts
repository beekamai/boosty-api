/* resources/social.ts — social actions: post reactions, poll voting. */
/* The whole module is @experimental: paths and bodies come from the web client, never run live (writes). */
import { BaseResource, apiPath } from "../http";
import type { ReactionName } from "../types/reactions";

export interface VoteOptions {
    /** Free-text answer for polls with "other". */
    other?: string;
    isAnonymous?: boolean;
}

export class SocialResource extends BaseResource {
    /**
     * React to a post with a reaction (see `ReactionName`).
     * @experimental POST /v1/blog/{blog}/post/{postId}/reaction — from the web client
     * @param fromPage optional UI context the web client sends as `from_page`.
     */
    async reactToPost(blogName: string, postId: string, reaction: ReactionName, fromPage?: string): Promise<unknown> {
        return this.core.request("POST", apiPath`/v1/blog/${blogName}/post/${postId}/reaction`, {
            params: { from_page: fromPage },
            form: { reaction },
        });
    }

    /**
     * Remove your reaction from a post.
     * @experimental DELETE /v1/blog/{blog}/post/{postId}/reaction — from the web client
     */
    async removePostReaction(blogName: string, postId: string, fromPage?: string): Promise<true> {
        await this.core.request("DELETE", apiPath`/v1/blog/${blogName}/post/${postId}/reaction`, {
            params: { from_page: fromPage },
        });
        return true;
    }

    /**
     * Like a post.
     * @experimental POST /v1/blog/{blog}/post/{postId}/like — the web client's blogPost.like (earlier versions used PUT).
     */
    async likePost(blogName: string, postId: string, fromPage?: string): Promise<unknown> {
        return this.core.request("POST", apiPath`/v1/blog/${blogName}/post/${postId}/like`, {
            params: { from_page: fromPage },
        });
    }

    /**
     * Remove a like from a post.
     * @experimental DELETE /v1/blog/{blog}/post/{postId}/like — the web client's blogPost.unlike.
     */
    async unlikePost(blogName: string, postId: string, fromPage?: string): Promise<true> {
        await this.core.request("DELETE", apiPath`/v1/blog/${blogName}/post/${postId}/like`, {
            params: { from_page: fromPage },
        });
        return true;
    }

    /**
     * Vote in a poll with one or several options (replaces the earlier vote).
     * @experimental POST /v1/poll/{pollId}/vote — from the web client; `answer` is the comma-joined option ids
     * @throws TypeError if `optionIds` is empty or holds an empty id: an empty answer would be posted as a vote.
     *   Use `removeVote` to withdraw.
     */
    async vote(pollId: number | string, optionIds: (number | string)[], options: VoteOptions = {}): Promise<unknown> {
        if (optionIds.length === 0 || optionIds.some((id) => id === null || id === undefined || id === "")) {
            throw new TypeError("vote needs at least one non-empty option id");
        }
        return this.core.request("POST", apiPath`/v1/poll/${pollId}/vote`, {
            form: { answer: optionIds.join(","), other: options.other, is_anonymous: options.isAnonymous },
        });
    }

    /**
     * Vote for a single option in a poll. Replaces your whole vote: for several options call `vote(pollId, ids)` once.
     * @experimental POST /v1/poll/{pollId}/vote — from the web client
     * @param blogName unused, kept for compatibility: the endpoint does not take the blog.
     */
    async voteOption(blogName: string, pollId: number | string, optionId: number | string): Promise<unknown> {
        return this.vote(pollId, [optionId]);
    }

    /**
     * Withdraw your vote from a poll.
     * @experimental DELETE /v1/poll/{pollId}/vote — from the web client
     * @param blogName unused, kept for compatibility.
     * @param optionId unused, kept for compatibility: the endpoint withdraws the whole vote, not one option.
     */
    async removeVote(blogName: string, pollId: number | string, optionId?: number | string): Promise<true> {
        await this.core.request("DELETE", apiPath`/v1/poll/${pollId}/vote`);
        return true;
    }
}
