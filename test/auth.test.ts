/* Auth from cookies and tokens, refresh with rotating tokens, the login CLI. No network, no ./auth.json. */
import { describe, expect, test } from "bun:test";
import { inspect } from "node:util";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ABCAuthDataResolver, API, Auth, AuthData, BoostyError, FileAuthDataResolver, MemoryAuthDataResolver, TokenPersistError, type HTTPClient } from "../src";
import { loginOptions } from "../src/utils/browser_login";
import { runCli, type CliDeps } from "../src/cli/run";

const HOUR = 3600;
const now = () => Math.floor(Date.now() / 1000);
const authCookie = (accessToken = "AT-1", refreshToken = "RT-1", expiresAt = (now() + HOUR) * 1000) =>
    encodeURIComponent(JSON.stringify({ accessToken, refreshToken, expiresAt, isEmptyUser: "0" }));
const cookieHeader = (value = authCookie()) => `_ym_uid=1; auth=${value}; _clientId=device-1; theme=dark`;

interface FakeOptions {
    /** Delay of the n-th API response, ms. */
    delay?: (n: number) => number;
    /** Status of /oauth/token/ (default 200, rotating the tokens). */
    refreshStatus?: number;
    /** By default only the latest access token is accepted, like a server that revokes on rotation. */
    status?: (authorization: string | null, current: string) => number;
    /** Account name /v1/user/current answers with. */
    name?: string;
}

/** Fake Boosty: /oauth/token/ rotates tokens; API paths answer with the Authorization they got. */
function fakeBoosty(options: FakeOptions = {}) {
    const calls: { url: URL; init: RequestInit }[] = [];
    let generation = 1;
    let n = 0;
    const http: HTTPClient = {
        async request(url, init) {
            const u = new URL(url);
            calls.push({ url: u, init });
            if (u.pathname === "/oauth/token/") {
                if (options.refreshStatus && options.refreshStatus !== 200) {
                    return Response.json({ error: "invalid_grant", error_description: "revoked", refresh_token: "SECRET-IN-BODY" }, { status: options.refreshStatus });
                }
                generation++;
                return Response.json({ access_token: `AT-${generation}`, refresh_token: `RT-${generation}`, expires_in: HOUR });
            }
            const authorization = (init.headers as Record<string, string>)?.Authorization ?? null;
            const delay = options.delay?.(n++) ?? 0;
            if (delay) await new Promise((r) => setTimeout(r, delay));
            const current = `Bearer AT-${generation}`;
            const status = options.status?.(authorization, current) ?? (authorization === null || authorization === current ? 200 : 401);
            return Response.json({ authorization, name: options.name ?? "Mara" }, { status });
        },
    };
    return { http, calls, refreshes: () => calls.filter((c) => c.url.pathname === "/oauth/token/") };
}

const tmp = () => mkdtempSync(join(tmpdir(), "boosty-auth-"));
const expired = () => ({ accessToken: "AT-1", refreshToken: "RT-1", deviceId: "device-1", expiresAt: now() - 10 });

describe("Auth.fromCookies", () => {
    test("one pasted Cookie header gives an authorized client", async () => {
        const { http, calls } = fakeBoosty();
        const api = new API({ auth: Auth.fromCookies(cookieHeader()), httpClient: http });
        const res = await api.request("GET", "/v1/user/current");
        expect(res.authorization).toBe("Bearer AT-1");
        expect(calls).toHaveLength(1);
        expect(api.auth.tokens).toMatchObject({ accessToken: "AT-1", refreshToken: "RT-1", deviceId: "device-1" });
    });

    test("accepts a Cookie: prefix, line breaks, a decoded value and the two-value form", () => {
        const decoded = JSON.stringify({ accessToken: "AT-1", refreshToken: "RT-1" });
        for (const input of [
            `Cookie: ${cookieHeader()}`,
            cookieHeader().replaceAll("; ", ";\n"),
            `auth=${decoded}; _clientId=device-1`,
            { auth: authCookie(), _clientId: "device-1" },
        ]) {
            expect(Auth.fromCookies(input).tokens?.accessToken).toBe("AT-1");
        }
    });

    test("bad input is named without echoing the cookie values", () => {
        const cases: [string, RegExp][] = [
            ["_clientId=device-1", /`auth` cookie is missing/],
            [`auth=${authCookie("SECRET-ACCESS", "SECRET-REFRESH")}`, /`_clientId` cookie is missing/],
            ["auth=%7Bnot-json; _clientId=d", /not the JSON/],
            [`auth=${encodeURIComponent('{"isEmptyUser":"1"}')}; _clientId=d`, /no tokens/],
            [`auth=${authCookie("SECRET\nACCESS")}; _clientId=d`, /printable ASCII/],
        ];
        for (const [input, message] of cases) {
            expect(() => Auth.fromCookies(input)).toThrow(message);
            try {
                Auth.fromCookies(input);
            } catch (e) {
                expect((e as Error).message).not.toContain("SECRET");
            }
        }
    });

    test("console.log and JSON.stringify do not print tokens", () => {
        const auth = Auth.fromCookies(cookieHeader());
        const api = new API({ auth, httpClient: fakeBoosty().http });
        for (const text of [inspect(auth), inspect(AuthData.fromCookies(cookieHeader())), JSON.stringify(api.auth)]) {
            expect(text).not.toMatch(/AT-1|RT-1/);
        }
    });
});

describe("refresh with rotating tokens", () => {
    test("an expired token is refreshed once and onRefresh gets the new set", async () => {
        const { http, refreshes } = fakeBoosty();
        const saved: unknown[] = [];
        const api = new API({ auth: Auth.fromTokens(expired(), { onRefresh: (t) => void saved.push(t) }), httpClient: http });
        const res = await api.request("GET", "/v1/user/current");
        expect(res.authorization).toBe("Bearer AT-2");
        expect(refreshes()).toHaveLength(1);
        const body = new URLSearchParams(String(refreshes()[0].init.body));
        expect(body.get("refresh_token")).toBe("RT-1");
        expect(body.get("device_id")).toBe("device-1");
        expect(saved).toEqual([expect.objectContaining({ accessToken: "AT-2", refreshToken: "RT-2", deviceId: "device-1" })]);
    });

    test("concurrent requests share one refresh", async () => {
        const { http, refreshes } = fakeBoosty();
        const api = new API({ auth: Auth.fromTokens(expired()), httpClient: http });
        const results = await Promise.all(Array.from({ length: 5 }, () => api.request("GET", "/v1/user/current")));
        expect(refreshes()).toHaveLength(1);
        expect(results.every((r) => r.authorization === "Bearer AT-2")).toBe(true);
    });

    test("401s arriving after the refresh finished do not rotate again", async () => {
        // No expiresAt (as after a restart from env): the first 401 refreshes, later ones were sent with AT-1
        const { http, refreshes } = fakeBoosty({
            delay: (n) => (n < 5 ? n * 15 : 0),
            status: (authorization, current) => (authorization === current && authorization !== "Bearer AT-1" ? 200 : 401),
        });
        const api = new API({ auth: Auth.fromTokens({ ...expired(), expiresAt: null }), httpClient: http });
        const results = await Promise.all(Array.from({ length: 5 }, () => api.request("GET", "/v1/user/current")));
        expect(refreshes()).toHaveLength(1);
        expect(results.every((r) => r.authorization === "Bearer AT-2")).toBe(true);
    });

    test("an async onRefresh is awaited before the request goes on", async () => {
        const { http } = fakeBoosty();
        let stored = false;
        const onRefresh = async () => {
            await new Promise((r) => setTimeout(r, 20));
            stored = true;
        };
        await new API({ auth: Auth.fromTokens(expired(), { onRefresh }), httpClient: http }).request("GET", "/v1/x");
        expect(stored).toBe(true);
    });

    test("unsaved tokens fail requests until storing them succeeds, without a second rotation", async () => {
        const { http, refreshes } = fakeBoosty();
        const saved: string[] = [];
        let attempts = 0;
        const onRefresh = (t: { refreshToken: string }) => {
            if (++attempts === 1) throw new Error("db down: RT-2");
            saved.push(t.refreshToken);
        };
        const auth = Auth.fromTokens(expired(), { onRefresh });
        const api = new API({ auth, httpClient: http });
        const failure = await api.request("GET", "/v1/x").catch((e) => e);
        expect(failure).toBeInstanceOf(TokenPersistError);
        expect(failure.message).not.toContain("RT-2");
        expect(auth.tokens?.refreshToken).toBe("RT-2");
        expect((await api.request("GET", "/v1/x")).authorization).toBe("Bearer AT-2");
        expect(saved).toEqual(["RT-2"]);
        expect(refreshes()).toHaveLength(1);
    });

    test("a rejected refresh is a BoostyError without the response body", async () => {
        const { http } = fakeBoosty({ refreshStatus: 400, status: () => 401 });
        const api = new API({ auth: Auth.fromTokens({ ...expired(), expiresAt: null }), httpClient: http });
        const error = await api.request("GET", "/v1/x").catch((e) => e);
        expect(error).toBeInstanceOf(BoostyError);
        expect(error.statusCode).toBe(400);
        expect(JSON.stringify(error.body) + error.message).not.toContain("SECRET");
    });
});

describe("API constructor", () => {
    test("options object and positional form both work", async () => {
        const { http } = fakeBoosty();
        const auth = Auth.fromCookies(cookieHeader());
        for (const api of [new API({ auth, httpClient: http }), new API(http, auth), new API(undefined, auth)]) {
            expect(api.auth).toBe(auth);
        }
        expect((await new API(http, auth).request("GET", "/v1/x")).authorization).toBe("Bearer AT-1");
    });
});

function deps(overrides: Partial<CliDeps> = {}) {
    const outLines: string[] = [];
    const errLines: string[] = [];
    const logins: unknown[] = [];
    return {
        prompt: async () => {
            throw new Error("unexpected prompt");
        },
        out: (l: string) => void outLines.push(l),
        err: (l: string) => void errLines.push(l),
        login: (async (o: unknown) => {
            logins.push(o);
            return Auth.fromCookies(cookieHeader());
        }) as CliDeps["login"],
        outLines,
        errLines,
        logins,
        ...overrides,
    };
}

describe("boosty-api login", () => {
    test("--cookie checks the session, saves the tokens and never prints them", async () => {
        const file = join(tmp(), "auth.json");
        const d = deps({ httpClient: fakeBoosty().http });
        expect(await runCli(["login", `--cookie=${cookieHeader()}`, "--file", file], d)).toBe(0);
        expect(JSON.parse(readFileSync(file, "utf-8"))).toMatchObject({ access_token: "AT-1", refresh_token: "RT-1", device_id: "device-1" });
        expect(d.outLines.join("\n")).toContain("Logged in as Mara");
        expect([...d.outLines, ...d.errLines].join("\n")).not.toMatch(/AT-1|RT-1/);
    });

    test("--cookie without a value prompts for it", async () => {
        const file = join(tmp(), "auth.json");
        const d = deps({ httpClient: fakeBoosty().http, prompt: async () => cookieHeader() });
        expect(await runCli(["login", "--cookie", "--file", file], d)).toBe(0);
        expect(existsSync(file)).toBe(true);
    });

    test("a dead session is not saved", async () => {
        const file = join(tmp(), "auth.json");
        // The access token is refused and so is the refresh token
        const { http } = fakeBoosty({ refreshStatus: 400, status: () => 401 });
        const d = deps({ httpClient: http });
        expect(await runCli(["login", `--cookie=${cookieHeader()}`, "--file", file], d)).toBe(1);
        expect(existsSync(file)).toBe(false);
        expect(d.errLines.join("\n")).toContain("rejected");
    });

    test("an existing file that is not an auth file is kept unless --force", async () => {
        const file = join(tmp(), "package.json");
        writeFileSync(file, '{"name":"x"}');
        const d = deps({ httpClient: fakeBoosty().http });
        expect(await runCli(["login", `--cookie=${cookieHeader()}`, "--file", file], d)).toBe(1);
        expect(readFileSync(file, "utf-8")).toBe('{"name":"x"}');
        expect(await runCli(["login", `--cookie=${cookieHeader()}`, `--file=${file}`, "--force"], d)).toBe(0);
    });

    test.skipIf(process.platform === "win32")("auth.json is written owner-only, also over an older file", async () => {
        const file = join(tmp(), "auth.json");
        writeFileSync(file, '{"access_token":"old"}', { mode: 0o644 });
        expect(await runCli(["login", `--cookie=${cookieHeader()}`, "--file", file], deps({ httpClient: fakeBoosty().http }))).toBe(0);
        expect(statSync(file).mode & 0o777).toBe(0o600);
    });

    test("without --cookie: browser login, or a note when the file already holds tokens", async () => {
        const file = join(tmp(), "auth.json");
        const d = deps();
        expect(await runCli(["login", "--file", file], d)).toBe(0);
        expect(d.logins).toEqual([{ authFile: file, force: true }]);

        writeFileSync(file, JSON.stringify(AuthData.fromCookies(cookieHeader()).toDict()));
        const again = deps();
        expect(await runCli(["login", "--file", file], again)).toBe(0);
        expect(again.logins).toEqual([]);
        expect(again.outLines.join("\n")).toContain("Already logged in");
    });

    test("bad arguments fail with usage and never echo values", async () => {
        const d = deps();
        expect(await runCli(["login", "--cookie", cookieHeader()], d)).toBe(1);
        expect(await runCli(["login", `--cooky=${cookieHeader()}`], d)).toBe(1);
        expect(await runCli(["login", "--file"], d)).toBe(1);
        expect(await runCli(["logout"], d)).toBe(1);
        expect(d.errLines.join("\n")).not.toMatch(/AT-1|RT-1|auth=/);
        expect(await runCli(["login", "--help"], deps())).toBe(0);
    });

    test("a rotation during the check is saved even when Boosty then refuses", async () => {
        const file = join(tmp(), "auth.json");
        // AT-1 is refused, the refresh succeeds, and the retry with AT-2 is refused too
        const { http, refreshes } = fakeBoosty({ status: () => 401 });
        const d = deps({ httpClient: http });
        expect(await runCli(["login", `--cookie=${cookieHeader()}`, "--file", file], d)).toBe(1);
        expect(refreshes()).toHaveLength(1);
        expect(JSON.parse(readFileSync(file, "utf-8")).refresh_token).toBe("RT-2");
    });

    test("an unwritable target fails before any request", async () => {
        const { http, calls } = fakeBoosty();
        const d = deps({ httpClient: http });
        expect(await runCli(["login", `--cookie=${cookieHeader()}`, "--file", join(tmp(), "missing", "auth.json")], d)).toBe(1);
        expect(calls).toHaveLength(0);
    });

    test("the account name is printed without control characters", async () => {
        const d = deps({ httpClient: fakeBoosty({ name: "Evil\u001b[2K\rMara‮" }).http });
        expect(await runCli(["login", `--cookie=${cookieHeader()}`, "--file", join(tmp(), "auth.json")], d)).toBe(0);
        expect(d.outLines.join("\n")).toContain("Logged in as Evil[2KMara.");
        expect(d.outLines.join("\n")).not.toMatch(/[\u001b\r‮]/);
    });

    test("an empty file may be overwritten", async () => {
        const file = join(tmp(), "auth.json");
        writeFileSync(file, "");
        expect(await runCli(["login", `--cookie=${cookieHeader()}`, "--file", file], deps({ httpClient: fakeBoosty().http }))).toBe(0);
    });
});

describe("storing refreshed tokens", () => {
    const expiredTokens = () => ({ accessToken: "AT-1", refreshToken: "RT-1", deviceId: "device-1", expiresAt: now() - 10 });

    test("a slow onRefresh runs once per rotation, however many requests wait", async () => {
        const { http } = fakeBoosty();
        let calls = 0;
        const onRefresh = async () => {
            calls++;
            await new Promise((r) => setTimeout(r, 50));
        };
        const api = new API({ auth: Auth.fromTokens(expiredTokens(), { onRefresh }), httpClient: http });
        await Promise.all(Array.from({ length: 8 }, () => api.request("GET", "/v1/x")));
        expect(calls).toBe(1);
    });

    test("while the store is down, waiting requests share one retry", async () => {
        const { http } = fakeBoosty();
        let calls = 0;
        const auth = Auth.fromTokens(expiredTokens(), {
            onRefresh: async () => {
                calls++;
                await new Promise((r) => setTimeout(r, 20));
                throw new Error("db down");
            },
        });
        const api = new API({ auth, httpClient: http });
        await api.request("GET", "/v1/x").catch(() => {});
        const results = await Promise.allSettled(Array.from({ length: 10 }, () => api.request("GET", "/v1/x")));
        expect(results.every((r) => r.status === "rejected" && r.reason instanceof TokenPersistError)).toBe(true);
        expect(calls).toBe(2);
    });

    test("a failing resolver does not stop onRefresh, and is retried on its own", async () => {
        class FlakyResolver extends MemoryAuthDataResolver {
            failures = 1;
            saved: string[] = [];
            override saveAuthData(): void {
                if (this.failures-- > 0) throw new Error("disk full");
                this.saved.push(this.authData.refresh_token!);
            }
        }
        // With a user agent set, the headers getter never saves on its own
        const resolver = new FlakyResolver(AuthData.fromTokens(expiredTokens(), "UA"));
        const callbacks: string[] = [];
        const api = new API({ auth: new Auth(resolver, { onRefresh: (t) => void callbacks.push(t.refreshToken) }), httpClient: fakeBoosty().http });
        await expect(api.request("GET", "/v1/x")).rejects.toBeInstanceOf(TokenPersistError);
        expect(callbacks).toEqual(["RT-2"]);
        await api.request("GET", "/v1/x");
        expect(resolver.saved).toEqual(["RT-2"]);
        expect(callbacks).toEqual(["RT-2"]);
    });
});

describe("storing refreshed tokens: edges", () => {
    const expiredTokens = () => ({ accessToken: "AT-1", refreshToken: "RT-1", deviceId: "device-1", expiresAt: now() - 10 });

    test("onRefresh may call the API itself without waiting for its own store", async () => {
        const { http } = fakeBoosty();
        let api!: API;
        const owners: string[] = [];
        const auth = Auth.fromTokens(expiredTokens(), {
            onRefresh: async () => void owners.push((await api.request("GET", "/v1/user/current")).name),
        });
        api = new API({ auth, httpClient: http });
        const result = await Promise.race([api.request("GET", "/v1/x"), new Promise((r) => setTimeout(() => r("deadlock"), 2000))]);
        expect(result).not.toBe("deadlock");
        expect(owners).toEqual(["Mara"]);
    });

    test("an auth file deleted mid-run does not drop the working tokens", async () => {
        const dir = tmp();
        const file = join(dir, "auth.json");
        writeFileSync(file, JSON.stringify({ ...AuthData.fromTokens(expiredTokens(), "UA").toDict() }));
        const api = new API({ auth: new Auth(new FileAuthDataResolver(file)), httpClient: fakeBoosty().http });
        await api.request("GET", "/v1/x");
        rmSync(file);
        // Expire again: the next refresh finds no file and must keep the set it holds
        (api.auth as unknown as { authData: AuthData }).authData.expires_at = String(now() - 10);
        expect((await api.request("GET", "/v1/x")).authorization).toBe("Bearer AT-3");
        expect(JSON.parse(readFileSync(file, "utf-8")).refresh_token).toBe("RT-3");
    });

    test("an anonymous 401 is a BoostyError, not a refresh attempt", async () => {
        const { http, refreshes } = fakeBoosty({ status: () => 401 });
        const api = new API({ auth: new Auth(new MemoryAuthDataResolver()), httpClient: http });
        const error = await api.request("GET", "/v1/x").catch((e) => e);
        expect(error).toBeInstanceOf(BoostyError);
        expect(error.statusCode).toBe(401);
        expect(refreshes()).toHaveLength(0);
    });
});

describe("token hygiene", () => {
    test("resolvers do not serialize their tokens", () => {
        const data = AuthData.fromCookies(cookieHeader());
        for (const resolver of [new MemoryAuthDataResolver(data), Object.assign(new FileAuthDataResolver("x.json"), { authData: data })] as ABCAuthDataResolver[]) {
            expect(JSON.stringify(resolver) + inspect(resolver)).not.toMatch(/AT-1|RT-1/);
        }
    });

    test("a hand-edited auth file with a broken token is refused without quoting it", () => {
        const file = join(tmp(), "auth.json");
        writeFileSync(file, JSON.stringify({ access_token: "SECRET\nTOKEN", refresh_token: "RT", device_id: "d" }));
        expect(() => new FileAuthDataResolver(file).loadAuthData()).toThrow(/malformed token/);
        try {
            new FileAuthDataResolver(file).loadAuthData();
        } catch (e) {
            expect((e as Error).message).not.toContain("SECRET");
        }
    });

    test("interactiveLogin keeps positional arguments, including force without a file name", () => {
        expect(loginOptions(undefined, "UA", true)).toEqual({ authFile: undefined, userAgent: "UA", force: true });
        expect(loginOptions("a.json")).toEqual({ authFile: "a.json", userAgent: undefined, force: undefined });
        expect(loginOptions({ authFile: null, force: true })).toEqual({ authFile: null, force: true });
    });
});
