import { BaseObject } from "./base";

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

/** A post of the media feed together with its media (image | ok_video | audio_file etc.). */
export class MediaPost extends BaseObject {
    declare post: { id: string; title?: string; hasAccess?: boolean; publishTime?: number; [key: string]: any };
    declare media: Record<string, any>[];
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
