import { BaseObject } from "./base";
import type { Audio, Image, Video } from "./media-types";
import type { TeaserContent } from "./teaser";

/** Blog media album (GET /v1/blog/{blog}/media_album/). */
export class MediaAlbum extends BaseObject {
    declare id: number;
    declare title?: string;
    declare count?: number;
    declare previewUrls?: string[];
    declare createdAt?: string;
}

export class MediaAlbumsResponse extends BaseObject {
    declare data: MediaAlbum[];
    declare extra?: { isLast?: boolean; offset?: string };

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((a: any) => new MediaAlbum(a));
    }
}

/** A media item of the feed. The discriminator is the `type` field: image | ok_video | audio_file. */
export type MediaItem = Image | Video | Audio;

/** Short description of the post the media belongs to. */
export interface MediaPostInfo {
    id: string;
    title: string;
    hasAccess: boolean;
    price: number;
    /** Unix time, seconds. */
    publishTime: number;
    /** Empty when there is no access. */
    signedQuery: string;
    teaser: TeaserContent[];
    subscriptionLevelId?: number;
    [key: string]: any;
}

/** A post of the media feed together with its media. */
export class MediaPost extends BaseObject {
    declare post: MediaPostInfo;
    declare media: MediaItem[];
}

export class MediaPostsResponse extends BaseObject {
    declare data: MediaPost[];
    declare extra?: { isLast?: boolean; offset?: string };

    constructor(data: Record<string, any> = {}) {
        super(data);
        // The API wraps the list: { data: { mediaPosts: [...] }, extra }
        this.data = (data.data?.mediaPosts ?? []).map((m: any) => new MediaPost(m));
    }
}
