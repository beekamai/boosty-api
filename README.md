# boosty-api

[![npm](https://img.shields.io/npm/v/boosty-api?logo=npm&color=cb3837)](https://www.npmjs.com/package/boosty-api)
[![GitHub](https://img.shields.io/github/stars/beekamai/boosty-api?logo=github&label=GitHub)](https://github.com/beekamai/boosty-api)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.1-000000?logo=bun&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-3da639)
[![CI](https://github.com/beekamai/boosty-api/actions/workflows/ci.yml/badge.svg)](https://github.com/beekamai/boosty-api/actions/workflows/ci.yml)

🇬🇧 [English](#english) · 🇷🇺 [Русский](#русский)

---

## English

Unofficial TypeScript client for the **internal** [Boosty](https://boosty.to) API — a port and
extension of [`barsikus007/boosty`](https://github.com/barsikus007/boosty), Bun-first. It covers what you
need to run a blog from code: posts, comments, messaging, your account, blog statistics and the whole income
side (sales, donations, holds, payouts). It does not wrap every route the Boosty web client calls.

> ⚠️ This is an **undocumented** internal API. It can change without notice. Use it only to access
> **your own** content and within Boosty's Terms of Service.

### Features

- 📦 **Resource namespaces** — `api.posts`, `api.comments`, `api.blog`, `api.user`, `api.media`, `api.social`, `api.feed`, `api.search`, `api.messaging`, `api.income`, `api.stats`, `api.targets`.
- 📊 **Creator dashboard** — `api.stats` and `api.income` read everything the Boosty statistics and payouts pages show.
- 🔓 **Anonymous mode** — public posts/comments/profile work without a token.
- 🔐 **Easy auth** — `npx boosty-api login` (browser or a pasted Cookie header), `Auth.fromTokens` for servers; tokens refresh before expiry and after a 401.
- 🧩 **Tolerant models** — unknown response fields are preserved (resilient to Boosty schema drift).
- 🏷️ **Honest status tags** — every method is annotated `@verified` / `@experimental` / `@unverified`.
- 🔇 **Quiet by default** — only warnings reach stderr; `configureLogging` or `BOOSTY_API_LOG=debug` shows requests, any logger plugs in.
- 🧰 **Ready-made scripts** — income report, donations CSV export, subscriber welcome, post backup in [`examples/`](examples).

### Quick start

```bash
npm install boosty-api      # or: bun add boosty-api / pnpm add boosty-api
```

Works on both **Node 18+** and **Bun** (ships ESM + CJS builds and type declarations).

```ts
import { API } from "boosty-api";

const api = new API(); // anonymous if no auth.json

// Public post (works without a token)
const post = await api.posts.get("boosty", "c9fb8a19-c45e-4602-9942-087c3af28c1b");
console.log(post.title, post.url);
const [text] = post.text; // rendered text + entities

// Blog feed, profile, subscription levels
const { data } = await api.posts.list("boosty", { limit: 10 });
const profile = await api.blog.profile("boosty");
const levels = await api.blog.subscriptionLevels("boosty");
```

> Interactive browser login (`interactiveLogin`) needs `puppeteer`, an optional peer dependency that is not
> installed for you: `npm i puppeteer` (version 23 or newer; puppeteer 25 needs Node 22.12+). Everything else
> works without it.

### Authentication

Public endpoints work anonymously. For your own content and account operations, log in once:

```bash
npx boosty-api login            # opens a browser window; needs `npm i boosty-api puppeteer`
npx boosty-api login --cookie   # or paste the Cookie header of any boosty.to request
```

Both save the session to `auth.json`, and `new API()` picks it up. Keep the file out of git: it is
owner-only on Linux and macOS, on Windows it inherits the folder's permissions.

To get the Cookie header: log in at boosty.to in a private window, open DevTools → Network, click any
request to boosty.to and copy the value of `cookie` under Request Headers. Then close the window without
logging out: a browser that stays open refreshes the same tokens, and Boosty keeps only the newest.

The same from code:

```ts
import { API, Auth, interactiveLogin } from "boosty-api";

const api = new API({ auth: Auth.fromCookies(process.env.BOOSTY_COOKIE!) }); // the Cookie header
const viaBrowser = new API({ auth: await interactiveLogin() });         // saved to auth.json
```

**On a server**, keep the tokens with your other secrets and store every refresh: Boosty rotates the
refresh token, and the old one stops working.

```ts
const auth = Auth.fromTokens(
  { accessToken, refreshToken, deviceId },                // deviceId is the `_clientId` cookie
  { onRefresh: (tokens) => db.saveBoostyTokens(tokens) }, // awaited; if it throws, the request fails with TokenPersistError
);
const api = new API({ auth });
```

Tokens are refreshed before they expire and after a 401, and concurrent requests share one refresh.
Until the new set is stored, requests fail with `TokenPersistError` and storing is retried before each
one. Without `onRefresh` the refreshed tokens live in memory only, and a warning says so. `auth.tokens`
returns the current set at any time.

### API status legend

**✅ verified** — confirmed by a live response (200, or 401 "auth required" = path exists).
**🟡 experimental** — path reconstructed from the web client, not confirmed end-to-end.
**❔ unverified** — exact path not found yet.

| Namespace | Methods (selected) | Status |
|---|---|---|
| `posts` | `list` `get` `create` `update` `delete` `getDeferredAccess` `updateDeferredAccess` | ✅ reads / 🟡 writes |
| `comments` | `list` `replies` (by the parent's `intId`) `create` `react` `removeReaction` `like` `unlike` | ✅ list, replies / 🟡 rest |
| `blog` | `profile` `subscribers` `subscriptionLevels` `subscriptionLevel` `blacklist` `unsubscribeReasons` `poll` `pollVoters` | ✅ / 🟡 polls |
| `user` | reads: `current` `subscriptions` `sessions` `notificationSettings` `paymentCards` `availableBlogCurrencies`; writes: `updateProfile` `updateNotificationSetting` `updateDialogSettings` `setLocale` `endSessions` | ✅ reads / 🟡 writes |
| `media` | `list` (media_album; `type`: `all` `image` `video` `audio`) | ✅ |
| `social` | `reactToPost` `removePostReaction` `likePost` `unlikePost` `vote` `voteOption` `removeVote` | 🟡 |
| `feed` | `posts` `searchBlogs` | ✅ |
| `search` | `postsInFeed` `postsInBlog` `blogSuggest` `feedTags` | ✅ |
| `messaging` | `dialogs` `dialogWithUser` `createDialog` `messages` `sendMessage` `notifications` `markNotificationsRead` `deleteNotification(s)` | ✅ / 🟡 notification deletes |
| `income` | `postSales` `donations` `bundleSales` `holds` `broadcastSales` `postSalesByDate` `postSalesDays` `bundleSalesByDate` `bundleSalesDays` `payoutMethods` `payouts` `payoutHistory` `defaultCurrency` | ✅ |
| `stats` | `summary` `metrics` `charts` `events` `visits` `paymentSources` `referrals` `referralUsers` `searchUsers` `reportInfo` `report` `post` | ✅ / 🟡 `post` |
| `targets` | reads: `list` `get`; writes: `createMoney` `createSubscribers` `edit` `remove` | ✅ reads / 🟡 writes |

Sales lists sort with `order: "gt"` (newest or largest first) or `"lt"`. `income.sales` is deprecated: the web client does not call it. `stats.report` builds a new report file on
every call, `reportInfo` returns the last one. Donation payers and payout data include e-mail addresses
and amounts: treat them as personal data.

Legacy aliases `api.getPost`, `api.getPostComments`, `api.request` are kept for compatibility.

### Recipes

**Pagination** — post lists return `extra.offset` and `extra.isLast`; pass the offset back until `isLast`:

```ts
let offset: string | undefined;
let isLast = false;
while (!isLast) {
  const page = await api.posts.list("boosty", { limit: 20, offset });
  for (const post of page.data ?? []) console.log(post.title);
  offset = page.extra?.offset;
  isLast = page.extra?.isLast ?? true;
}
```

Other lists page differently: stat events carry `extra.isLast` too, subscribers return `offset` / `total` at
the top level, dialogs in `extra`. Sales lists and payout history hand out a string cursor with
`extra.total`, and the cursor keeps coming past the last row, so stop on an empty page or on the total:

```ts
const donations = [];
let offset: string | undefined;
for (;;) {
  const page = await api.income.donations(blog, { limit: 50, offset });
  donations.push(...page.data);
  if (page.data.length === 0 || donations.length >= (page.extra?.total ?? Infinity) || !page.extra?.offset) break;
  offset = page.extra.offset;
}
```

**Send a message** — build content blocks with `buildMessage`:

```ts
import { API, buildMessage } from "boosty-api";

const blocks = buildMessage(["Hi! Here is your link:", { link: "https://example.com/sub" }]);
await api.messaging.sendMessage(dialogId, blocks);
```

**Write to a subscriber first** — Boosty does not open a conversation when someone subscribes, so
there is no dialog to post into. Probe the relation, create the dialog, then send. Always check
`canWrite`: a subscriber may have DMs closed or donation-gated, and posting is refused.

```ts
const probe = await api.messaging.dialogWithUser(userId);
if (!probe.relation?.canWrite) throw new Error("this user cannot be messaged first");

const dialogId = probe.id ?? (await api.messaging.createDialog(userId)).id;
await api.messaging.sendMessage(dialogId, buildMessage(["Here is your link:", { link: url }]));
```

**Creator statistics and income** — numbers from the dashboard, timestamps in Unix seconds:

```ts
const blog = (await api.user.current()).blogUrl;
if (!blog) throw new Error("this account has no blog");
const now = Math.floor(Date.now() / 1000);

const summary = await api.stats.summary(blog); // balance, hold, income, payoutSum, followersCount
const month = await api.stats.metrics(blog, now - 30 * 86400, now); // totalMoney, donationsMoney, incSubscribers…
const { data: donations } = await api.income.donations(blog, { limit: 20, sortBy: "time", order: "gt" });
const payouts = await api.income.payoutHistory(blog);
```

**Render post text** — `post.text` (or `renderText(blocks)` for comments and blog descriptions) gives plain
text plus Telegram-style entities:

```ts
const [text, entities] = post.text;
// entities: { type: "text_link" | "bold" | "italic" | "underline", offset, length, url? }, offsets in UTF-16 units
```

Paragraphs are separated by newlines, headings and list items (`- ` / `1. `) are rendered as text, media
blocks become the placeholder (`"\n\n"` by default). Malformed blocks are skipped. The `url` of a `text_link`
is passed through as the author wrote it, `javascript:` included: check the scheme before putting it into HTML.

Old posts carry two artifacts of the Boosty editor: an emoji in a link split in half, and an auto-detected link
that swallowed the first word of the next paragraph into its URL. `renderText(post.data, { repair: true })` (or
`repairBlocks(blocks)`) fixes both on a copy. It is experimental: the rules come from a scan of 859 public posts.

**Logging** — the library is quiet by default: login prompts, warnings and errors go to stderr. Turn on
request lines while debugging, silence it, or hand the lines to your own logger:

```ts
import { configureLogging } from "boosty-api";

configureLogging({ level: "debug" });          // + every request: method and path, never query or body
configureLogging({ level: "silent" });         // nothing at all
configureLogging({ logger: pino() });          // any object with debug/info/warn/error(message)
```

The `BOOSTY_API_LOG` environment variable (`debug`, `info`, `warn`, `error`, `silent`) sets the starting level
without touching code: `BOOSTY_API_LOG=debug bun run examples/income-report.ts`.

**Handle errors** — failed requests throw `BoostyError` with status code and body:

```ts
import { BoostyError } from "boosty-api";

try {
  await api.posts.get("boosty", "non-existent-id");
} catch (e) {
  if (e instanceof BoostyError) console.error(e.statusCode, e.body);
  else throw e;
}
```

Ids go into request paths as single encoded segments. An id that is empty, `.` or `..`, or contains `/` or
`\` throws `TypeError` before any request is sent. When you call `api.request` with values you did not write
yourself, build the path with `apiPath`:

```ts
import { apiPath } from "boosty-api";

await api.request("GET", apiPath`/v1/blog/${blogName}/post/`);
```

### Examples

Runnable scripts in [`examples/`](examples). Clone the repo, run `bun install` and `bun run login`, then
`bun run examples/<script>`:

| Script | What it does |
|---|---|
| [`income-report.ts`](examples/income-report.ts) `[days]` | Balance, what the last N days earned and from where, new and lost subscribers, latest donations and payouts. |
| [`export-donations.ts`](examples/export-donations.ts) `[out.csv] [--emails]` | Every donation into a CSV file, page by page. Payer e-mails only with `--emails`; names cannot run as spreadsheet formulas. |
| [`welcome-subscribers.ts`](examples/welcome-subscribers.ts) `[--send]` | Direct message to everyone who subscribed since the last run, skipping people with closed DMs. Dry run unless `--send`; made for cron. |
| [`backup-posts.ts`](examples/backup-posts.ts) `<blog> [dir]` | Every post you can read as a Markdown file with links, bold, italic, images and files. Public posts work without a token. |

### Note on `declare` fields

Models extend `BaseObject`, which copies response fields in its constructor. Bun transpiles class
fields with **define semantics**, so a plain `title?: string` would run `this.title = undefined`
*after* `super(data)` and wipe the copied value. Therefore every model field populated from a
response is declared with `declare` (type-only, no runtime code). See `tsconfig.json`.

<details>
<summary>Project layout</summary>

```
src/
  index.ts        public entry point (barrel exports)
  client.ts       API core: request() + resource assembly + legacy aliases
  http.ts         HTTPClient (native fetch), RequestOptions, ApiCore, BaseResource, BoostyError
  auth/           Auth, AuthData, File- and MemoryAuthDataResolver
  cli.ts, cli/    the `boosty-api login` command
  resources/      posts, comments, blog, user, media, social, feed, messaging, income
  types/          models (extend BaseObject; fields use `declare`)
  utils/          logging, post (renderText), video (getVideoSizes), browser_login (Puppeteer), message (textBlock, linkBlock, buildMessage), consts
examples/         demo.ts, login.ts
test/             bun:test suites
```
</details>

### Contributing

Pull requests are checked by CI before review:

- typecheck, `bun test` and build;
- the npm package contains only `dist/`, `README.md` and `LICENSE`, and both builds load on Node 18;
- PR guard: fails on bidi / zero-width characters and on credential files (`auth.json`, `.env`, keys),
  warns when `package.json`, build config or workflows change.

Same checks locally: `bun install && bun run typecheck && bun test && bun run build`.

Every merged pull request is credited by name in the release notes and appears under [Contributors](#contributors).

### License

MIT.

---

## Русский

Неофициальный TypeScript-клиент **внутреннего** API [Boosty](https://boosty.to) — порт и расширение
[`barsikus007/boosty`](https://github.com/barsikus007/boosty), на Bun. Покрывает то, что нужно для ведения
блога из кода: посты, комментарии, сообщения, свой аккаунт, статистику блога и весь доход (продажи, донаты,
холды, выплаты). Не все маршруты, которые вызывает веб-клиент Boosty, обёрнуты.

> ⚠️ Это **недокументированный** внутренний API. Он может измениться без предупреждения. Используйте
> только для доступа к **своему** контенту и в рамках правил Boosty.

### Возможности

- 📦 **Resource-неймспейсы** — `api.posts`, `api.comments`, `api.blog`, `api.user`, `api.media`, `api.social`, `api.feed`, `api.search`, `api.messaging`, `api.income`, `api.stats`, `api.targets`.
- 📊 **Кабинет автора** — `api.stats` и `api.income` читают всё, что показывают страницы статистики и выплат Boosty.
- 🔓 **Анонимный режим** — публичные посты/комментарии/профиль работают без токена.
- 🔐 **Простой вход** — `npx boosty-api login` (браузер или вставленный заголовок Cookie), `Auth.fromTokens` для серверов; токены обновляются до истечения и после 401.
- 🧩 **Толерантные модели** — неизвестные поля ответа сохраняются (устойчивость к изменениям схемы Boosty).
- 🏷️ **Честные метки статуса** — у каждого метода JSDoc `@verified` / `@experimental` / `@unverified`.
- 🔇 **Тихо по умолчанию** — в stderr только предупреждения; `configureLogging` или `BOOSTY_API_LOG=debug` покажут запросы, подключается любой логгер.
- 🧰 **Готовые скрипты** — отчёт о доходе, выгрузка донатов в CSV, приветствие подписчиков, бэкап постов в [`examples/`](examples).

### Быстрый старт

```bash
npm install boosty-api      # либо: bun add boosty-api / pnpm add boosty-api
```

Работает на **Node 18+** и **Bun** (поставляется ESM + CJS сборка и декларации типов).

```ts
import { API } from "boosty-api";

const api = new API(); // анонимно, если нет auth.json

// Публичный пост (работает без токена)
const post = await api.posts.get("boosty", "c9fb8a19-c45e-4602-9942-087c3af28c1b");
console.log(post.title, post.url);
const [text] = post.text; // отрендеренный текст + entities

// Лента блога, профиль, уровни подписки
const { data } = await api.posts.list("boosty", { limit: 10 });
const profile = await api.blog.profile("boosty");
const levels = await api.blog.subscriptionLevels("boosty");
```

> Интерактивный вход через браузер (`interactiveLogin`) требует `puppeteer` — необязательную peer-зависимость,
> которая сама не ставится: `npm i puppeteer` (версия 23 и новее; puppeteer 25 требует Node 22.12+). Всё
> остальное работает без неё.

```bash
bun run dev          # запуск examples/demo.ts
bun run typecheck    # tsc --noEmit
```

### Авторизация

Публичные эндпоинты работают анонимно. Для своего контента и операций с аккаунтом войдите один раз:

```bash
npx boosty-api login            # откроет окно браузера; нужен `npm i boosty-api puppeteer`
npx boosty-api login --cookie   # или вставьте заголовок Cookie любого запроса к boosty.to
```

Оба способа сохраняют сессию в `auth.json`, `new API()` её подхватывает. В git файл не коммитить: на Linux и
macOS он доступен только владельцу, на Windows наследует права папки.

Где взять заголовок Cookie: войдите на boosty.to в приватном окне, откройте DevTools → Network, выберите любой
запрос к boosty.to и скопируйте значение `cookie` в Request Headers. Потом закройте окно, не выходя из
аккаунта: открытый браузер обновляет те же токены, а Boosty оставляет в живых только последние.

То же из кода:

```ts
import { API, Auth, interactiveLogin } from "boosty-api";

const api = new API({ auth: Auth.fromCookies(process.env.BOOSTY_COOKIE!) }); // заголовок Cookie
const viaBrowser = new API({ auth: await interactiveLogin() });         // сохранится в auth.json
```

**На сервере** храните токены вместе с остальными секретами и сохраняйте каждое обновление: Boosty меняет
refresh-токен при каждом refresh, старый перестаёт работать.

```ts
const auth = Auth.fromTokens(
  { accessToken, refreshToken, deviceId },                // deviceId — это cookie `_clientId`
  { onRefresh: (tokens) => db.saveBoostyTokens(tokens) }, // ожидается; если бросит — запрос упадёт с TokenPersistError
);
const api = new API({ auth });
```

Токены обновляются до истечения и после 401, параллельные запросы делят одно обновление. Пока новый набор
не сохранён, запросы падают с `TokenPersistError`, а сохранение повторяется перед каждым из них. Без
`onRefresh` обновлённые токены живут только в памяти, об этом будет предупреждение. `auth.tokens` в любой
момент отдаёт текущий набор.

### Легенда статусов API

**✅ verified** — подтверждён живым ответом (200, либо 401 «нужен токен» = путь существует).
**🟡 experimental** — путь восстановлен из веб-клиента, не проверен сквозным ответом.
**❔ unverified** — точный путь пока не найден.

| Неймспейс | Методы (выборочно) | Статус |
|---|---|---|
| `posts` | `list` `get` `create` `update` `delete` `getDeferredAccess` `updateDeferredAccess` | ✅ чтение / 🟡 запись |
| `comments` | `list` `replies` (по `intId` родителя) `create` `react` `removeReaction` `like` `unlike` | ✅ list, replies / 🟡 остальное |
| `blog` | `profile` `subscribers` `subscriptionLevels` `subscriptionLevel` `blacklist` `unsubscribeReasons` `poll` `pollVoters` | ✅ / 🟡 опросы |
| `user` | чтение: `current` `subscriptions` `sessions` `notificationSettings` `paymentCards` `availableBlogCurrencies`; запись: `updateProfile` `updateNotificationSetting` `updateDialogSettings` `setLocale` `endSessions` | ✅ чтение / 🟡 запись |
| `media` | `list` (media_album; `type`: `all` `image` `video` `audio`) | ✅ |
| `social` | `reactToPost` `removePostReaction` `likePost` `unlikePost` `vote` `voteOption` `removeVote` | 🟡 |
| `feed` | `posts` `searchBlogs` | ✅ |
| `search` | `postsInFeed` `postsInBlog` `blogSuggest` `feedTags` | ✅ |
| `messaging` | `dialogs` `dialogWithUser` `createDialog` `messages` `sendMessage` `notifications` `markNotificationsRead` `deleteNotification(s)` | ✅ / 🟡 удаление уведомлений |
| `income` | `postSales` `donations` `bundleSales` `holds` `broadcastSales` `postSalesByDate` `postSalesDays` `bundleSalesByDate` `bundleSalesDays` `payoutMethods` `payouts` `payoutHistory` `defaultCurrency` | ✅ |
| `stats` | `summary` `metrics` `charts` `events` `visits` `paymentSources` `referrals` `referralUsers` `searchUsers` `reportInfo` `report` `post` | ✅ / 🟡 `post` |
| `targets` | чтение: `list` `get`; запись: `createMoney` `createSubscribers` `edit` `remove` | ✅ чтение / 🟡 запись |

Списки продаж сортируются `order: "gt"` (сначала новые или крупные) или `"lt"`. `income.sales` устарел: веб-клиент его не вызывает. `stats.report` при каждом вызове собирает новый файл
отчёта, `reportInfo` возвращает последний. В донатах и выплатах есть e-mail плательщиков и суммы —
обращайтесь с ними как с персональными данными.

Легаси-алиасы `api.getPost`, `api.getPostComments`, `api.request` сохранены для совместимости.

### Рецепты

**Пагинация** — списки постов возвращают `extra.offset` и `extra.isLast`; передаём offset обратно, пока не `isLast`:

```ts
let offset: string | undefined;
let isLast = false;
while (!isLast) {
  const page = await api.posts.list("boosty", { limit: 20, offset });
  for (const post of page.data ?? []) console.log(post.title);
  offset = page.extra?.offset;
  isLast = page.extra?.isLast ?? true;
}
```

Другие списки листаются иначе: у событий статистики тоже есть `extra.isLast`, у подписчиков `offset` /
`total` лежат на верхнем уровне, у диалогов — в `extra`. Списки продаж и история выплат отдают строковый
курсор и `extra.total`, причём курсор приходит и после последней строки — останавливайтесь на пустой
странице или по total:

```ts
const donations = [];
let offset: string | undefined;
for (;;) {
  const page = await api.income.donations(blog, { limit: 50, offset });
  donations.push(...page.data);
  if (page.data.length === 0 || donations.length >= (page.extra?.total ?? Infinity) || !page.extra?.offset) break;
  offset = page.extra.offset;
}
```

**Отправка сообщения** — собираем блоки контента через `buildMessage`:

```ts
import { API, buildMessage } from "boosty-api";

const blocks = buildMessage(["Привет! Вот твоя ссылка:", { link: "https://example.com/sub" }]);
await api.messaging.sendMessage(dialogId, blocks);
```

**Первое сообщение подписчику** — при подписке Boosty не открывает диалог, писать некуда. Проверяем
отношения, создаём диалог и только потом отправляем. Всегда смотрите `canWrite`: у подписчика могут быть
закрыты личные сообщения или открыты только за донат, и отправка будет отклонена.

```ts
const probe = await api.messaging.dialogWithUser(userId);
if (!probe.relation?.canWrite) throw new Error("этому пользователю нельзя написать первым");

const dialogId = probe.id ?? (await api.messaging.createDialog(userId)).id;
await api.messaging.sendMessage(dialogId, buildMessage(["Ваша ссылка:", { link: url }]));
```

**Статистика и доход автора** — цифры из кабинета, время в Unix-секундах:

```ts
const blog = (await api.user.current()).blogUrl;
if (!blog) throw new Error("у этого аккаунта нет блога");
const now = Math.floor(Date.now() / 1000);

const summary = await api.stats.summary(blog); // balance, hold, income, payoutSum, followersCount
const month = await api.stats.metrics(blog, now - 30 * 86400, now); // totalMoney, donationsMoney, incSubscribers…
const { data: donations } = await api.income.donations(blog, { limit: 20, sortBy: "time", order: "gt" });
const payouts = await api.income.payoutHistory(blog);
```

**Текст поста** — `post.text` (или `renderText(blocks)` для комментариев и описания блога) отдаёт обычный
текст и сущности в стиле Telegram:

```ts
const [text, entities] = post.text;
// entities: { type: "text_link" | "bold" | "italic" | "underline", offset, length, url? }, смещения в UTF-16
```

Абзацы разделены переводом строки, заголовки и пункты списков (`- ` / `1. `) выводятся текстом, медиа-блоки
заменяются плейсхолдером (по умолчанию `"\n\n"`). Битые блоки пропускаются. `url` у `text_link` отдаётся
как его написал автор, включая `javascript:`: проверяйте схему, прежде чем вставлять в HTML.

В старых постах встречаются два артефакта редактора Boosty: разрезанное пополам эмодзи в ссылке и авто-ссылка,
утащившая в URL первое слово следующего абзаца. `renderText(post.data, { repair: true })` (или
`repairBlocks(blocks)`) чинит оба на копии блоков. Экспериментально: правила выведены из 859 публичных постов.

**Логи** — по умолчанию библиотека молчит: в stderr идут только подсказки входа, предупреждения и ошибки.
Запросы можно включить для отладки, логи — выключить совсем или отдать своему логгеру:

```ts
import { configureLogging } from "boosty-api";

configureLogging({ level: "debug" });          // + каждый запрос: метод и путь, без query и тела
configureLogging({ level: "silent" });         // ничего
configureLogging({ logger: pino() });          // любой объект с debug/info/warn/error(message)
```

Переменная окружения `BOOSTY_API_LOG` (`debug`, `info`, `warn`, `error`, `silent`) задаёт стартовый уровень без
правки кода: `BOOSTY_API_LOG=debug bun run examples/income-report.ts`.

**Обработка ошибок** — неуспешные запросы бросают `BoostyError` со статусом и телом:

```ts
import { BoostyError } from "boosty-api";

try {
  await api.posts.get("boosty", "non-existent-id");
} catch (e) {
  if (e instanceof BoostyError) console.error(e.statusCode, e.body);
  else throw e;
}
```

Id подставляются в путь запроса как один закодированный сегмент. Пустой id, `.` или `..`, а также id с `/` или
`\` бросают `TypeError` ещё до отправки запроса. Если вызываете `api.request` со значениями, которые писали не
вы, собирайте путь через `apiPath`:

```ts
import { apiPath } from "boosty-api";

await api.request("GET", apiPath`/v1/blog/${blogName}/post/`);
```

### Примеры

Готовые скрипты в [`examples/`](examples). Клонируйте репозиторий, выполните `bun install` и `bun run login`,
затем `bun run examples/<скрипт>`:

| Скрипт | Что делает |
|---|---|
| [`income-report.ts`](examples/income-report.ts) `[дни]` | Баланс, сколько принесли последние N дней и откуда, новые и ушедшие подписчики, последние донаты и выплаты. |
| [`export-donations.ts`](examples/export-donations.ts) `[out.csv] [--emails]` | Все донаты в CSV-файл, постранично. E-mail плательщиков только с `--emails`; имена не исполнятся как формулы в таблице. |
| [`welcome-subscribers.ts`](examples/welcome-subscribers.ts) `[--send]` | Личное сообщение всем, кто подписался с прошлого запуска; закрытые личку пропускает. Без `--send` — пробный прогон; рассчитан на cron. |
| [`backup-posts.ts`](examples/backup-posts.ts) `<блог> [папка]` | Все доступные посты в Markdown-файлы со ссылками, жирным, курсивом, картинками и файлами. Публичные посты — без токена. |

### Про поля `declare`

Модели наследуют `BaseObject`, который копирует поля ответа в конструкторе. Bun транспилирует поля
класса с **define-семантикой**, поэтому обычное `title?: string` выполнилось бы как
`this.title = undefined` *после* `super(data)` и затёрло бы скопированное значение. Поэтому все поля
моделей, наполняемые из ответа, объявлены через `declare` (только тип, без рантайм-кода). См.
`tsconfig.json`.

<details>
<summary>Структура проекта</summary>

```
src/
  index.ts        публичная точка входа (barrel-экспорт)
  client.ts       ядро API: request() + сборка ресурсов + легаси-алиасы
  http.ts         HTTPClient (нативный fetch), RequestOptions, ApiCore, BaseResource, BoostyError
  auth/           Auth, AuthData, File- и MemoryAuthDataResolver
  cli.ts, cli/    команда `boosty-api login`
  resources/      posts, comments, blog, user, media, social, feed, messaging, income
  types/          модели (наследуют BaseObject; поля через `declare`)
  utils/          logging, post (renderText), video (getVideoSizes), browser_login (Puppeteer), message (textBlock, linkBlock, buildMessage), consts
examples/         demo.ts, login.ts
test/             bun:test suites
```
</details>

### Участие

Pull request'ы проверяются CI до ревью:

- тайпчек, `bun test` и сборка;
- в npm-пакет попадают только `dist/`, `README.md` и `LICENSE`, обе сборки грузятся на Node 18;
- PR guard: падает на bidi / zero-width символах и файлах с секретами (`auth.json`, `.env`, ключи),
  предупреждает, если менялись `package.json`, конфиги сборки или workflow.

Те же проверки локально: `bun install && bun run typecheck && bun test && bun run build`.

Каждый влитый pull request отмечается по имени в заметках к релизу и попадает в [Contributors](#contributors).

### Лицензия

MIT.

---

## Contributors

Everyone who contributed code. Thank you! · Все, кто внёс код в проект. Спасибо!

<a href="https://github.com/beekamai/boosty-api/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=beekamai/boosty-api" alt="Contributors" />
</a>

What each one did is credited in the [release notes](https://github.com/beekamai/boosty-api/releases). ·
Кто что сделал — в [заметках к релизам](https://github.com/beekamai/boosty-api/releases).

## Star history

<a href="https://star-history.com/#beekamai/boosty-api&Date">
  <img src="https://api.star-history.com/svg?repos=beekamai/boosty-api&type=Date" alt="Star History Chart" width="600" />
</a>
