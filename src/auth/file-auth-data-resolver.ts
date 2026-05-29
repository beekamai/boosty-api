import { readFileSync, writeFileSync } from "fs";
import { ABCAuthDataResolver, AuthData } from "./auth-data";
import { logger } from "../utils/logging";

export class FileAuthDataResolver extends ABCAuthDataResolver {
    private authFile: string;

    constructor(authFile: string = "auth.json") {
        super();
        this.authFile = authFile;
    }

    loadAuthData(): AuthData {
        try {
            const authDict = JSON.parse(readFileSync(this.authFile, "utf-8"));
            this.authData = new AuthData(authDict);
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                logger.info(
                    `Auth file (${this.authFile}) wasn't found, using blank values (anonymous access mode)`
                );
                this.authData = new AuthData();
            } else {
                throw error;
            }
        }
        return this.authData;
    }

    saveAuthData(): void {
        if (this.authData.anonymous) return;
        writeFileSync(this.authFile, JSON.stringify(this.authData.toDict(), null, 2), "utf-8");
    }
}