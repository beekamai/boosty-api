/* backup-posts.ts — saves every post of a blog you can read as a Markdown file: text, links, image and file URLs. */
/* Run: bun run examples/backup-posts.ts <blog> [outDir=backup-<blog>]. Public posts work without auth.json. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { API, type Post } from "../src";

const blog = process.argv[2];
if (!blog) throw new Error("usage: bun run examples/backup-posts.ts <blog> [outDir]");
const outDir = process.argv[3] ?? `backup-${blog.replace(/[^\w-]/g, "_")}`;
mkdirSync(outDir, { recursive: true });

const api = new API();

/* Post text is written by the author: escape it so it stays text, and keep URLs inside <...>. */
const esc = (s: string) => s.replace(/[\\`*_[\]<>!#|~]/g, "\\$&");
const safeUrl = (url: string) => url.replace(/[<>\s]/g, encodeURIComponent);

interface Span {
    start: number;
    end: number;
    open: string;
    close: string;
}

/**
 * post.text gives plain text plus UTF-16 entities. Links, bold and italic become Markdown; at every range
 * boundary the open marks are closed back to the shared outer ones and reopened, so crossing ranges stay valid.
 */
function toMarkdown(post: Post): string {
    const [text, entities] = post.text;
    const spans: Span[] = [];
    for (const e of entities) {
        /* Only http(s) becomes a link, so a javascript: URL cannot turn clickable in a viewer. */
        const link = e.type === "text_link" && /^https?:\/\//i.test(e.url ?? "");
        let start = e.offset;
        let end = Math.min(e.offset + e.length, text.length);
        /* Markdown ignores ** next to whitespace: shrink each range to its visible characters. */
        while (start < end && /\s/.test(text[start])) start++;
        while (end > start && /\s/.test(text[end - 1])) end--;
        /* Italic takes _ so it never merges with a neighbouring **, except inside a word, where only * works. */
        const i = /[\p{L}\p{N}]/u.test(text[start - 1] ?? "") || /[\p{L}\p{N}]/u.test(text[end] ?? "") ? "*" : "_";
        const [open, close] = link ? ["[", `](<${safeUrl(e.url!)}>)`] : e.type === "bold" ? ["**", "**"] : e.type === "italic" ? [i, i] : ["", ""];
        if (open && start < end) spans.push({ start, end, open, close });
    }
    /* Outer ranges first: the order of the open-marks stack. */
    spans.sort((a, b) => a.start - b.start || b.end - a.end);
    /* Boosty stores a bold run split at block and range edges; touching runs of one style would print as "****". */
    for (let i = spans.length - 1; i > 0; i--) {
        const prev = spans.findLast((s, j) => j < i && s.open === spans[i].open && s.open !== "[" && s.end >= spans[i].start);
        if (!prev) continue;
        prev.end = Math.max(prev.end, spans[i].end);
        spans.splice(i, 1);
    }

    const cuts = [...new Set([0, text.length, ...spans.flatMap((s) => [s.start, s.end])])].sort((a, b) => a - b);
    let out = "";
    let stack: Span[] = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
        const active = spans.filter((s) => s.start <= cuts[i] && s.end >= cuts[i + 1]);
        let keep = 0;
        while (keep < stack.length && keep < active.length && stack[keep] === active[keep]) keep++;
        for (let j = stack.length - 1; j >= keep; j--) out += stack[j].close;
        for (let j = keep; j < active.length; j++) out += active[j].open;
        stack = active;
        out += esc(text.slice(cuts[i], cuts[i + 1]));
    }
    for (let j = stack.length - 1; j >= 0; j--) out += stack[j].close;
    /* A single newline does not break a Markdown paragraph. */
    return out.replace(/\n+/g, (m) => (m.length === 1 ? "\n\n" : m));
}

function attachments(post: Post): string[] {
    return (post.data ?? [])
        .map((b: any) => (b.type === "image" && b.url ? `![](<${safeUrl(b.url)}>)` : b.type === "file" && b.url ? `[${esc(b.title ?? "file")}](<${safeUrl(b.url)}>)` : null))
        .filter((line): line is string => line !== null);
}

let saved = 0;
let locked = 0;
let offset: string | undefined;
for (;;) {
    const page = await api.posts.list(blog, { limit: 20, offset });
    for (const post of page.data ?? []) {
        /* The id becomes a file name: accept only what Boosty ids look like. */
        if (!post.id || !/^[\w-]+$/.test(post.id)) continue;
        const day = new Date((post.publishTime ?? post.createdAt ?? 0) * 1000).toISOString().slice(0, 10);
        const body = post.hasAccess === false ? "_No access to this post with the current account._" : toMarkdown(post);
        if (post.hasAccess === false) locked++;
        const md = [`# ${esc(post.title || "(untitled)")}`, "", `${day} · <${post.url}>`, "", body, "", ...attachments(post)].join("\n");
        writeFileSync(join(outDir, `${day}-${post.id}.md`), md.trimEnd() + "\n");
        saved++;
    }
    const next = page.extra?.offset;
    if (page.extra?.isLast !== false || !next || next === offset) break;
    offset = next;
}
console.log(`${saved} posts saved to ${outDir}${locked ? `, ${locked} of them without access (title and link only)` : ""}`);
