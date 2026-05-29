/* resources/social.ts — social actions: post likes, poll voting. */
/* The whole module is @experimental: paths reconstructed from the web client, need verification on traffic. */
import { BaseResource } from "../http";

export class SocialResource extends BaseResource {
    /**
     * Like a post.
     * @experimental PUT /v1/blog/{blog}/post/{postId}/like
     */
    async likePost(blogName: string, postId: string): Promise<unknown> {
        return this.core.request("PUT", `/v1/blog/${blogName}/post/${postId}/like`);
    }

    /**
     * Remove a like from a post.
     * @experimental DELETE /v1/blog/{blog}/post/{postId}/like
     */
    async unlikePost(blogName: string, postId: string): Promise<true> {
        await this.core.request("DELETE", `/v1/blog/${blogName}/post/${postId}/like`);
        return true;
    }

    /**
     * Vote for an option in a poll.
     * @experimental PUT /v1/blog/{blog}/poll/{pollId}/answer/{optionId}
     *   For multiple choice, call several times. Verify the exact path on traffic.
     */
    async voteOption(blogName: string, pollId: number | string, optionId: number | string): Promise<unknown> {
        return this.core.request("PUT", `/v1/blog/${blogName}/poll/${pollId}/answer/${optionId}`);
    }

    /**
     * Withdraw a vote for an option in a poll.
     * @experimental DELETE /v1/blog/{blog}/poll/{pollId}/answer/{optionId}
     */
    async removeVote(blogName: string, pollId: number | string, optionId: number | string): Promise<true> {
        await this.core.request("DELETE", `/v1/blog/${blogName}/poll/${pollId}/answer/${optionId}`);
        return true;
    }
}
