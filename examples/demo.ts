import { API } from "../src/client";
import { BoostyError } from "../src/http";
import { logger } from "../src/utils/logging";
import { interactiveLogin } from "../src/utils/browser_login";

/**
 * Демонстрация клиента.
 * - Без токена работает анонимно (публичные посты доступны).
 * - С токеном (auth.json) дополнительно показывает данные аккаунта и подписчиков.
 *
 * Пример блога/поста — замените на свои.
 */
const DEMO_BLOG = "boosty";
const DEMO_POST_ID = "c9fb8a19-c45e-4602-9942-087c3af28c1b";

async function main() {
    const api = new API();

    if (!api.auth.isAuthenticated) {
        logger.info("Токена нет — работаем в анонимном режиме (доступны только публичные посты).");
        /* Чтобы запустить интерактивный вход, раскомментируйте: */
        /* await interactiveLogin(); */
    }

    await demoAnonymous(api);

    if (api.auth.isAuthenticated) {
        await demoAuthorized(api);
    }
}

/** Публично доступные данные — работает и анонимно. */
async function demoAnonymous(api: API) {
    try {
        const post = await api.posts.get(DEMO_BLOG, DEMO_POST_ID, { commentsLimit: 5 });
        logger.info(`Пост: "${post.title ?? "(без названия)"}"`);
        logger.info(`URL: ${post.url}`);
        logger.info(`Доступ к контенту: ${post.hasAccess}`);

        const [text] = post.text;
        if (text) logger.info(`Текст (фрагмент): ${text.slice(0, 200)}`);

        if (post.hasAccess === false) {
            logger.info(
                `Нет доступа. Требуется уровень: ${post.subscriptionLevel?.name ?? "?"} ` +
                    `(${post.subscriptionLevel?.price ?? "?"} RUB)`
            );
        }

        const comments = await api.comments.list(DEMO_BLOG, DEMO_POST_ID, { limit: 5, order: "top" });
        logger.info(`Загружено комментариев: ${comments.data.length}`);
    } catch (error) {
        reportError("анонимный демо-блок", error);
    }
}

/** Данные, требующие авторизации. */
async function demoAuthorized(api: API) {
    try {
        const me = await api.user.current();
        logger.info(`Вы вошли как: ${me.name} (id ${me.id})`);

        const posts = await api.posts.list(DEMO_BLOG, { limit: 3 });
        logger.info(`Получено постов из ленты блога: ${posts.data?.length ?? 0}`);
    } catch (error) {
        reportError("авторизованный демо-блок", error);
    }
}

function reportError(scope: string, error: unknown) {
    if (error instanceof BoostyError) {
        logger.error(`[${scope}] Boosty API ${error.statusCode}: ${error.message}`);
    } else {
        logger.error(`[${scope}] ${String(error)}`);
    }
}

main();
