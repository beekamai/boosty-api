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

    get anonymous(): boolean {
        return this.access_token === null;
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
        if (!accessToken || !refreshToken) {
            throw new Error(`Failed to refresh auth data: ${JSON.stringify(responseData)}`);
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
            const msg = `Failed to refresh auth data: ${JSON.stringify(responseData)}`;
            throw new Error(msg);
        }
    }
}

export abstract class ABCAuthDataResolver {
    authData!: AuthData;

    abstract loadAuthData(): AuthData;
    abstract saveAuthData(): void;
}