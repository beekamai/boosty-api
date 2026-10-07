/* Interactive login: opens a browser at boosty.to, waits for the session cookies, keeps the tokens. */
import { logger } from "./logging";
import { LOGIN_URL, DEFAULT_USER_AGENT } from "./consts";
import { printable } from "./printable";
import { Auth } from "../auth/auth";
import { API } from "../client";
import { AuthData } from "../auth/auth-data";
import { FileAuthDataResolver } from "../auth/file-auth-data-resolver";
import { MemoryAuthDataResolver } from "../auth/memory-auth-data-resolver";

export interface InteractiveLoginOptions {
    /** Where to keep the tokens; `null` keeps them in memory only. Default `"auth.json"`. */
    authFile?: string | null;
    userAgent?: string;
    /** Log in again even if `authFile` already holds tokens. */
    force?: boolean;
    /** How long to wait for the login to finish, ms. Default 10 minutes. */
    timeoutMs?: number;
}

/** Positional unless an options object came first: `interactiveLogin(undefined, ua, true)` keeps its force. */
export function loginOptions(first?: InteractiveLoginOptions | string, userAgent?: string, force?: boolean): InteractiveLoginOptions {
    return first !== null && typeof first === "object" ? first : { authFile: first, userAgent, force };
}

const SIGN_IN_BUTTON ='[data-test-id="COMMON_TOPMENU_TOPMENURIGHTUNAUTHORIZED\\:SIGN_IN"]';

/**
 * Opens a browser window, lets the user log in to Boosty and returns an `Auth` for `new API({ auth })`.
 * Needs the optional `puppeteer` peer. With `authFile` set and tokens already there, no browser is opened.
 * The positional form `interactiveLogin(authFile, userAgent, force)` still works.
 */
export async function interactiveLogin(options?: InteractiveLoginOptions): Promise<Auth>;
export async function interactiveLogin(authFile?: string, userAgent?: string, force?: boolean): Promise<Auth>;
export async function interactiveLogin(
    first?: InteractiveLoginOptions | string,
    userAgentArg?: string,
    forceArg?: boolean
): Promise<Auth> {
    const options = loginOptions(first, userAgentArg, forceArg);
    const authFile = options.authFile === undefined ? "auth.json" : options.authFile;
    const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

    if (authFile && !options.force) {
        try {
            const resolver = new FileAuthDataResolver(authFile);
            const saved = resolver.loadAuthData();
            if (saved.access_token && saved.refresh_token) {
                logger.info(`Tokens already present in ${authFile}, authorization not required.`);
                return new Auth(resolver);
            }
        } catch {
            logger.info(`${authFile} is unreadable, starting authorization...`);
        }
    }

    const authData = await loginInBrowser(userAgent, options.timeoutMs ?? 10 * 60_000);
    let auth: Auth;
    if (authFile) {
        const resolver = new FileAuthDataResolver(authFile);
        resolver.authData = authData;
        resolver.saveAuthData();
        logger.info(`Tokens saved to ${authFile}`);
        auth = new Auth(resolver);
    } else {
        auth = new Auth(new MemoryAuthDataResolver(authData));
    }
    // Name the account the browser handed over, so a session that is not yours does not go unnoticed
    const who = await new API({ auth }).user.current().then((user) => printable(user.name ?? ""), () => null);
    logger.info(who ? `Logged in as ${who}` : "Logged in, but the session could not be checked");
    return auth;
}

async function loginInBrowser(userAgent: string, timeoutMs: number): Promise<AuthData> {
    // Puppeteer is an optional dependency — loaded lazily so the package works without it.
    let puppeteer: typeof import("puppeteer").default;
    try {
        puppeteer = (await import("puppeteer")).default;
    } catch {
        throw new Error(
            "Interactive login requires the optional 'puppeteer' dependency. Install it: `bun add puppeteer` (or `npm i puppeteer`)."
        );
    }

    const browser = await puppeteer.launch({ headless: false });
    let closed = false;
    browser.on("disconnected", () => {
        closed = true;
    });
    try {
        const page = await browser.newPage();
        // Page-level APIs on purpose: puppeteer is a peer from 23 up, and their replacements appeared later
        await page.setUserAgent(userAgent);
        await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });
        try {
            await page.waitForSelector(SIGN_IN_BUTTON, { timeout: 15_000 });
            await page.click(SIGN_IN_BUTTON);
        } catch {
            logger.warn("Sign-in button not found: open the login form in the browser window yourself");
        }
        logger.info("Please log in to Boosty through the browser window that opened...");

        // Wait for the session cookie itself, not a navigation: OAuth logins redirect before the cookie is set
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (closed) throw new Error("The browser window was closed before the login finished");
            const jar = Object.fromEntries((await page.cookies(LOGIN_URL)).map((c) => [c.name, c.value]));
            if (jar.auth && jar._clientId) {
                try {
                    return AuthData.fromCookies({ auth: jar.auth, _clientId: jar._clientId }, userAgent);
                } catch {
                    // The cookie exists but holds no tokens yet: keep waiting
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        throw new Error(`Login did not finish within ${Math.round(timeoutMs / 1000)} s`);
    } catch (e) {
        if (closed) throw new Error("The browser window was closed before the login finished");
        throw e;
    } finally {
        if (!closed) await browser.close().catch(() => {});
    }
}