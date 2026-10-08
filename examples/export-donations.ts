/* export-donations.ts — every donation your blog received, oldest first, into a CSV file. */
/* Run: bun run examples/export-donations.ts [out.csv] [--emails]. Payer e-mails are personal data: off unless --emails. */
import { writeFileSync } from "node:fs";
import { API } from "../src";

const args = process.argv.slice(2);
const withEmails = args.includes("--emails");
const outFile = args.find((a) => !a.startsWith("--")) ?? "donations.csv";

const api = new API();
if (!api.auth.isAuthenticated) throw new Error("no auth.json: run `bun run login` first");
const blog = (await api.user.current()).blogUrl;
if (!blog) throw new Error("this account has no blog");

/* Quotes every field; a leading = + - @ is prefixed so a donor's name cannot run as a spreadsheet formula. */
const cell = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`;
};

const header = ["id", "date", "amount", "attached_to", "target_id", "donor_id", "donor_name", ...(withEmails ? ["donor_email"] : [])];
const rows: unknown[][] = [];
let offset: string | undefined;
for (;;) {
    const page = await api.income.donations(blog, { limit: 50, sortBy: "time", order: "lt", offset });
    for (const d of page.data) {
        rows.push([
            d.id,
            d.createdAt ? new Date(d.createdAt * 1000).toISOString() : "",
            d.amount,
            d.type,
            d.targetId,
            d.user?.id,
            d.user?.name,
            ...(withEmails ? [d.user?.email] : []),
        ]);
    }
    /* The API hands out a next cursor even past the last row: stop on an empty page or once `total` is reached. */
    const next = page.extra?.offset;
    if (page.data.length === 0 || !next || next === offset || rows.length >= (page.extra?.total ?? Infinity)) break;
    offset = next;
}

/* The BOM makes Excel read the file as UTF-8, so Cyrillic names survive. */
writeFileSync(outFile, "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n");
console.log(`${rows.length} donations written to ${outFile}${withEmails ? " (with payer e-mails: keep the file private)" : ""}`);
