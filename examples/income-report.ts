/* income-report.ts — your creator dashboard in the terminal: balance, the last N days, latest donations and payouts. */
/* Run: bun run examples/income-report.ts [days=30]. Needs auth.json (bun run login). */
import { API } from "../src";

const days = Number(process.argv[2] ?? 30);
if (!Number.isInteger(days) || days <= 0) throw new Error(`days must be a positive integer, got ${process.argv[2]}`);

const api = new API();
if (!api.auth.isAuthenticated) throw new Error("no auth.json: run `bun run login` first");

const me = await api.user.current();
if (!me.blogUrl) throw new Error("this account has no blog");
const blog = me.blogUrl;

const to = Math.floor(Date.now() / 1000);
const from = to - days * 86400;
const [summary, period, donations, payouts] = await Promise.all([
    api.stats.summary(blog),
    api.stats.metrics(blog, from, to),
    api.income.donations(blog, { limit: 5, sortBy: "time", order: "gt" }),
    api.income.payoutHistory(blog, { limit: 5 }),
]);

const date = (unix?: number) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : "—");
const money = (n?: number) => (n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const row = (label: string, value: string | number) => console.log(`  ${label.padEnd(28)}${value}`);

console.log(`\n${blog}: now`);
row("Balance", money(summary.balance));
row("On hold", money(summary.hold));
row("Paid out in total", money(summary.payoutSum));
row("Paying subscribers", summary.paidCount);
row("Followers", summary.followersCount);

console.log(`\nLast ${days} days`);
row("Earned", money(period.totalMoney));
row("  from subscriptions", money(period.incSubscribersMoney + period.recurrentsMoney + period.upSubscribersMoney));
row("  from donations", money(period.donationsMoney));
row("  from paid posts", money(period.postSaleMoney));
row("New subscribers", `+${period.incSubscribers}`);
row("Unsubscribed", `-${period.decSubscribers}`);
row("Renewals", period.recurrents);

console.log("\nLatest donations");
if (donations.data.length === 0) console.log("  none yet");
for (const d of donations.data) row(`${date(d.createdAt)}  ${d.user?.name ?? "anonymous"}`, `${money(d.amount)}  (${d.type ?? "?"})`);

console.log("\nLatest payouts");
if (payouts.data.length === 0) console.log("  none yet");
for (const p of payouts.data) {
    row(`${date(p.updatedAt)}  ${p.status ?? "?"}`, `${money(p.amount)} ${p.currency ?? ""}  (without fee ${money(p.amountWoFee)})`);
}
