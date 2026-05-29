/* http.ts — transport layer and the API core contract. */
/* Kept separate so resource modules (api/*.ts) depend on the ApiCore interface */
/* rather than the concrete API class — this breaks the circular dependency. */
import type { Auth } from "./auth/auth";

/** Low-level HTTP client. Defaults to native fetch (Bun / Node 18+). */
export interface HTTPClient {
    request(url: string, options: RequestInit): Promise<Response>;
}

/** Boosty API response error. Carries the HTTP status and the parsed response body. */
export class BoostyError extends Error {
    readonly statusCode: number;
    readonly body: unknown;

    constructor(statusCode: number, body: unknown) {
        const errObj = (body ?? {}) as Record<string, unknown>;
        const errName = (errObj["error"] as string) ?? "Unknown error";
        const errDesc = (errObj["error_description"] as string) ?? "";
        super(`Boosty API ${statusCode}: ${errName}${errDesc ? ` — ${errDesc}` : ""}`);
        this.name = "BoostyError";
        this.statusCode = statusCode;
        this.body = body;
    }
}

/** Default implementation on native fetch. node-fetch is no longer needed. */
export const defaultHttpClient: HTTPClient = {
    request: (url, options) => fetch(url, options),
};

/** Options for a single API request. None/undefined values inside params/json/form are dropped. */
export interface RequestOptions {
    /** Query parameters. */
    params?: Record<string, unknown>;
    /** Request body as application/json. */
    json?: Record<string, unknown> | unknown[];
    /** Request body as application/x-www-form-urlencoded. */
    form?: Record<string, unknown>;
    /** Force an anonymous request (no Authorization), even if a token is present. */
    anon?: boolean;
    /** Internal flag: the request has already been retried after refresh (protects from infinite recursion). */
    _retried?: boolean;
}

/**
 * Transport core contract that resource modules see.
 * Implemented by the API class (client.ts).
 */
export interface ApiCore {
    auth: Auth;
    request<T = any>(method: string, path: string, options?: RequestOptions): Promise<T>;
}

/** Base class for all resource modules. Holds a reference to the core. */
export abstract class BaseResource {
    protected core: ApiCore;
    constructor(core: ApiCore) {
        this.core = core;
    }
}
