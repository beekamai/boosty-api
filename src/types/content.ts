/* src/types/content.ts */
import { BaseObject } from "./base";
import { Text, Header, Link, LinkToVideo, Smile, FileContent, ListContent, Audio, Image, Video } from "./media-types";
import type { ListItem } from "./media-types";

/**
 * Loosely typed content block: only the `type` discriminator. Used where blocks are built by the caller.
 * Blocks read from the API are typed as `ContentItem`.
 */
export class Content extends BaseObject {
    declare type: string;
}

/**
 * A content block as returned by the API (posts, comments, blog description). The discriminator is `type`:
 * text | header | link | video(LinkToVideo) | smile | file | list | audio_file | ok_video(Video) | image
 */
export type ContentItem = Text | Header | Link | LinkToVideo | Smile | FileContent | ListContent | Audio | Image | Video;

export { Text, Header, Link, LinkToVideo, Smile, FileContent, ListContent, Audio, Image, Video };
export type { ListItem };
