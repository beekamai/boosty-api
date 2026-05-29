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

export class FileContent extends BaseObject {
    type: "file" = "file";
    declare id: string;
    declare url: string;
    declare complete: boolean;
    declare title: string;
    declare size: number;
    declare isMigrated?: boolean;
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
    declare uploadStatus?: string;
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
}

export class Video extends BaseObject {
    type: "ok_video" = "ok_video";
    declare id: string;
    declare url: string;
    declare complete: boolean;
    declare title: string;
    declare duration: number;
    declare width: number;
    declare height: number;
    declare playerUrls: PlayerUrl[];
    declare defaultPreview: string;
    declare preview: string;
    declare previewId?: string;
    declare vid: number;
    declare failoverHost: string;
    declare timeCode?: number;
    declare viewsCounter?: number;
    declare showViewsCounter?: boolean;
    declare uploadStatus?: string;
    declare status: string;
}