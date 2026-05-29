/* resources/messaging.ts — dialogs, messages, notifications. */
/* The whole module is @experimental: paths reconstructed from the web client, need verification on traffic. */
import { BaseResource } from "../http";
import { DialogsResponse, MessagesResponse } from "../types/messaging";
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
