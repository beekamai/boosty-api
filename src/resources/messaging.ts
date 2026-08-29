/* resources/messaging.ts — dialogs, messages, notifications. */
/* The whole module is @experimental: paths reconstructed from the web client, need verification on traffic. */
import { BaseResource } from "../http";
import { Dialog, DialogsResponse, DialogWithUser, MessagesResponse } from "../types/messaging";
import { NotificationsResponse } from "../types/notification";

export class MessagingResource extends BaseResource {
    /**
     * List of the current user's dialogs.
     * @verified GET /v1/dialog/ (responds 401 anonymously — the path exists).
     */
    async dialogs(options: { limit?: number; offset?: string } = {}): Promise<DialogsResponse> {
        const json = await this.core.request("GET", `/v1/dialog/`, {
            params: { limit: options.limit, offset: options.offset },
        });
        return new DialogsResponse(json);
    }

    /**
     * Probe a conversation with a user: does it already exist, and are we allowed to write first?
     * Check `relation.canWrite` before creating anything — closed DMs and blacklists are common.
     * @verified GET /v1/dialog?user_id=<id> — note: NO trailing slash, and it answers 201, not 200.
     */
    async dialogWithUser(userId: number | string): Promise<DialogWithUser> {
        const json = await this.core.request("GET", `/v1/dialog`, { params: { user_id: userId } });
        return new DialogWithUser(json);
    }

    /**
     * Create a conversation with a user, so that the blogger can write first.
     * Boosty does not open conversations on subscription — without this call there is no dialog id
     * to send a message to. Returns the created dialog.
     * @verified POST /v1/dialog/ (WITH trailing slash), form `user_id=<id>` → 201 with the dialog.
     */
    async createDialog(userId: number | string): Promise<Dialog> {
        const json = await this.core.request("POST", `/v1/dialog/`, { form: { user_id: userId } });
        return new Dialog(json);
    }

    /**
     * Messages of a specific dialog.
     * @verified GET /v1/dialog/{dialogId}/message/ (confirmed by a live 200 response).
     */
    async messages(
        dialogId: number | string,
        options: { limit?: number; offset?: string } = {}
    ): Promise<MessagesResponse> {
        const json = await this.core.request("GET", `/v1/dialog/${dialogId}/message/`, {
            params: { limit: options.limit, offset: options.offset },
        });
        return new MessagesResponse(json);
    }

    /**
     * Send a message to a dialog.
     * @verified POST /v1/dialog/{dialogId}/message (WITHOUT trailing slash — with the slash it's 405).
     *   form-urlencoded body: data = JSON of an array of blocks (text/link/...). Confirmed by a live 200.
     */
    async sendMessage(dialogId: number | string, data: unknown[]): Promise<unknown> {
        return this.core.request("POST", `/v1/dialog/${dialogId}/message`, {
            form: { data: JSON.stringify(data) },
        });
    }

    /**
     * User notifications.
     * @unverified Path not found among the usual ones (/v1/notification/, /v1/notifications/,
     *   /v1/notification/feed/ → 404). Web client traffic capture is required for the exact path.
     */
    async notifications(options: { limit?: number; offset?: string } = {}): Promise<NotificationsResponse> {
        const json = await this.core.request("GET", `/v1/notification/`, {
            params: { limit: options.limit, offset: options.offset },
        });
        return new NotificationsResponse(json);
    }
}
