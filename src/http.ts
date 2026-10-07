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

/** Encodes one caller-supplied value as a single path segment. */
function pathSegment(value: string | number): string {
    /* Without this check a missing id (e.g. `blogUrl` of an account without a blog) becomes the segment "undefined". */
    if (value === undefined || value === null) throw new TypeError(`Invalid path segment: ${value}`);
    const segment = String(value);
    /* The URL parser resolves "." / ".." (even as %2e%2e) and "" changes the route, so encoding is not enough. */
    /* "/" and "\" are rejected too: no Boosty id has them, and a server that decodes %2F before routing would split the segment. */
    /* Lone surrogates would make encodeURIComponent throw URIError; reject them with the same TypeError. */
    if (segment === "" || segment === "." || segment === ".." || /[/\\]|\p{Surrogate}/u.test(segment)) {
        throw new TypeError(`Invalid path segment: ${JSON.stringify(segment)}`);
    }
    return encodeURIComponent(segment);
}

/**
 * Tagged template for request paths: every interpolated value becomes exactly one encoded segment,
 * so ids like `a?b=c` or `a#b` cannot steer the request to another endpoint. Use it with `api.request`
 * whenever a path carries a value you did not write yourself.
 * @throws TypeError if an interpolated value is undefined, null, "", ".", "..", contains "/" or "\", or a lone UTF-16 surrogate.
 */
export function apiPath(strings: TemplateStringsArray, ...values: Array<string | number>): string {
    return strings.reduce((path, literal, i) => path + pathSegment(values[i - 1]!) + literal);
}

/** Comma-joins a list filter; an empty list is dropped, since `key=` may read as "no filter" instead of "match nothing". */
export function commaList(values?: readonly (string | number)[]): string | undefined {
    return values?.length ? values.join(",") : undefined;
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
