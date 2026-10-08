import { closeSync, fchmodSync, fsyncSync, ftruncateSync, openSync, readFileSync, writeSync } from "fs";
import { ABCAuthDataResolver, AuthData, isTokenText } from "./auth-data";
import { logger } from "../utils/logging";

export class FileAuthDataResolver extends ABCAuthDataResolver {
    private authFile: string;
    private warnedMode = false;

    constructor(authFile: string = "auth.json") {
        super();
        this.authFile = authFile;
    }

    loadAuthData(): AuthData {
        let text: string;
        try {
            text = readFileSync(this.authFile, "utf-8");
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                logger.debug(`Auth file (${this.authFile}) wasn't found, using blank values (anonymous access mode)`);
                this.authData = new AuthData();
                return this.authData;
            }
            throw error;
        }
        let data: AuthData;
        try {
            data = new AuthData(JSON.parse(text));
        } catch {
            // JSON.parse quotes the input in its message, and the input is tokens
            throw new Error(`Auth file (${this.authFile}) is not valid JSON`);
        }
        for (const token of [data.access_token, data.refresh_token, data.device_id]) {
            if (token && !isTokenText(token)) throw new Error(`Auth file (${this.authFile}) has a malformed token`);
        }
        this.authData = data;
        return this.authData;
    }

    /**
     * Rewrites the file in place: works through symlinks, single-file mounts and files other processes hold
     * open, and keeps a Windows ACL set on the file. On POSIX the file is made owner-only.
     */
    saveAuthData(): void {
        if (this.authData.anonymous) return;
        const bytes = Buffer.from(JSON.stringify(this.authData.toDict(), null, 2), "utf-8");
        // "r+" and truncate rather than "w": Windows refuses "w" on a hidden file
        let fd: number;
        try {
            fd = openSync(this.authFile, "r+");
        } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
            fd = openSync(this.authFile, "wx", 0o600);
        }
        try {
            ftruncateSync(fd, 0);
            if (process.platform !== "win32") {
                try {
                    fchmodSync(fd, 0o600);
                } catch {
                    // A file owned by someone else cannot be chmod-ed; the write itself matters more
                    if (!this.warnedMode) logger.warn(`Could not make ${this.authFile} owner-only`);
                    this.warnedMode = true;
                }
            }
            // writeSync may write less than asked (full disk, network filesystems): a cut-off file is not saved
            for (let offset = 0; offset < bytes.length; ) {
                const written = writeSync(fd, bytes, offset, bytes.length - offset, offset);
                if (written <= 0) throw new Error(`Could not write ${this.authFile}`);
                offset += written;
            }
            fsyncSync(fd);
        } finally {
            closeSync(fd);
        }
    }
}