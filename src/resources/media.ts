/* resources/media.ts — blog media feed (photo/video/audio). */
import { BaseResource } from "../http";
import { MediaPostsResponse } from "../types/media";

/** Media type. Verified on the live API: image and all are accepted; limit_by is required. */
export type MediaType = "image" | "all" | "ok_video" | "audio_file";

export class MediaResource extends BaseResource {
    /**
     * Blog media feed (media aggregated from posts).
     * @verified GET /v1/blog/{blog}/media_album/?type=...&limit_by=media
     *   Empirically: the `type` (image|all) and `limit_by=media` parameters are required,
     *   otherwise the API responds 400 invalid_param. The media_post/media_posts paths do not exist (404).
     */
    async list(
        blogName: string,
        options: { type?: MediaType; limit?: number; offset?: string } = {}
    ): Promise<MediaPostsResponse> {
        const json = await this.core.request("GET", `/v1/blog/${blogName}/media_album/`, {
            params: {
                type: options.type ?? "all",
                limit_by: "media",
                limit: options.limit,
                offset: options.offset,
            },
        });
        return new MediaPostsResponse(json);
    }
}
