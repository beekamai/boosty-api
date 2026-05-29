/**
 * Base object for all models. Tolerant to new fields: copies every key from the response,
 * so when the Boosty schema changes, unknown fields are not lost (accessible via the index signature).
 */
export class BaseObject {
    [key: string]: any;
    constructor(data: Record<string, any> = {}) {
        Object.entries(data).forEach(([key, value]) => {
            (this as any)[key] = value;
        });
    }
}
