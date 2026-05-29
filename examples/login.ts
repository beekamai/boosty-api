/* login.ts — точка входа интерактивного входа через браузер (Puppeteer). */
/* Запуск: `bun run login`. force=true — перелогиниться, даже если auth.json уже есть */
/* (например, когда токены протухли). */
import { interactiveLogin } from "../src/utils/browser_login";
import { DEFAULT_USER_AGENT } from "../src/utils/consts";

await interactiveLogin("auth.json", DEFAULT_USER_AGENT, true);
