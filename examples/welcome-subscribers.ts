/* welcome-subscribers.ts — sends a direct message to everyone who subscribed since the last run, once per person. */
/* Run: bun run examples/welcome-subscribers.ts           dry run, lists who would get the message */
/*      bun run examples/welcome-subscribers.ts --send    sends it; welcome-state.json remembers who was greeted */
/* Made for cron or a timer: the first run looks one day back. Do not run two copies at once. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { API, buildMessage } from "../src";

const STATE_FILE = "welcome-state.json";
/* Each run also rereads this much of the previous window: late events and clock drift are caught, the greeted list stops repeats. */
const OVERLAP = 86400;
const MESSAGE = buildMessage([
    "Thank you for subscribing! Everything new lands in the blog first.",
    "Questions or ideas — just reply to this message.",
]);

interface State {
    since: number;
    greeted: number[];
}

const send = process.argv.includes("--send");
const api = new API();
if (!api.auth.isAuthenticated) throw new Error("no auth.json: run `bun run login` first");
const blog = (await api.user.current()).blogUrl;
if (!blog) throw new Error("this account has no blog");

const now = Math.floor(Date.now() / 1000);
const state: State = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf-8")) : { since: now - 86400, greeted: [] };
const greeted = new Set(state.greeted);
const from = state.since - OVERLAP;
/* Written after every message, so a crash halfway never greets the same people again. */
const save = (since: number) => writeFileSync(STATE_FILE, JSON.stringify({ since, greeted: [...greeted].slice(-10000) }));

/* Subscribe events of the window, all pages. The createdAt check also guards against a server that ignores `from`. */
const newcomers = new Map<number, string>();
let offset: string | number | undefined;
for (;;) {
    const page = await api.stats.events(blog, { from, to: now, eventTypes: ["subscribe"], limit: 50, offset });
    for (const e of page.events) {
        if (e.eventType === "subscribe" && e.user && e.createdAt >= from && !greeted.has(e.user.id)) newcomers.set(e.user.id, e.user.name);
    }
    const next = page.extra?.offset;
    if (page.extra?.isLast !== false || next === undefined || next === offset) break;
    offset = next;
}
console.log(`${newcomers.size} subscriber(s) to greet since ${new Date(from * 1000).toISOString()}`);

let failed = 0;
for (const [userId, name] of newcomers) {
    try {
        /* Boosty opens no dialog on subscription, and the subscriber may have DMs closed or donation-gated. */
        const probe = await api.messaging.dialogWithUser(userId);
        if (!probe.relation?.canWrite) {
            console.log(`  skip  ${name}: does not accept messages from you`);
            continue;
        }
        if (!send) {
            console.log(`  would greet ${name}`);
            continue;
        }
        const dialogId = probe.id ?? (await api.messaging.createDialog(userId)).id;
        if (dialogId === undefined) throw new Error("Boosty returned no dialog id");
        await api.messaging.sendMessage(dialogId, MESSAGE);
        greeted.add(userId);
        save(state.since);
        console.log(`  sent  ${name}`);
        await Bun.sleep(1000); /* a steady pace keeps a burst of DMs from looking like spam */
    } catch (e) {
        failed++;
        console.error(`  FAIL  ${name}: ${e instanceof Error ? e.message : e}`);
    }
}

/* The window moves on only when everyone was reached; whoever failed is retried, nobody is greeted twice. */
if (send && failed === 0) save(now);
if (!send) console.log("dry run: nothing was sent, run with --send to greet them");
if (failed > 0) process.exitCode = 1;
