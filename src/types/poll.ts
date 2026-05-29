import { BaseObject } from "./base";
import { Voter } from "./users";

export class VotersResponse extends BaseObject {
    declare data?: { voters: Voter[] };
    declare extra?: { isLast?: boolean; offset?: number };
}

export class PollOption extends BaseObject {
    declare id: number;
    declare text: string;
    declare counter?: number;
    declare fraction?: number;
    declare voters?: VotersResponse;
}

export class Poll extends BaseObject {
    declare id: number;
    declare title: string[];
    declare isMultiple?: boolean;
    declare counter?: number;
    declare isFinished?: boolean;
    declare finishTime?: number;
    declare options?: PollOption[];
    declare defaultLang?: string;
    declare hasOther?: boolean;
    declare answer?: number[];
}
