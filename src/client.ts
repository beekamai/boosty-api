/* client.ts — transport core + assembly of resource namespaces. */
import { logger } from "./utils/logging";
import { API_URL } from "./utils/consts";
import { Auth } from "./auth/auth";
import {
    BoostyError,
    defaultHttpClient,
    type ApiCore,
    type HTTPClient,
    type RequestOptions,
} from "./http";

/* Resource modules */
import { PostsResource } from "./resources/posts";
import { CommentsResource } from "./resources/comments";
import { BlogResource } from "./resources/blog";
import { UserResource } from "./resources/user";
import { MediaResource } from "./resources/media";
import { SocialResource } from "./resources/social";
import { FeedResource } from "./resources/feed";
import { MessagingResource } from "./resources/messaging";
import { IncomeResource } from "./resources/income";

/* Types for legacy aliases */
import type { Post } from "./types/post";
import type { CommentsResponse } from "./types/comment";

/** Removes keys with null/undefined values from a plain object (for query/body). */
function stripNullish(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

export class API implements ApiCore {
    private httpClient: HTTPClient;
    public auth: Auth;

    /* Resource namespaces (full coverage of the internal API) */
    public readonly posts: PostsResource;
    public readonly comments: CommentsResource;
    public readonly blog: BlogResource;
    public readonly user: UserResource;
    public readonly media: MediaResource;
    public readonly social: SocialResource;
    public readonly feed: FeedResource;
    public readonly messaging: MessagingResource;
    public readonly income: IncomeResource;

    constructor(httpClient: HTTPClient = defaultHttpClient, auth?: Auth) {
        this.httpClient = httpClient;
        this.auth = auth ?? new Auth();

        this.posts = new PostsResource(this);
        this.comments = new CommentsResource(this);
        this.blog = new BlogResource(this);
        this.user = new UserResource(this);
        this.media = new MediaResource(this);
        this.social = new SocialResource(this);
        this.feed = new FeedResource(this);
        this.messaging = new MessagingResource(this);
        this.income = new IncomeResource(this);
    }

    /**
     * Single entry point for sending requests.
     * - params/json/form: null/undefined keys are dropped (important for Boosty routing);
     * - anon: do not send Authorization even if a token is present (public access);
     * - 401 → one refresh + retry (protected from infinite recursion via _retried);
     * - empty/non-JSON response → null (fixes crash on DELETE/204).
     */
    async request<T = any>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
        const { params, json, form, anon = false, _retried = false } = options;

        /* Proactive refresh before the request if the token has expired (authorized only). */
        if (!anon && !_retried) {
            try {
                await this.auth.ensureFresh(this.httpClient, API_URL);
            } catch (e) {
                logger.warn(`Proactive refresh failed, continuing with the current token: ${String(e)}`);
            }
        }

        const url = new URL(`${API_URL}${path}`);
        if (params) {
            Object.entries(params)
                .filter(([, v]) => v !== null && v !== undefined)
                .forEach(([k, v]) => url.searchParams.append(k, String(v)));
        }

        const headers: Record<string, string> = { ...this.auth.headers };
        if (anon) delete headers["Authorization"];

        const init: RequestInit = { method, headers };

        if (json !== undefined) {
            const payload = Array.isArray(json) ? json : stripNullish(json as Record<string, unknown>);
            init.body = JSON.stringify(payload);
            headers["Content-Type"] = "application/json";
        } else if (form !== undefined) {
            const usp = new URLSearchParams();
            Object.entries(form)
                .filter(([, v]) => v !== null && v !== undefined)
                .forEach(([k, v]) => usp.append(k, String(v)));
            init.body = usp.toString();
            headers["Content-Type"] = "application/x-www-form-urlencoded";
        }

        logger.info(`${method} ${url.toString()}`);
        const response = await this.httpClient.request(url.toString(), init);

        if (response.status === 401 && !anon && !_retried) {
            logger.warn("Token expired (401), refreshing via refresh_token and retrying...");
            await this.auth.refreshAuthData(this.httpClient, API_URL);
            return this.request<T>(method, path, { ...options, _retried: true });
        }

        const body = await this.parseResponse(response);

        if (!response.ok) {
            throw new BoostyError(response.status, body);
        }

        return body as T;
    }

    /** Safe response parsing: 204/empty body → null, non-JSON → text. */
    private async parseResponse(response: Response): Promise<unknown> {
        if (response.status === 204) return null;
        const text = await response.text();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch {
            logger.warn(`Response is not JSON (status ${response.status}): ${text.slice(0, 200)}`);
            return text;
        }
    }

    /* ────────────────────────────────────────────────────────────────────────── */
    /* Legacy aliases — backward compatibility with old code (examples/demo.ts etc.) */
    /* ────────────────────────────────────────────────────────────────────────── */

    /** @deprecated use api.posts.get(...) */
    async getPost(blogName: string, postId: string, commentsLimit?: number, replyLimit?: number): Promise<Post> {
        return this.posts.get(blogName, postId, { commentsLimit, replyLimit });
    }

    /** @deprecated use api.comments.list(...) */
    async getPostComments(
        blogName: string,
        postId: string,
        options: { offset?: string; limit?: number; replyLimit?: number; order?: string } = {}
    ): Promise<CommentsResponse> {
        return this.comments.list(blogName, postId, options);
    }
}

export { BoostyError };
