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

/** A single item of the media feed (image | ok_video | audio_file etc.). */
export class MediaPost extends BaseObject {
    declare type: string;
    declare id: string;
    declare postId?: string;
    declare createdAt?: string;
}

export class MediaPostsResponse extends BaseObject {
    declare data: MediaPost[];
    declare extra?: { isLast?: boolean; offset?: string };

    constructor(data: Record<string, any> = {}) {
        super(data);
        this.data = (data.data ?? []).map((m: any) => new MediaPost(m));
    }
}
