import { BaseObject } from "./base";

export type PlayerUrlsSizeNames =
    | "ultra_hd"
    | "quad_hd"
    | "full_hd"
    | "high"
    | "medium"
    | "low"
    | "lowest"
    | "tiny"
    | "dash"
    | "dash_uni"
    | "hls"
    | "live_hls"
    | "live_dash"
    | "live_playback_hls"
    | "live_playback_dash"
    | "live_ondemand_hls"
    | "ondemand_hls"
    | "ondemand_dash"
    | "live_cmaf";

export class PlayerUrl extends BaseObject {
    declare type: PlayerUrlsSizeNames;
    declare url: string;
}

export class Text extends BaseObject {
    type: "text" = "text";
    declare content: string;
    declare modificator: string;
}

/** Heading block. `content` has the same format as in a text block. */
export class Header extends BaseObject {
    type: "header" = "header";
    declare content: string;
    declare modificator: string;
}

export class Link extends BaseObject {
    type: "link" = "link";
    declare content: string;
    declare url: string;
    declare explicit: boolean;
}

export class LinkToVideo extends BaseObject {
    type: "video" = "video";
    declare url: string;
}

export class Smile extends BaseObject {
    type: "smile" = "smile";
    declare id: string;
    declare name: string;
    declare smallUrl: string;
    declare mediumUrl: string;
    declare largeUrl: string;
    declare isAnimated: boolean;
}

/** Item of a list block: its own content blocks plus nested items. Either may be missing. */
export interface ListItem {
    data?: ContentItem[];
    items?: ListItem[];
}

export class ListContent extends BaseObject {
    type: "list" = "list";
    declare items: ListItem[];
    declare style: string;
}

export class FileContent extends BaseObject {
    type: "file" = "file";
    declare id: string;
    declare url: string;
    declare complete: boolean;
    declare title: string;
    declare size: number;
    declare isMigrated?: boolean;
    declare isInvalid?: boolean;
}

export class Audio extends BaseObject {
    type: "audio_file" = "audio_file";
    declare id: string;
    declare url: string;
    declare complete: boolean;
    declare title: string;
    declare size: number;
    declare duration?: number;
    declare album?: string;
    declare artist?: string;
    declare track?: string;
    declare uploadStatus?: string | null;
    declare isMigrated?: boolean;
    declare fileType?: "MP3" | "WAV";
    declare timeCode?: number;
    declare viewsCounter?: number;
    declare showViewsCounter?: boolean;
}

export class Image extends BaseObject {
    type: "image" = "image";
    declare id: string;
    declare url: string;
    declare rendition: string;
    declare width: number;
    declare height: number;
    declare size: number;
    declare title?: string;
}

export class Video extends BaseObject {
    type: "ok_video" = "ok_video";
    declare id: string;
    declare url: string;
    declare complete: boolean;
    declare title?: string;
    declare duration: number;
    declare width: number;
    declare height: number;
    declare playerUrls: PlayerUrl[];
    declare defaultPreview?: string;
    declare preview?: string;
    declare previewId?: string;
    declare vid: string;
    declare failoverHost: string;
    declare timeCode?: number;
    declare viewsCounter?: number;
    declare showViewsCounter?: boolean;
    declare uploadStatus?: string;
    declare status: string;
}

/**
 * A content block as returned by the API (posts, comments, blog description). The discriminator is `type`:
 * text | header | link | video(LinkToVideo) | smile | file | list | audio_file | ok_video(Video) | image
 */
export type ContentItem = Text | Header | Link | LinkToVideo | Smile | FileContent | ListContent | Audio | Image | Video;
