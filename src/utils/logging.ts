/* utils/logging.ts — the library's logger: levels and a replaceable sink, quiet unless something needs attention. */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

/** Where log lines go. `console`, pino, winston or a test spy all fit: each method takes one message string. */
export interface Logger {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 50 };

const isLevel = (value: unknown): value is LogLevel => typeof value === "string" && Object.hasOwn(LEVELS, value);

/* stderr, so the stdout of a script using the library stays its own (CSV, JSON, reports). */
const stderrLogger: Logger = {
    debug: (message) => console.error(`[DEBUG] ${message}`),
    info: (message) => console.error(`[INFO] ${message}`),
    warn: (message) => console.error(`[WARN] ${message}`),
    error: (message) => console.error(`[ERROR] ${message}`),
};

function levelFromEnv(): LogLevel | undefined {
    try {
        const raw = typeof process === "undefined" ? undefined : process.env?.BOOSTY_API_LOG?.trim().toLowerCase();
        return isLevel(raw) ? raw : undefined;
    } catch {
        return undefined; // Deno without --allow-env throws on env access: keep the default level
    }
}

/* One state per process: the ESM and CJS builds loaded side by side must obey the same configureLogging call. */
const STATE_KEY = Symbol.for("boosty-api.logging");
interface LoggingState {
    initial: LogLevel;
    threshold: LogLevel;
    sink: Logger;
}
const host = globalThis as typeof globalThis & { [STATE_KEY]?: LoggingState };
const initial = levelFromEnv() ?? "info";
const state: LoggingState = (host[STATE_KEY] ??= { initial, threshold: initial, sink: stderrLogger });
/* Another copy of the package may have created the state in an older shape: fill in what is missing or invalid. */
if (!isLevel(state.initial)) state.initial = initial;
if (!isLevel(state.threshold)) state.threshold = state.initial;
if (!state.sink || typeof state.sink !== "object") state.sink = stderrLogger;

/**
 * Sets how much the library logs and where.
 * Default level is "info": login prompts, warnings and errors. "debug" adds every request (method and path,
 * never the query or body), "silent" turns logging off. The `BOOSTY_API_LOG` environment variable sets the
 * starting level, and `level: "default"` returns to it. `logger` replaces the stderr sink; `null` restores it.
 * A sink that throws does not break requests: that line goes to stderr instead.
 * @throws TypeError on an unknown level.
 */
export function configureLogging(options: { level?: LogLevel | "default"; logger?: Logger | null }): void {
    if (options.level !== undefined) {
        const level = options.level === "default" ? state.initial : options.level;
        if (!isLevel(level)) throw new TypeError(`Unknown log level: ${String(options.level)}`);
        state.threshold = level;
    }
    if (options.logger !== undefined) state.sink = options.logger ?? stderrLogger;
}

const emit =
    (level: Exclude<LogLevel, "silent">) =>
    (message: string): void => {
        if (LEVELS[level] < LEVELS[state.threshold]) return;
        try {
            state.sink[level](message);
        } catch {
            stderrLogger[level](message);
        }
    };

export const logger: Logger = { debug: emit("debug"), info: emit("info"), warn: emit("warn"), error: emit("error") };
