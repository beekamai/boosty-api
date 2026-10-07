/** A token set as an app keeps it (env, database). `expiresAt` is unix time in seconds or milliseconds. */
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    /** The `_clientId` cookie. Boosty refuses to refresh tokens without it. */
    deviceId: string;
    expiresAt?: number | string | null;
}

/** The two Boosty cookies the session lives in, as raw values copied from the browser. */
export interface AuthCookies {
    auth: string;
    _clientId: string;
}

const TOKEN_CHARS = /^[\x21-\x7E]+$/;

/** Tokens go into an HTTP header: a control character there makes fetch quote the whole value in its error. */
export const isTokenText = (value: unknown): value is string => typeof value === "string" && TOKEN_CHARS.test(value);

/** Custom `console.log` / `util.inspect` output, so tokens are not printed by accident. */
export const INSPECT = Symbol.for("nodejs.util.inspect.custom");

function parseCookieHeader(header: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    for (const part of header.replace(/^\s*cookie\s*:/i, "").split(/;|\r?\n/)) {
        const eq = part.indexOf("=");
        if (eq > 0) cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
    return cookies;
}

export class AuthData {
    access_token: string | null;
    refresh_token: string | null;
    expires_at: string | null;
    device_id: string | null;
    user_agent: string | null;

    constructor(data: Partial<AuthData> = {}) {
        this.access_token = data.access_token ?? null;
        this.refresh_token = data.refresh_token ?? null;
        this.expires_at = data.expires_at ?? null;
        this.device_id = data.device_id ?? null;
        this.user_agent = data.user_agent ?? null;
    }

    static fromTokens(tokens: AuthTokens, userAgent: string | null = null): AuthData {
        if (!tokens?.accessToken || !tokens.refreshToken || !tokens.deviceId) {
            throw new Error("accessToken, refreshToken and deviceId are all required");
        }
        for (const value of [tokens.accessToken, tokens.refreshToken, tokens.deviceId]) {
            if (!isTokenText(value)) {
                throw new Error("accessToken, refreshToken and deviceId must be printable ASCII without spaces");
            }
        }
        return new AuthData({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            device_id: tokens.deviceId,
            expires_at: tokens.expiresAt == null ? null : String(tokens.expiresAt),
            user_agent: userAgent,
        });
    }

    /**
     * Reads a session from the browser's cookies: either the whole `Cookie` header copied from DevTools
     * (`auth=…; _clientId=…`, a leading `Cookie:` is fine) or the two raw cookie values.
     * Errors name what is missing and never echo cookie values.
     */
    static fromCookies(cookies: string | AuthCookies, userAgent: string | null = null): AuthData {
        const jar = typeof cookies === "string" ? parseCookieHeader(cookies) : (cookies ?? {});
        const raw = typeof jar.auth === "string" ? jar.auth.trim() : "";
        const deviceId = typeof jar._clientId === "string" ? jar._clientId.trim() : "";
        if (!raw) throw new Error("The `auth` cookie is missing: copy the Cookie header of a request to boosty.to while logged in");
        if (!deviceId) throw new Error("The `_clientId` cookie is missing: Boosty needs it to refresh tokens");

        let session: Record<string, unknown>;
        try {
            // DevTools shows the value URL-encoded or decoded depending on a checkbox: accept both
            session = JSON.parse(raw.startsWith("{") ? raw : decodeURIComponent(raw));
        } catch {
            throw new Error("The `auth` cookie is not the JSON Boosty stores there: copy its whole value");
        }
        const { accessToken, refreshToken, expiresAt } = session ?? {};
        if (typeof accessToken !== "string" || !accessToken || typeof refreshToken !== "string" || !refreshToken) {
            throw new Error("The `auth` cookie has no tokens: log in to boosty.to first");
        }
        return AuthData.fromTokens(
            { accessToken, refreshToken, deviceId, expiresAt: typeof expiresAt === "number" || typeof expiresAt === "string" ? expiresAt : null },
            userAgent
        );
    }

    /** The current token set, or null in anonymous mode. */
    toTokens(): AuthTokens | null {
        if (!this.access_token || !this.refresh_token) return null;
        return {
            accessToken: this.access_token,
            refreshToken: this.refresh_token,
            deviceId: this.device_id ?? "",
            expiresAt: this.expires_at,
        };
    }

    get anonymous(): boolean {
        return this.access_token === null;
    }

    [INSPECT](): string {
        return `AuthData { ${this.anonymous ? "anonymous" : "tokens: [redacted]"}, expires_at: ${this.expires_at} }`;
    }

    /**
     * Token has expired or will expire within the next 60 seconds.
     * If expires_at is not set, treat it as not expired (rely on the reactive 401 refresh).
     */
    get isExpired(): boolean {
        if (!this.expires_at) return false;
        let exp = Number(this.expires_at);
        if (!Number.isFinite(exp)) return false;
        // The Boosty cookie (`auth.expiresAt`) reports time in milliseconds, while the /oauth/token/
        // response reports it in seconds. Normalize to seconds so the unit comparison is correct.
        if (exp > 1e12) exp = Math.floor(exp / 1000);
        return Math.floor(Date.now() / 1000) >= exp - 60;
    }

    toDict(): Record<string, string | null> {
        return {
            access_token: this.access_token,
            refresh_token: this.refresh_token,
            expires_at: this.expires_at,
            device_id: this.device_id,
            user_agent: this.user_agent,
        };
    }

    fromResponseData(responseData: Record<string, any>): void {
        const accessToken = responseData?.["access_token"];
        const refreshToken = responseData?.["refresh_token"];
        if (!isTokenText(accessToken) || !isTokenText(refreshToken)) {
            // Key names only: a partial response may still carry a token
            throw new Error(`Failed to refresh auth data: response has keys [${Object.keys(responseData ?? {}).join(", ")}]`);
        }
        this.access_token = accessToken;
        this.refresh_token = refreshToken;

        const expiresIn = Number(responseData["expires_in"]);
        this.expires_at = Number.isFinite(expiresIn)
            ? String(Math.floor(Date.now() / 1000) + expiresIn)
            : this.expires_at;

        // device_id is usually not returned, but if it is — keep it.
        if (responseData["device_id"]) this.device_id = responseData["device_id"];
    }

    fromCookiesData(responseData: Record<string, any>): void {
        try {
            this.refresh_token = responseData["refreshToken"];
            this.access_token = responseData["accessToken"];
            this.expires_at = responseData["expiresAt"];
        } catch (e) {
            throw new Error(`Failed to read auth cookie data: keys [${Object.keys(responseData ?? {}).join(", ")}]`);
        }
    }
}

export abstract class ABCAuthDataResolver {
    authData!: AuthData;

    abstract loadAuthData(): AuthData;
    abstract saveAuthData(): void;

    toJSON(): Record<string, unknown> {
        return { authData: "[redacted]" };
    }

    [INSPECT](): string {
        return `${this.constructor.name} { authData: [redacted] }`;
    }
}