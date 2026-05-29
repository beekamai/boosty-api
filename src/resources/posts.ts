/* resources/posts.ts — blog posts (CRUD) and deferred access. */
/* Statuses: list/get/comments — @verified (present in the barsikus007/boosty reference). */
/*           create/update/delete/deferred_access — @verified by paths, write body @experimental. */
import { BaseResource } from "../http";
import { Post, PostsResponse, type EditedPost, type NewPost } from "../types/post";
import {
    DeferredAccess,
    DeferredAccessResponse,
    type EditedDeferredAccess,
} from "../types/deferred-access";

export interface ListPostsOptions {
    limit?: number;
    offset?: string;
    commentsLimit?: number;
    replyLimit?: number;
    fromTs?: number;
    toTs?: number;
    levelId?: number;
    /** Comma-separated list of tag ids. */
    tagsIds?: string;
}

export class PostsResource extends BaseResource {
    /**
     * List of blog posts.
     * @verified GET /v1/blog/{blog}/post/
     */
    async list(blogName: string, options: ListPostsOptions = {}): Promise<PostsResponse> {
        const json = await this.core.request("GET", `/v1/blog/${blogName}/post/`, {
            params: {
                limit: options.limit,
                offset: options.offset,
                comments_limit: options.commentsLimit,
                reply_limit: options.replyLimit,
                from_ts: options.fromTs,
                to_ts: options.toTs,
                level_id: options.levelId,
                tags_ids: options.tagsIds,
            },
        });
        return new PostsResponse(json);
    }

    /**
     * A single post (with comments).
     * @verified GET /v1/blog/{blog}/post/{postId}
     */
    async get(
        blogName: string,
        postId: string,
        options: { commentsLimit?: number; replyLimit?: number } = {}
    ): Promise<Post> {
        const json = await this.core.request("GET", `/v1/blog/${blogName}/post/${postId}`, {
            params: { comments_limit: options.commentsLimit, reply_limit: options.replyLimit },
        });
        return new Post(json);
    }

    /**
     * Create a post.
     * @verified path POST /v1/blog/{blog}/post/
     * @experimental body format (form + JSON fields data/teaser_data) — verify on live traffic.
     */
    async create(blogName: string, newPost: NewPost): Promise<Post> {
        const json = await this.core.request("POST", `/v1/blog/${blogName}/post/`, {
            form: this.buildPostForm(newPost, true),
        });
        return new Post(json);
    }

    /**
     * Update a post.
     * @verified path PUT /v1/blog/{blog}/post/{postId}
     * @experimental body format — see create().
     */
    async update(blogName: string, postId: string, editedPost: EditedPost): Promise<Post> {
        const json = await this.core.request("PUT", `/v1/blog/${blogName}/post/${postId}`, {
            form: this.buildPostForm(editedPost, false),
        });
        return new Post(json);
    }

    /**
     * Delete a post.
     * @verified DELETE /v1/blog/{blog}/post/{postId}
     */
    async delete(blogName: string, postId: string): Promise<true> {
        await this.core.request("DELETE", `/v1/blog/${blogName}/post/${postId}`);
        return true;
    }

    /**
     * Get the deferred access settings of a post.
     * @verified GET /v1/blog/{blog}/post/{postId}/deferred_access
     */
    async getDeferredAccess(blogName: string, postId: string): Promise<DeferredAccessResponse> {
        const json = await this.core.request(
            "GET",
            `/v1/blog/${blogName}/post/${postId}/deferred_access`
        );
        return new DeferredAccessResponse(json);
    }

    /**
     * Update the deferred access settings of a post.
     * @verified PUT /v1/blog/{blog}/post/{postId}/deferred_access
     */
    async updateDeferredAccess(
        blogName: string,
        postId: string,
        edited: EditedDeferredAccess
    ): Promise<DeferredAccess> {
        const json = await this.core.request(
            "PUT",
            `/v1/blog/${blogName}/post/${postId}/deferred_access`,
            { json: { ...edited } }
        );
        return new DeferredAccess(json?.data ?? json);
    }

    /** Builds the post body for a form request: complex fields are serialized into JSON strings. */
    private buildPostForm(p: EditedPost | NewPost, isNew: boolean): Record<string, unknown> {
        const form: Record<string, unknown> = {
            title: p.title,
            data: JSON.stringify(p.data ?? []),
            price: p.price,
            teaser_data: JSON.stringify(p.teaser_data ?? []),
            tags: p.tags,
            deny_comments: p.deny_comments,
            wait_video: p.wait_video,
            publish_time: p.publish_time,
            advertiser_info: p.advertiser_info,
        };
        if (isNew) form.has_chat = (p as NewPost).has_chat;
        return form;
    }
}
