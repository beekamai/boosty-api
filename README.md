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
extension of [`barsikus007/boosty`](https://github.com/barsikus007/boosty), Bun-first, with broad
endpoint coverage (posts, comments, blog, user, media, social, feed, messaging, income).

> ⚠️ This is an **undocumented** internal API. It can change without notice. Use it only to access
> **your own** content and within Boosty's Terms of Service.

### Features

- 📦 **Resource namespaces** — `api.posts`, `api.comments`, `api.blog`, `api.user`, `api.media`, `api.social`, `api.feed`, `api.messaging`, `api.income`.
- 🔓 **Anonymous mode** — public posts/comments/profile work without a token.
- 🔐 **Easy auth** — `npx boosty-api login` (browser or a pasted Cookie header), `Auth.fromTokens` for servers; tokens refresh before expiry and after a 401.
- 🧩 **Tolerant models** — unknown response fields are preserved (resilient to Boosty schema drift).
- 🏷️ **Honest status tags** — every method is annotated `@verified` / `@experimental` / `@unverified`.

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
| `comments` | `list` `replies` (by the parent's `intId`) `create` `like` `unlike` | ✅ list, replies / 🟡 rest |
| `blog` | `profile` `subscribers` `subscriptionLevels` `blacklist` | ✅ |
| `user` | `current` | ✅ |
| `media` | `list` (media_album; `type`: `all` `image` `video` `audio`) | ✅ |
| `social` | `likePost` `unlikePost` `voteOption` `removeVote` | 🟡 |
| `feed` | `posts` `searchBlogs` | ✅ |
| `messaging` | `dialogs` `dialogWithUser` `createDialog` `messages` `sendMessage` `notifications` `markNotificationsRead` `deleteNotification(s)` | ✅ / 🟡 notification deletes |
| `income` | `sales` (POST form; may be "Category disabled" per account) | ⚠️ |

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

Other lists page differently: subscribers return `offset` / `total` at the top level, dialogs in `extra`.

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

**Render post text** — `post.text` (or `renderText(blocks)` for comments and blog descriptions) gives plain
text plus Telegram-style entities:

```ts
const [text, entities] = post.text;
// entities: { type: "text_link" | "bold" | "italic" | "underline", offset, length, url? }, offsets in UTF-16 units
```

Paragraphs are separated by newlines, headings and list items (`- ` / `1. `) are rendered as text, media
blocks become the placeholder (`"\n\n"` by default). Malformed blocks are skipped. The `url` of a `text_link`
is passed through as the author wrote it, `javascript:` included: check the scheme before putting it into HTML.

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

### License

MIT.

---

## Русский

Неофициальный TypeScript-клиент **внутреннего** API [Boosty](https://boosty.to) — порт и расширение
[`barsikus007/boosty`](https://github.com/barsikus007/boosty), на Bun, с широким покрытием эндпоинтов
(posts, comments, blog, user, media, social, feed, messaging, income).

> ⚠️ Это **недокументированный** внутренний API. Он может измениться без предупреждения. Используйте
> только для доступа к **своему** контенту и в рамках правил Boosty.

### Возможности

- 📦 **Resource-неймспейсы** — `api.posts`, `api.comments`, `api.blog`, `api.user`, `api.media`, `api.social`, `api.feed`, `api.messaging`, `api.income`.
- 🔓 **Анонимный режим** — публичные посты/комментарии/профиль работают без токена.
- 🔐 **Простой вход** — `npx boosty-api login` (браузер или вставленный заголовок Cookie), `Auth.fromTokens` для серверов; токены обновляются до истечения и после 401.
- 🧩 **Толерантные модели** — неизвестные поля ответа сохраняются (устойчивость к изменениям схемы Boosty).
- 🏷️ **Честные метки статуса** — у каждого метода JSDoc `@verified` / `@experimental` / `@unverified`.

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
| `comments` | `list` `replies` (по `intId` родителя) `create` `like` `unlike` | ✅ list, replies / 🟡 остальное |
| `blog` | `profile` `subscribers` `subscriptionLevels` `blacklist` | ✅ |
| `user` | `current` | ✅ |
| `media` | `list` (media_album; `type`: `all` `image` `video` `audio`) | ✅ |
| `social` | `likePost` `unlikePost` `voteOption` `removeVote` | 🟡 |
| `feed` | `posts` `searchBlogs` | ✅ |
| `messaging` | `dialogs` `dialogWithUser` `createDialog` `messages` `sendMessage` `notifications` `markNotificationsRead` `deleteNotification(s)` | ✅ / 🟡 удаление уведомлений |
| `income` | `sales` (POST form; может быть «Category disabled» у аккаунта) | ⚠️ |

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

Другие списки листаются иначе: у подписчиков `offset` / `total` лежат на верхнем уровне, у диалогов — в `extra`.

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

**Текст поста** — `post.text` (или `renderText(blocks)` для комментариев и описания блога) отдаёт обычный
текст и сущности в стиле Telegram:

```ts
const [text, entities] = post.text;
// entities: { type: "text_link" | "bold" | "italic" | "underline", offset, length, url? }, смещения в UTF-16
```

Абзацы разделены переводом строки, заголовки и пункты списков (`- ` / `1. `) выводятся текстом, медиа-блоки
заменяются плейсхолдером (по умолчанию `"\n\n"`). Битые блоки пропускаются. `url` у `text_link` отдаётся
как его написал автор, включая `javascript:`: проверяйте схему, прежде чем вставлять в HTML.

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

### Лицензия

MIT.

---

## Star history

<a href="https://star-history.com/#beekamai/boosty-api&Date">
  <img src="https://api.star-history.com/svg?repos=beekamai/boosty-api&type=Date" alt="Star History Chart" width="600" />
</a>
