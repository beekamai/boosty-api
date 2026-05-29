# boosty-api

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.1-000000?logo=bun&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-3da639)

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
- 🔐 **Auth with auto-refresh** — bearer token, proactive (by `expires_at`) and reactive (401) refresh with a single-retry guard.
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

> Interactive browser login (`api`'s `interactiveLogin`) needs the optional `puppeteer` dependency:
> `npm i puppeteer`. Everything else works without it.

### Authentication

Public endpoints work anonymously. For private content and account operations you need a token in
`auth.json` (kept out of git via `.gitignore`):

```bash
cp auth.json.example auth.json   # fill in manually, or:
bun run login                    # interactive browser login (Puppeteer)
```

Manual way: log in at boosty.to → DevTools → Application → Cookies. Cookie `auth` is URL-encoded JSON,
cookie `_clientId` is the device id. `auth.json` uses **snake_case**, the cookie uses camelCase — map them:

| `auth` cookie | `auth.json` field |
|---|---|
| `accessToken` | `access_token` |
| `refreshToken` | `refresh_token` |
| `expiresAt` | `expires_at` |
| `_clientId` (cookie) | `device_id` |

A **non-empty `device_id` is required** for token refresh.

### API status legend

**✅ verified** — confirmed by a live response (200, or 401 "auth required" = path exists).
**🟡 experimental** — path reconstructed from the web client, not confirmed end-to-end.
**❔ unverified** — exact path not found yet.

| Namespace | Methods (selected) | Status |
|---|---|---|
| `posts` | `list` `get` `create` `update` `delete` `getDeferredAccess` `updateDeferredAccess` | ✅ reads / 🟡 writes |
| `comments` | `list` `replies` `create` `like` `unlike` | ✅ list / 🟡 rest |
| `blog` | `profile` `subscribers` `subscriptionLevels` `blacklist` | ✅ |
| `user` | `current` | ✅ |
| `media` | `list` (media_album, `type`+`limit_by=media`) | ✅ |
| `social` | `likePost` `unlikePost` `voteOption` `removeVote` | 🟡 |
| `feed` | `posts` `searchBlogs` | ✅ |
| `messaging` | `dialogs` `messages` `sendMessage` `notifications` | ✅ / ❔ notifications |
| `income` | `sales` (POST form; may be "Category disabled" per account) | ⚠️ |

Legacy aliases `api.getPost`, `api.getPostComments`, `api.request` are kept for compatibility.

### Recipes

**Pagination** — list endpoints return `extra.offset`; loop until it is empty:

```ts
let offset: string | undefined;
do {
  const page = await api.posts.list("boosty", { limit: 20, offset });
  for (const post of page.data ?? []) console.log(post.title);
  offset = page.extra?.offset;
} while (offset);
```

**Send a message** — build content blocks with `buildMessage`:

```ts
import { API, buildMessage } from "boosty-api";

const blocks = buildMessage(["Hi! Here is your link:", { link: "https://example.com/sub" }]);
await api.messaging.sendMessage(dialogId, blocks);
```

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
  auth/           Auth, AuthData, FileAuthDataResolver
  resources/      posts, comments, blog, user, media, social, feed, messaging, income
  types/          models (extend BaseObject; fields use `declare`)
  utils/          logging, post (renderText), video (getVideoSizes), browser_login (Puppeteer), consts
examples/         demo.ts, login.ts
```
</details>

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
- 🔐 **Авторизация с авто-refresh** — bearer-токен, проактивный (по `expires_at`) и реактивный (401) refresh с защитой от рекурсии.
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

> Интерактивный вход через браузер (`interactiveLogin`) требует опциональной зависимости
> `puppeteer`: `npm i puppeteer`. Всё остальное работает без неё.

```bash
bun run dev          # запуск examples/demo.ts
bun run typecheck    # tsc --noEmit
```

### Авторизация

Публичные эндпоинты работают анонимно. Для приватного контента и аккаунт-операций нужен токен в
`auth.json` (исключён из git через `.gitignore`):

```bash
cp auth.json.example auth.json   # заполнить вручную, либо:
bun run login                    # интерактивный вход через браузер (Puppeteer)
```

Вручную: войти на boosty.to → DevTools → Application → Cookies. Cookie `auth` — это URL-encoded JSON,
cookie `_clientId` — это device id. `auth.json` использует **snake_case**, cookie — camelCase, сопоставь:

| cookie `auth` | поле `auth.json` |
|---|---|
| `accessToken` | `access_token` |
| `refreshToken` | `refresh_token` |
| `expiresAt` | `expires_at` |
| `_clientId` (cookie) | `device_id` |

Для refresh **обязателен непустой `device_id`**.

### Легенда статусов API

**✅ verified** — подтверждён живым ответом (200, либо 401 «нужен токен» = путь существует).
**🟡 experimental** — путь восстановлен из веб-клиента, не проверен сквозным ответом.
**❔ unverified** — точный путь пока не найден.

| Неймспейс | Методы (выборочно) | Статус |
|---|---|---|
| `posts` | `list` `get` `create` `update` `delete` `getDeferredAccess` `updateDeferredAccess` | ✅ чтение / 🟡 запись |
| `comments` | `list` `replies` `create` `like` `unlike` | ✅ list / 🟡 остальное |
| `blog` | `profile` `subscribers` `subscriptionLevels` `blacklist` | ✅ |
| `user` | `current` | ✅ |
| `media` | `list` (media_album, `type`+`limit_by=media`) | ✅ |
| `social` | `likePost` `unlikePost` `voteOption` `removeVote` | 🟡 |
| `feed` | `posts` `searchBlogs` | ✅ |
| `messaging` | `dialogs` `messages` `sendMessage` `notifications` | ✅ / ❔ notifications |
| `income` | `sales` (POST form; может быть «Category disabled» у аккаунта) | ⚠️ |

Легаси-алиасы `api.getPost`, `api.getPostComments`, `api.request` сохранены для совместимости.

### Рецепты

**Пагинация** — list-методы возвращают `extra.offset`; крутим, пока он не пуст:

```ts
let offset: string | undefined;
do {
  const page = await api.posts.list("boosty", { limit: 20, offset });
  for (const post of page.data ?? []) console.log(post.title);
  offset = page.extra?.offset;
} while (offset);
```

**Отправка сообщения** — собираем блоки контента через `buildMessage`:

```ts
import { API, buildMessage } from "boosty-api";

const blocks = buildMessage(["Привет! Вот твоя ссылка:", { link: "https://example.com/sub" }]);
await api.messaging.sendMessage(dialogId, blocks);
```

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
  auth/           Auth, AuthData, FileAuthDataResolver
  resources/      posts, comments, blog, user, media, social, feed, messaging, income
  types/          модели (наследуют BaseObject; поля через `declare`)
  utils/          logging, post (renderText), video (getVideoSizes), browser_login (Puppeteer), consts
examples/         demo.ts, login.ts
```
</details>

### Лицензия

MIT.
