import { ABCAuthDataResolver, AuthData } from "./auth-data";
import { FileAuthDataResolver } from "./file-auth-data-resolver";
import { DEFAULT_USER_AGENT } from "../utils/consts";
import type { HTTPClient } from "../http";

export class Auth {
    private authResolver: ABCAuthDataResolver;
    private authData: AuthData;

    constructor(authResolver?: ABCAuthDataResolver) {
        this.authResolver = authResolver ?? new FileAuthDataResolver();
        this.authData = this.authResolver.loadAuthData();
    }

    /** Whether an access token is present (non-anonymous mode). */
    get isAuthenticated(): boolean {
        return !this.authData.anonymous;
    }

    /** Token has expired or is about to expire. */
    get isExpired(): boolean {
        return this.authData.isExpired;
    }

    get headers(): Record<string, string> {
        if (!this.authData.user_agent) {
            this.authData.user_agent = DEFAULT_USER_AGENT;
            this.authResolver.saveAuthData();
        }
        const headers: Record<string, string> = { "User-Agent": this.authData.user_agent };
        if (this.authData.access_token) {
            headers["Authorization"] = `Bearer ${this.authData.access_token}`;
        }
        return headers;
    }

    /** Proactive refresh: refreshes the token only if one exists and has expired. */
    async ensureFresh(httpClient: HTTPClient, apiUrl: string): Promise<void> {
        if (this.isAuthenticated && this.isExpired && this.authData.refresh_token) {
            await this.refreshAuthData(httpClient, apiUrl);
        }
    }

    async refreshAuthData(httpClient: HTTPClient, apiUrl: string): Promise<void> {
        this.authData = this.authResolver.loadAuthData();
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
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(`Failed to refresh token: ${response.status} ${errText}`);
        }

        const responseData = (await response.json()) as Record<string, any>;
        /* fromResponseData mutates the same object the resolver holds (loadAuthData returned it), */
        /* so saveAuthData() will persist the already-updated fields. A repeated load is unnecessary. */
        this.authData.fromResponseData(responseData);
        this.authResolver.saveAuthData();
    }
}
