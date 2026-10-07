/* Keeps auth data in memory only: for servers that take tokens from env or a database. */
import { ABCAuthDataResolver, AuthData } from "./auth-data";

export class MemoryAuthDataResolver extends ABCAuthDataResolver {
    constructor(authData: AuthData = new AuthData()) {
        super();
        this.authData = authData;
    }

    loadAuthData(): AuthData {
        return this.authData;
    }

    saveAuthData(): void {}
}
