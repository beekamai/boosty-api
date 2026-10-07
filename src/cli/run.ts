/* `boosty-api login`: saves a Boosty session to auth.json, from a browser login or a pasted Cookie header. */
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { API } from "../client";
import { Auth } from "../auth/auth";
import { AuthData } from "../auth/auth-data";
import { BoostyError, type HTTPClient } from "../http";
import { FileAuthDataResolver } from "../auth/file-auth-data-resolver";
import { interactiveLogin } from "../utils/browser_login";
import { DEFAULT_USER_AGENT } from "../utils/consts";
import { printable } from "../utils/printable";

const HELP = `Usage: boosty-api login [--cookie] [--file auth.json] [--force]

  (no flags)        open a browser window, log in, save the tokens (needs puppeteer installed
                    next to boosty-api: npm i boosty-api puppeteer)
  --cookie          paste the Cookie header of any boosty.to request (DevTools → Network → a request →
                    Request Headers → cookie). Read from the prompt (not echoed) or a pipe, so it stays
                    out of shell history. Copy it from a private window and close that window afterwards:
                    the browser and this tool must not refresh the same tokens.
  --cookie=<value>  the same, inline (lands in shell history and the process list)
  --file <path>     where to save the tokens (default: auth.json)
  --force           log in again even if the file already holds tokens; overwrite a file that
                    does not look like an auth file`;

export interface CliDeps {
    /** Reads the pasted cookie: everything from a pipe, the pasted lines from a terminal; "" if input is closed. */
    prompt: (question: string) => Promise<string>;
    out: (line: string) => void;
    err: (line: string) => void;
    login: typeof interactiveLogin;
    httpClient?: HTTPClient;
}

/** Reads without echo; a paste may arrive as several lines, so lines are collected until input pauses. */
async function readInput(question: string): Promise<string> {
    process.stderr.write(question);
    if (!process.stdin.isTTY) {
        let data = "";
        for await (const chunk of process.stdin) data += chunk;
        return data;
    }
    const silent = new Writable({ write: (_chunk, _encoding, done) => done() });
    const rl = createInterface({ input: process.stdin, output: silent, terminal: true });
    return new Promise<string>((done) => {
        const lines: string[] = [];
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = () => {
            clearTimeout(timer);
            rl.close();
        };
        rl.on("line", (line) => {
            lines.push(line);
            clearTimeout(timer);
            timer = setTimeout(finish, 300);
        });
        // Without a listener, Ctrl+C only pauses the input and the prompt would hang
        rl.on("SIGINT", () => rl.close());
        // Fires after finish() and on Ctrl+C / Ctrl+D
        rl.on("close", () => {
            process.stderr.write("\n");
            done(lines.join("\n"));
        });
    });
}

const defaultDeps: CliDeps = {
    prompt: readInput,
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    login: interactiveLogin,
};

/** An existing file may be overwritten only if it is empty or already an auth file (or with --force). */
function isAuthFile(path: string): boolean {
    try {
        const text = readFileSync(path, "utf-8");
        if (!text.trim()) return true;
        const data = JSON.parse(text);
        return data !== null && typeof data === "object" && ("access_token" in data || "refresh_token" in data);
    } catch {
        return false;
    }
}

function savedTokens(path: string): boolean {
    try {
        const data = JSON.parse(readFileSync(path, "utf-8"));
        return Boolean(data?.access_token && data?.refresh_token);
    } catch {
        return false;
    }
}

function writable(path: string): boolean {
    try {
        accessSync(existsSync(path) ? path : dirname(resolve(path)), constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

/** Runs the CLI and returns the exit code. */
export async function runCli(argv: string[], deps: CliDeps = defaultDeps): Promise<number> {
    const [command, ...rest] = argv;
    const wantsHelp = command === "--help" || command === "-h" || (command === "login" && (rest.includes("--help") || rest.includes("-h")));
    if (wantsHelp || command !== "login") {
        (wantsHelp ? deps.out : deps.err)(HELP);
        return wantsHelp ? 0 : 1;
    }

    let file = "auth.json";
    let force = false;
    let cookie: string | null = null;
    for (let i = 0; i < rest.length; i++) {
        const eq = rest[i].startsWith("--") ? rest[i].indexOf("=") : -1;
        const [flag, inline] = eq > 0 ? [rest[i].slice(0, eq), rest[i].slice(eq + 1)] : [rest[i], undefined];
        if (flag === "--force" && inline === undefined) force = true;
        else if (flag === "--cookie") cookie = inline ?? "";
        else if (flag === "--file") {
            const value = inline ?? (rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : "");
            if (!value) {
                deps.err("--file needs a path");
                return 1;
            }
            file = value;
        } else {
            // Never echo a value: a mistyped flag may carry the cookie
            deps.err(`Unknown argument: ${flag.startsWith("--") ? flag : "<value>"}\n\n${HELP}`);
            return 1;
        }
    }

    if (existsSync(file) && !isAuthFile(file) && !force) {
        deps.err(`${file} exists and is not an auth file; pass --force to overwrite it`);
        return 1;
    }
    // Checked before any request: the session check may rotate the tokens, and they must land somewhere
    if (!writable(file)) {
        deps.err(`Cannot write ${file}`);
        return 1;
    }

    try {
        if (cookie === null) {
            if (!force && savedTokens(file)) {
                deps.out(`Already logged in: tokens are in ${file}. Pass --force to log in again`);
                return 0;
            }
            await deps.login({ authFile: file, force: true });
            deps.out(`Tokens saved to ${file}`);
            return 0;
        }

        const pasted = cookie || (await deps.prompt("Paste the Cookie header of a boosty.to request: "));
        // The CLI writes the file itself below, so a refresh during the check needs no other storage
        const auth = Auth.fromCookies(pasted, { onRefresh: () => {} });
        const pastedRefreshToken = auth.tokens!.refreshToken;
        let who = "";
        let rejected: number | null = null;
        try {
            who = printable((await new API({ auth, httpClient: deps.httpClient }).user.current()).name ?? "");
        } catch (e) {
            if (e instanceof BoostyError && (e.statusCode === 400 || e.statusCode === 401)) rejected = e.statusCode;
            else deps.err(`Could not check the session (${e instanceof BoostyError ? `HTTP ${e.statusCode}` : "network error"}); saving it anyway`);
        }
        // A rotation during the check spent the pasted refresh token: keep the new one whatever happened next
        const rotated = auth.tokens!.refreshToken !== pastedRefreshToken;
        if (rejected !== null && !rotated) {
            deps.err(`Boosty rejected this session (${rejected}): log in to boosty.to again and copy fresh cookies`);
            return 1;
        }

        const resolver = new FileAuthDataResolver(file);
        resolver.authData = AuthData.fromTokens(auth.tokens!, DEFAULT_USER_AGENT);
        resolver.saveAuthData();
        if (rejected !== null) {
            deps.err(`Boosty refreshed the tokens but then refused them (${rejected}); they are saved to ${file} anyway`);
            return 1;
        }
        deps.out(`${who ? `Logged in as ${who}. ` : ""}Tokens saved to ${file}`);
        return 0;
    } catch (e) {
        deps.err(e instanceof Error ? e.message : String(e));
        return 1;
    }
}
