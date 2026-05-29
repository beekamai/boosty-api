/* src/types/content.ts */
import { BaseObject } from "./base";
import { Text, Link, LinkToVideo, Smile, FileContent, Audio, Image, Video } from "./media-types";

/**
 * Any content block of a post. The discriminator is the `type` field:
 * text | link | video(LinkToVideo) | smile | file | audio_file | ok_video(Video) | image
 */
export class Content extends BaseObject {
    declare type: string;
}

export { Text, Link, LinkToVideo, Smile, FileContent, Audio, Image, Video };
