/* resources/messaging.ts — dialogs, messages, notifications. */
/* The whole module is @experimental: paths reconstructed from the web client, need verification on traffic. */
import { BaseResource, apiPath } from "../http";
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
        const json = await this.core.request("GET", apiPath`/v1/dialog/${dialogId}/message/`, {
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
        return this.core.request("POST", apiPath`/v1/dialog/${dialogId}/message`, {
            form: { data: JSON.stringify(data) },
        });
    }

    /**
     * The current user's notification feed (the bell in the web client). Takes no paging parameters.
     * @verified GET /v1/notification/standalone/event/ (confirmed by a live 200 response).
     */
    async notifications(): Promise<NotificationsResponse> {
        const json = await this.core.request("GET", `/v1/notification/standalone/event/`);
        return new NotificationsResponse(json);
    }

    /**
     * Mark notifications as read. Returns the feed with updated counters. An empty list sends nothing:
     * the server answers 200 to an empty `event_id` too, and what it does then is unknown.
     * @experimental PUT /v1/notification/standalone/read/, form `event_id=1,2` (web client format).
     *   Live: a real id answers 200 with the feed, a non-numeric one 400 invalid_param; the flip of
     *   `isRead` itself was not observed (no unread events at the time).
     */
    async markNotificationsRead(eventIds: number[]): Promise<NotificationsResponse> {
        if (eventIds.length === 0) return this.notifications();
        const json = await this.core.request("PUT", `/v1/notification/standalone/read/`, {
            form: { event_id: eventIds.join(",") },
        });
        return new NotificationsResponse(json);
    }

    /**
     * Delete one notification.
     * @experimental DELETE /v1/notification/standalone/event/{eventId} — taken from the web client.
     */
    async deleteNotification(eventId: number): Promise<true> {
        await this.core.request("DELETE", apiPath`/v1/notification/standalone/event/${eventId}`);
        return true;
    }

    /**
     * Delete several notifications at once. An empty list sends nothing: what the server does with an empty
     * `event_id` is unknown, and the web client never sends one.
     * @experimental DELETE /v1/notification/standalone/event/, form `event_id=1,2` — taken from the web client.
     */
    async deleteNotifications(eventIds: number[]): Promise<NotificationsResponse> {
        if (eventIds.length === 0) return this.notifications();
        const json = await this.core.request("DELETE", `/v1/notification/standalone/event/`, {
            form: { event_id: eventIds.join(",") },
        });
        return new NotificationsResponse(json);
    }
}
