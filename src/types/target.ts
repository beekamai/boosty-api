/* types/target.ts — blog goals ("targets"): money and subscribers. */
import { BaseObject } from "./base";
import { Currency } from "./subscription";

export type TargetType = "money" | "subscribers" | (string & {});

export class Target extends BaseObject {
    declare id: number;
    declare type: TargetType;
    declare description?: string;
    declare targetSum?: number;
    declare currentSum?: number;
    declare bloggerId?: number;
    declare bloggerUrl?: string;
    declare bloggerCurrency?: string;
    /** Unix time, seconds. */
    declare createdAt?: number;
    /** Unix time, seconds; null while the target is open. */
    declare finishTime?: number | null;
    declare priority?: number;
    declare currencyTargetSums?: Currency;
    declare currencyCurrentSums?: Currency;

    constructor(data: Record<string, any> = {}) {
        super(data);
        if (data.currencyTargetSums) this.currencyTargetSums = new Currency(data.currencyTargetSums);
        if (data.currencyCurrentSums) this.currencyCurrentSums = new Currency(data.currencyCurrentSums);
    }
}

/** A blog's targets (`{ data: Target[] }`). */
export class TargetsResponse extends BaseObject {
    declare data: Target[];

    constructor(data: Record<string, any> | null = {}) {
        super(data ?? {});
        this.data = (Array.isArray(data?.data) ? data.data : [])
            .filter((x: unknown) => x && typeof x === "object")
            .map((t: any) => new Target(t));
    }
}
