/* configureLogging: level threshold, replaceable sink, the stderr default and what a request logs. */
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { API, Auth, MemoryAuthDataResolver, configureLogging, type HTTPClient, type Logger } from "../src";
import { logger } from "../src/utils/logging";

function capture(): { sink: Logger; lines: string[] } {
    const lines: string[] = [];
    return {
        lines,
        sink: {
            debug: (m) => lines.push(`debug:${m}`),
            info: (m) => lines.push(`info:${m}`),
            warn: (m) => lines.push(`warn:${m}`),
            error: (m) => lines.push(`error:${m}`),
        },
    };
}

const emitAll = () => {
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
};

afterEach(() => configureLogging({ level: "default", logger: null }));

/** Level filtering in a fresh process, so the default is checked with a known environment. */
function levelsSeenInChild(env: string | undefined): string {
    const childEnv: Record<string, string | undefined> = { ...process.env, BOOSTY_API_LOG: env };
    if (env === undefined) delete childEnv.BOOSTY_API_LOG;
    const code = `
        const { configureLogging, logger } = await import("./src/utils/logging.ts");
        const seen = [];
        configureLogging({ logger: { debug: () => seen.push("debug"), info: () => seen.push("info"), warn: () => seen.push("warn"), error: () => seen.push("error") } });
        logger.debug("x"); logger.info("x"); logger.warn("x"); logger.error("x");
        console.log(seen.join(","));`;
    const child = Bun.spawnSync([process.execPath, "-e", code], { env: childEnv, cwd: `${import.meta.dir}/..` });
    return child.stdout.toString().trim();
}

describe("configureLogging", () => {
    test("info is the default threshold; BOOSTY_API_LOG sets the starting level, junk values are ignored", () => {
        expect(levelsSeenInChild(undefined)).toBe("info,warn,error");
        expect(levelsSeenInChild("debug")).toBe("debug,info,warn,error");
        expect(levelsSeenInChild(" WARN ")).toBe("warn,error");
        expect(levelsSeenInChild("silent")).toBe("");
        expect(levelsSeenInChild("toString")).toBe("info,warn,error");
    });

    test("state left in an older shape by another copy of the package is repaired on load", () => {
        const code = `
            globalThis[Symbol.for("boosty-api.logging")] = { threshold: 5 };
            const { configureLogging, logger } = await import("./src/utils/logging.ts");
            const seen = [];
            configureLogging({ level: "default", logger: { debug: () => seen.push("debug"), info: () => seen.push("info"), warn: () => {}, error: () => {} } });
            logger.debug("x"); logger.info("x");
            console.log(seen.join(","));`;
        const env: Record<string, string | undefined> = { ...process.env };
        delete env.BOOSTY_API_LOG;
        const child = Bun.spawnSync([process.execPath, "-e", code], { env, cwd: `${import.meta.dir}/..` });
        expect(child.stderr.toString()).toBe("");
        expect(child.stdout.toString().trim()).toBe("info");
    });

    test("a throwing sink does not break the caller: the line goes to stderr", () => {
        const err = spyOn(console, "error").mockImplementation(() => {});
        try {
            configureLogging({ level: "info", logger: { warn: () => { throw new Error("sink down"); } } as any });
            expect(() => logger.warn("still here")).not.toThrow();
            expect(() => logger.error("no method")).not.toThrow();
            expect(err.mock.calls.map((c) => c[0])).toEqual(["[WARN] still here", "[ERROR] no method"]);
        } finally {
            err.mockRestore();
        }
    });

    test("each level keeps itself and everything above", () => {
        const expected: Record<string, string[]> = {
            debug: ["debug:d", "info:i", "warn:w", "error:e"],
            warn: ["warn:w", "error:e"],
            error: ["error:e"],
            silent: [],
        };
        for (const [level, want] of Object.entries(expected)) {
            const { sink, lines } = capture();
            configureLogging({ level: level as any, logger: sink });
            emitAll();
            expect(lines).toEqual(want);
        }
    });

    test("unknown levels are refused, including Object.prototype keys", () => {
        for (const bad of ["verbose", "toString", "constructor", ""]) {
            expect(() => configureLogging({ level: bad as any })).toThrow(TypeError);
        }
    });

    test("the default sink writes to stderr, never stdout", () => {
        const err = spyOn(console, "error").mockImplementation(() => {});
        const out = spyOn(console, "log").mockImplementation(() => {});
        try {
            configureLogging({ level: "debug" });
            emitAll();
            expect(err.mock.calls.map((c) => c[0])).toEqual(["[DEBUG] d", "[INFO] i", "[WARN] w", "[ERROR] e"]);
            expect(out).not.toHaveBeenCalled();
        } finally {
            err.mockRestore();
            out.mockRestore();
        }
    });

    test("a request logs its route at debug only", async () => {
        const http: HTTPClient = { request: async () => new Response("{}", { status: 200 }) };
        const api = new API(http, new Auth(new MemoryAuthDataResolver()));
        const quiet = capture();
        configureLogging({ level: "info", logger: quiet.sink });
        await api.request("GET", "/v1/blog/x/post/", { params: { secret: "q" }, anon: true });
        expect(quiet.lines).toEqual([]);

        const loud = capture();
        configureLogging({ level: "debug", logger: loud.sink });
        await api.request("GET", "/v1/blog/x/post/", { params: { secret: "q" }, anon: true });
        expect(loud.lines).toEqual(["debug:GET https://api.boosty.to/v1/blog/x/post/"]);
    });

    test("a client without a token says once why it got 401", async () => {
        const http: HTTPClient = { request: async () => new Response('{"error":"unauthorized"}', { status: 401 }) };
        const api = new API(http, new Auth(new MemoryAuthDataResolver()));
        const { sink, lines } = capture();
        configureLogging({ level: "info", logger: sink });
        for (let i = 0; i < 2; i++) await api.request("GET", "/v1/user/current").catch(() => null);
        await api.request("GET", "/v1/x", { anon: true }).catch(() => null);
        expect(lines.filter((l) => l.startsWith("warn:401 and this client has no token"))).toHaveLength(1);
    });
});
