import { AsyncLocalStorage } from "node:async_hooks";
import { ABCAuthDataResolver, AuthData, INSPECT, type AuthCookies, type AuthTokens } from "./auth-data";
import { FileAuthDataResolver } from "./file-auth-data-resolver";
import { MemoryAuthDataResolver } from "./memory-auth-data-resolver";
import { DEFAULT_USER_AGENT } from "../utils/consts";
import { logger } from "../utils/logging";
import { BoostyError, type HTTPClient } from "../http";

export interface AuthOptions {
    /**
     * Called with the new token set after every refresh, awaited before the request goes on. Boosty rotates
     * refresh tokens, so the old one stops working: persist the new set here, or the session is lost on restart.
     * Until it succeeds, every request fails with `TokenPersistError` and the call is retried before each one.
     */
    onRefresh?: (tokens: AuthTokens) => void | Promise<void>;
}

/** The tokens were refreshed but could not be stored (`cause` has why). The new tokens are in `auth.tokens`. */
export class TokenPersistError extends Error {
    constructor(cause: unknown) {
        // The cause's message is left out: storage errors may quote the values they failed on
        super("Tokens were refreshed but could not be stored; see `cause`. The new tokens are in auth.tokens", { cause });
        this.name = "TokenPersistError";
    }
}

const REFRESH_TIMEOUT_MS = 30_000;

/** Set while onRefresh runs: its own API calls must not wait for the store that is waiting for them. */
const insideOnRefresh = new AsyncLocalStorage<boolean>();

export class Auth {
    private authResolver: ABCAuthDataResolver;
    private authData: AuthData;
    private readonly onRefresh?: AuthOptions["onRefresh"];
    /** The refresh in flight: concurrent callers share it, so a rotated refresh token is never spent twice. */
    private refreshing: Promise<void> | null = null;
    /** Bumped by every rotation. A store is done once both the resolver and onRefresh hold the newest one. */
    private generation = 0;
    private resolverGeneration = 0;
    private callbackGeneration = 0;
    /** The store in flight: callers join it; a newer generation queues behind it, so an older set never lands last. */
    private storing: { generation: number; promise: Promise<void> } | null = null;
    private warnedMemoryOnly = false;

    constructor(authResolver?: ABCAuthDataResolver, options: AuthOptions = {}) {
        this.authResolver = authResolver ?? new FileAuthDataResolver();
        this.authData = this.authResolver.loadAuthData();
        this.onRefresh = options.onRefresh;
    }

    /** Auth from tokens kept by the app (env, database); nothing is read from or written to disk. */
    static fromTokens(tokens: AuthTokens, options: AuthOptions & { userAgent?: string } = {}): Auth {
        return new Auth(new MemoryAuthDataResolver(AuthData.fromTokens(tokens, options.userAgent ?? null)), options);
    }

    /**
     * Auth from the browser session: the `Cookie` header of any boosty.to request copied from DevTools
     * (`auth=…; _clientId=…`), or the two cookie values. Kept in memory; use `onRefresh` to persist.
     */
    static fromCookies(cookies: string | AuthCookies, options: AuthOptions & { userAgent?: string } = {}): Auth {
        return new Auth(new MemoryAuthDataResolver(AuthData.fromCookies(cookies, options.userAgent ?? null)), options);
    }

    /** Whether an access token is present (non-anonymous mode). */
    get isAuthenticated(): boolean {
        return !this.authData.anonymous;
    }

    /** Token has expired or is about to expire. */
    get isExpired(): boolean {
        return this.authData.isExpired;
    }

    /** The current token set (changes after every refresh), or null in anonymous mode. */
    get tokens(): AuthTokens | null {
        return this.authData.toTokens();
    }

    get headers(): Record<string, string> {
        // Defaulted in memory only: a write here would bypass the generation bookkeeping of refreshed tokens
        this.authData.user_agent ??= DEFAULT_USER_AGENT;
        const headers: Record<string, string> = { "User-Agent": this.authData.user_agent };
        if (this.authData.access_token) {
            headers["Authorization"] = `Bearer ${this.authData.access_token}`;
        }
        return headers;
    }

    /** Tokens from a refresh are not stored yet (the resolver or onRefresh failed). */
    get unsaved(): boolean {
        return this.resolverGeneration !== this.generation || this.callbackGeneration !== this.generation;
    }

    /** Before every authorized request: stores tokens a previous refresh could not, or throws TokenPersistError. */
    async ensureSaved(): Promise<void> {
        if (this.unsaved && !insideOnRefresh.getStore()) await this.persist();
    }

    /** Proactive refresh: refreshes the token only if one exists and has expired. */
    async ensureFresh(httpClient: HTTPClient, apiUrl: string): Promise<void> {
        await this.ensureSaved();
        if (this.isAuthenticated && this.isExpired && this.authData.refresh_token) {
            await this.refreshAuthData(httpClient, apiUrl);
        }
    }

    refreshAuthData(httpClient: HTTPClient, apiUrl: string): Promise<void> {
        this.refreshing ??= this.refresh(httpClient, apiUrl).finally(() => {
            this.refreshing = null;
        });
        return this.refreshing;
    }

    private async refresh(httpClient: HTTPClient, apiUrl: string): Promise<void> {
        // Re-read the store (another process may have refreshed), unless it holds an older set than memory.
        // A missing or broken store does not replace a working set: it is written back with the next save.
        if (!this.unsaved) {
            let stored: AuthData | null = null;
            try {
                stored = this.authResolver.loadAuthData();
            } catch {
                // Kept below
            }
            if (stored?.refresh_token) this.authData = stored;
            else this.authResolver.authData = this.authData;
        }
        if (!this.authData.refresh_token) {
            throw new Error("No refresh token was found to refresh auth data");
        }

        /* Boosty /oauth/token/ accepts ONLY application/x-www-form-urlencoded (JSON → invalid_param). */
        const body = new URLSearchParams({
            device_id: this.authData.device_id ?? "",
            device_os: "web",
            grant_type: "refresh_token",
            refresh_token: this.authData.refresh_token ?? "",
        });
        const response = await httpClient.request(`${apiUrl}/oauth/token/`, {
            method: "POST",
            headers: {
                ...this.headers,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
            // A hung refresh would hold every later request behind the shared promise
            signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
        });

        let responseData: Record<string, any> = {};
        try {
            responseData = (await response.json()) as Record<string, any>;
        } catch {
            // Parse errors quote the input; the status below says enough
        }
        if (!response.ok) {
            // Only the error fields: the rest of an error body is not needed and is never logged
            const short = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : undefined);
            throw new BoostyError(response.status, { error: short(responseData?.error) ?? "refresh_failed", error_description: short(responseData?.error_description) });
        }

        /* fromResponseData mutates the same object the resolver holds (loadAuthData returned it), */
        /* so saveAuthData() will persist the already-updated fields. A repeated load is unnecessary. */
        this.authData.fromResponseData(responseData);
        this.generation++;
        await this.persist();
    }

    /** Stores the newest tokens: joins a store of the same generation, queues behind an older one. */
    private persist(): Promise<void> {
        if (this.storing?.generation === this.generation) return this.storing.promise;
        const previous = this.storing?.promise.catch(() => {}) ?? Promise.resolve();
        const entry = { generation: this.generation, promise: previous.then(() => this.store()) };
        this.storing = entry;
        entry.promise
            .finally(() => {
                if (this.storing === entry) this.storing = null;
            })
            .catch(() => {});
        return entry.promise;
    }

    /** Writes the current set to the resolver and onRefresh independently; each step is skipped once it holds it. */
    private async store(): Promise<void> {
        if (!this.unsaved) return;
        const generation = this.generation;
        const tokens = this.authData.toTokens()!;
        let failure: unknown = null;
        if (this.resolverGeneration !== generation) {
            try {
                this.authResolver.saveAuthData();
                this.resolverGeneration = generation;
            } catch (e) {
                failure = e;
            }
        }
        if (this.callbackGeneration !== generation) {
            try {
                if (this.onRefresh) await insideOnRefresh.run(true, () => this.onRefresh!(tokens));
                else if (this.authResolver instanceof MemoryAuthDataResolver && !this.warnedMemoryOnly) {
                    this.warnedMemoryOnly = true;
                    logger.warn("Tokens were refreshed and are kept in memory only: pass onRefresh to store them, or the session is lost on restart");
                }
                this.callbackGeneration = generation;
            } catch (e) {
                failure ??= e;
            }
        }
        if (failure !== null) throw new TokenPersistError(failure);
    }

    toJSON(): Record<string, unknown> {
        return { authenticated: this.isAuthenticated, tokens: this.isAuthenticated ? "[redacted]" : null };
    }

    [INSPECT](): string {
        return `Auth { ${this.isAuthenticated ? "tokens: [redacted]" : "anonymous"} }`;
    }
}
