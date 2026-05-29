import { BaseObject } from "./base";

export type ReactionName = "heart" | "like" | "dislike" | "laught" | "wonder" | "fire" | "sad" | "angry";

export class Reactions extends BaseObject {
    declare heart?: number;
    declare like?: number;
    declare dislike?: number;
    declare laught?: number;
    declare wonder?: number;
    declare fire?: number;
    declare sad?: number;
    declare angry?: number;
}

export class Reacted extends BaseObject {
    declare author: ReactionName;
}

export class ReactionCounter extends BaseObject {
    declare type: string;
    declare count: number;
}
