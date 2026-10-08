import { BaseObject } from "./base";
import { BaseUser, Voter } from "./users";

export class VotersResponse extends BaseObject {
    declare data?: { voters: Voter[] };
    declare extra?: { isLast?: boolean; offset?: number };

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        if (data?.data && typeof data.data === "object") {
            const voters = data.data.voters;
            this.data = { ...data.data, voters: (Array.isArray(voters) ? voters : []).filter((x: any) => x && typeof x === "object").map((v: any) => new Voter(v)) };
        }
    }
}

export class PollOption extends BaseObject {
    declare id: number;
    declare text: string;
    declare counter?: number;
    declare fraction?: number;
    declare voters?: VotersResponse;

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.voters && typeof data.voters === "object") this.voters = new VotersResponse(data.voters);
    }
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

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (Array.isArray(data.options)) this.options = data.options.filter((x: any) => x && typeof x === "object").map((o: any) => new PollOption(o));
    }
}

/** One answer to the "why did you unsubscribe" survey (GET /v1/blog/{blog}/unsubscribe_reasons/). */
export class UnsubscribeAnswer extends BaseObject {
    declare user?: BaseUser;
    declare levelId?: number;
    declare price?: number;
    declare payments?: number;
    /** Ids of the chosen reasons. */
    declare answerIds?: number[];
    /** Free-text answer. */
    declare other?: string;
    /** The API spells it "isAnonimous". */
    declare isAnonimous?: boolean;
    /** Unix time, seconds. */
    declare onTime?: number;
    declare offTime?: number;
    declare createdAt?: number;

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.user && typeof data.user === "object") this.user = new BaseUser(data.user);
    }
}

/** Survey answers (`{ data: { unsubscribeAnswers }, extra }`); the list is lifted to `answers`. */
export class UnsubscribeAnswersResponse extends BaseObject {
    declare answers: UnsubscribeAnswer[];
    declare extra?: { isLast?: boolean; offset?: string; total?: number };

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        const list = data?.data?.unsubscribeAnswers;
        this.answers = (Array.isArray(list) ? list : [])
            .filter((x: unknown) => x && typeof x === "object")
            .map((a: any) => new UnsubscribeAnswer(a));
    }
}
