/* resources/comments.ts — comments and replies. */
import { BaseResource, apiPath } from "../http";
import { Comment, CommentsResponse, RepliesResponse } from "../types/comment";
import type { ReactionName } from "../types/reactions";

export interface ListCommentsOptions {
    offset?: string;
    limit?: number;
    replyLimit?: number;
    /** For example "top". */
    order?: string;
}

export class CommentsResource extends BaseResource {
    /**
     * List of post comments.
     * @verified GET /v1/blog/{blog}/post/{postId}/comment/
     */
    async list(blogName: string, postId: string, options: ListCommentsOptions = {}): Promise<CommentsResponse> {
        const json = await this.core.request("GET", apiPath`/v1/blog/${blogName}/post/${postId}/comment/`, {
            params: {
                offset: options.offset,
                limit: options.limit,
                reply_limit: options.replyLimit,
                order: options.order,
            },
        });
        return new CommentsResponse(json);
    }

    /**
     * List of replies to a comment.
     * @verified GET /v1/blog/{blog}/post/{postId}/comment/?parent_id={parentIntId}
     *   The comment/{commentId}/reply/ path does not exist (404).
     * @param parentIntId `intId` of the parent comment. Its uuid `id` responds 400 invalid_param.
     */
    async replies(
        blogName: string,
        postId: string,
        parentIntId: number,
        options: { offset?: string; limit?: number; order?: string } = {}
    ): Promise<RepliesResponse> {
        const json = await this.core.request(
            "GET",
            apiPath`/v1/blog/${blogName}/post/${postId}/comment/`,
            { params: { parent_id: parentIntId, offset: options.offset, limit: options.limit, order: options.order } }
        );
        return new RepliesResponse(json);
    }

    /**
     * Create a comment (or a reply if replyToId is passed).
     * @experimental POST /v1/blog/{blog}/post/{postId}/comment/ — verify the body format on traffic.
     * @param data comment content blocks (same as a post: text/link/image/smile).
     */
    async create(
        blogName: string,
        postId: string,
        data: unknown[],
        options: { replyToId?: number; replyId?: number } = {}
    ): Promise<Comment> {
        const json = await this.core.request("POST", apiPath`/v1/blog/${blogName}/post/${postId}/comment/`, {
            form: {
                data: JSON.stringify(data),
                reply_to_id: options.replyToId,
                reply_id: options.replyId,
            },
        });
        return new Comment(json);
    }

    /**
     * React to a comment with a reaction (see `ReactionName`).
     * @experimental POST /v1/blog/{blog}/post/{postId}/comment/{commentId}/reaction — from the web client
     * @param fromPage optional UI context the web client sends as `from_page`.
     */
    async react(
        blogName: string,
        postId: string,
        commentId: number | string,
        reaction: ReactionName,
        fromPage?: string
    ): Promise<unknown> {
        return this.core.request("POST", apiPath`/v1/blog/${blogName}/post/${postId}/comment/${commentId}/reaction`, {
            params: { from_page: fromPage },
            form: { reaction },
        });
    }

    /**
     * Remove your reaction from a comment.
     * @experimental DELETE /v1/blog/{blog}/post/{postId}/comment/{commentId}/reaction — from the web client
     */
    async removeReaction(blogName: string, postId: string, commentId: number | string, fromPage?: string): Promise<true> {
        await this.core.request("DELETE", apiPath`/v1/blog/${blogName}/post/${postId}/comment/${commentId}/reaction`, {
            params: { from_page: fromPage },
        });
        return true;
    }

    /**
     * Like a comment: the "like" reaction (comments have no like endpoint of their own in the web client).
     * @experimental POST /v1/blog/{blog}/post/{postId}/comment/{commentId}/reaction with reaction=like
     */
    async like(blogName: string, postId: string, commentId: number | string): Promise<unknown> {
        return this.react(blogName, postId, commentId, "like");
    }

    /**
     * Remove a like from a comment.
     * @experimental DELETE /v1/blog/{blog}/post/{postId}/comment/{commentId}/reaction
     */
    async unlike(blogName: string, postId: string, commentId: number | string): Promise<true> {
        return this.removeReaction(blogName, postId, commentId);
    }
}
