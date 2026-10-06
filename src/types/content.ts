/* src/types/content.ts */
import { BaseObject } from "./base";

/**
 * Loosely typed content block: only the `type` discriminator. Used where blocks are built by the caller.
 * Blocks read from the API are typed as `ContentItem`.
 */
export class Content extends BaseObject {
    declare type: string;
}

export { Text, Header, Link, LinkToVideo, Smile, FileContent, ListContent, Audio, Image, Video } from "./media-types";
export type { ContentItem, ListItem } from "./media-types";
