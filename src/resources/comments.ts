/* resources/comments.ts — comments and replies. */
import { BaseResource } from "../http";
import { Comment, CommentsResponse, RepliesResponse } from "../types/comment";

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
        const json = await this.core.request("GET", `/v1/blog/${blogName}/post/${postId}/comment/`, {
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
     * @experimental GET /v1/blog/{blog}/post/{postId}/comment/{commentId}/reply/ — verify on traffic.
     */
    async replies(
        blogName: string,
        postId: string,
        commentId: number | string,
        options: { offset?: string; limit?: number; order?: string } = {}
    ): Promise<RepliesResponse> {
        const json = await this.core.request(
            "GET",
            `/v1/blog/${blogName}/post/${postId}/comment/${commentId}/reply/`,
            { params: { offset: options.offset, limit: options.limit, order: options.order } }
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
        const json = await this.core.request("POST", `/v1/blog/${blogName}/post/${postId}/comment/`, {
            form: {
                data: JSON.stringify(data),
                reply_to_id: options.replyToId,
                reply_id: options.replyId,
            },
        });
        return new Comment(json);
    }

    /**
     * Like a comment.
     * @experimental PUT /v1/blog/{blog}/post/{postId}/comment/{commentId}/like
     */
    async like(blogName: string, postId: string, commentId: number | string): Promise<unknown> {
        return this.core.request("PUT", `/v1/blog/${blogName}/post/${postId}/comment/${commentId}/like`);
    }

    /**
     * Remove a like from a comment.
     * @experimental DELETE /v1/blog/{blog}/post/{postId}/comment/{commentId}/like
     */
    async unlike(blogName: string, postId: string, commentId: number | string): Promise<true> {
        await this.core.request("DELETE", `/v1/blog/${blogName}/post/${postId}/comment/${commentId}/like`);
        return true;
    }
}
