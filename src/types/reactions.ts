import { BaseObject } from "./base";

/**
 * Reaction names seen in `reactionCounters`. Both "laugh" and the legacy "laught" spelling occur.
 * Left open (`string & {}`): Boosty adds reactions without notice, the known names still autocomplete.
 */
export type ReactionName =
    | "like" | "dislike" | "fire" | "heart" | "laugh" | "laught" | "wonder" | "sad" | "angry"
    | "funny" | "check" | "thinking" | "clown" | "swearing" | "applause" | "call-me" | "cold"
    | "eggplant" | "blowing-up" | "scream" | "crown" | "diamond" | "melting" | "money" | "nausea"
    | "confetti" | "banana" | "peach" | "pizza" | "love" | "rocket" | "splash" | "lightning"
    | "cry" | "folded-hands"
    | (string & {});

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
    declare type: ReactionName;
    declare count: number;
}
