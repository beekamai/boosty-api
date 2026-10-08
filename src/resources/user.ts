/* resources/user.ts — the current user: profile, account settings, sessions, notification switches. */
import { BaseResource, apiPath } from "../http";
import {
    ActiveSessionsResponse,
    BlogCurrenciesResponse,
    DialogSettingsUpdate,
    NotificationSettingsResponse,
    NotificationSwitch,
    NotificationTransport,
    PaymentBindsResponse,
    ProfileUpdate,
    SubscriptionsResponse,
} from "../types/account";
import { CurrentUser } from "../types/users";

export class UserResource extends BaseResource {
    /**
     * Data of the current authorized user.
     * @verified GET /v1/user/current (responds 401 anonymously — the path exists).
     */
    async current(): Promise<CurrentUser> {
        const json = await this.core.request("GET", `/v1/user/current`);
        return new CurrentUser(json);
    }

    /**
     * A page of the blogs the current user is subscribed to.
     * @verified GET /v1/user/subscriptions (live 200: `{ data, total, offset, limit }`; the owner's account had no subscriptions, so items are untyped).
     */
    async subscriptions(
        options: { limit?: number; offset?: number; withFollow?: boolean } = {}
    ): Promise<SubscriptionsResponse> {
        const json = await this.core.request("GET", `/v1/user/subscriptions`, {
            params: { limit: options.limit, offset: options.offset, with_follow: options.withFollow ?? false },
        });
        return new SubscriptionsResponse(json);
    }

    /**
     * Devices the account is logged in on; `flags.isCurrent` marks the one making this request.
     * @verified GET /v1/user/session/ (live 200 on the owner's account).
     */
    async sessions(): Promise<ActiveSessionsResponse> {
        const json = await this.core.request("GET", `/v1/user/session/`);
        return new ActiveSessionsResponse(json);
    }

    /**
     * Notification switches per transport. Without `transports` the API returns an empty `settings`,
     * so all four are requested by default.
     * @verified GET /v1/notification/settings/?transports=mail,telegram (live 200; a single transport and a comma list both work).
     */
    async notificationSettings(
        transports: NotificationTransport[] = ["standalone", "mobile_push", "telegram", "mail"]
    ): Promise<NotificationSettingsResponse> {
        const json = await this.core.request("GET", `/v1/notification/settings/`, {
            params: { transports: transports.join(",") },
        });
        return new NotificationSettingsResponse(json);
    }

    /**
     * Saved payment cards of the current user (only the id is typed).
     * @verified GET /v1/payment/bind/list (live 200; the owner had no saved cards).
     */
    async paymentCards(options: { currency?: string; withDeleted?: boolean } = {}): Promise<PaymentBindsResponse> {
        const json = await this.core.request("GET", `/v1/payment/bind/list`, {
            params: { payment_partner: "advpay", deleted: options.withDeleted ?? false, currency: options.currency },
        });
        return new PaymentBindsResponse(json);
    }

    /**
     * Currencies the user may choose for their blog.
     * @verified GET /v1/user/current/blog_currency/available/ (live 200).
     */
    async availableBlogCurrencies(): Promise<BlogCurrenciesResponse> {
        const json = await this.core.request("GET", `/v1/user/current/blog_currency/available/`);
        return new BlogCurrenciesResponse(json);
    }

    /**
     * Update the profile; only the given fields are sent (the web client also sends single fields). Returns the updated user.
     * @experimental PUT /v1/user/current — from the web client (form body, snake_case keys).
     * @throws TypeError if no field is given.
     */
    async updateProfile(fields: ProfileUpdate): Promise<CurrentUser> {
        if (Object.values(fields).every((v) => v == null)) throw new TypeError("updateProfile needs at least one field");
        const json = await this.core.request("PUT", `/v1/user/current`, {
            form: {
                name: fields.name,
                email: fields.email,
                can_view_adult_content: fields.canViewAdultContent,
                send_msg_rule: fields.sendMsgRule,
                send_msg_level_id: fields.sendMsgLevelId,
            },
        });
        return new CurrentUser(json ?? {});
    }

    /**
     * Turn one notification switch on or off for one transport.
     * @experimental PUT /v1/notification/settings/{transport}/{switch} — from the web client, form `value=true|false`.
     */
    async updateNotificationSetting(
        transport: NotificationTransport,
        notificationSwitch: NotificationSwitch,
        value: boolean
    ): Promise<unknown> {
        return this.core.request("PUT", apiPath`/v1/notification/settings/${transport}/${notificationSwitch}`, {
            form: { value },
        });
    }

    /**
     * Change who may start a conversation with the user. The web client always posts the full set, so the
     * fields you omit are filled from the current settings (one extra GET /v1/user/current).
     * @experimental POST /v1/user/dialog_settings — from the web client (form body, snake_case keys).
     * @throws TypeError if a switch is neither given nor known from the current settings: pass every switch then.
     */
    async updateDialogSettings(settings: DialogSettingsUpdate): Promise<unknown> {
        const current = (await this.current()).dialogSettings ?? {};
        const given = Object.fromEntries(Object.entries(settings).filter(([, v]) => v != null));
        /* Responses spell the payers switch "candSendPayers". */
        const s: DialogSettingsUpdate = { ...current, canSendPayers: current.canSendPayers ?? current.candSendPayers, ...given };
        const switches = [s.canSendAll, s.canSendDonation, s.canSendMyAuthors, s.canSendPaidSubscribers, s.canSendSubscribers, s.canSendPayers];
        if (switches.some((v) => typeof v !== "boolean")) {
            throw new TypeError("updateDialogSettings could not read every current switch: pass all of them");
        }
        return this.core.request("POST", `/v1/user/dialog_settings`, {
            form: {
                send_msg_level_id: s.sendMsgLevelId,
                can_send_all: s.canSendAll,
                can_send_donation: s.canSendDonation,
                can_send_my_authors: s.canSendMyAuthors,
                can_send_paid_subscribers: s.canSendPaidSubscribers,
                can_send_subscribers: s.canSendSubscribers,
                can_send_payers: s.canSendPayers,
            },
        });
    }

    /**
     * Set the interface language, for example "ru" or "en_US" (the web client sends only the part before "_").
     * @experimental POST /v1/user/locale — from the web client, form `lang=<code>`.
     */
    async setLocale(locale: string): Promise<unknown> {
        return this.core.request("POST", `/v1/user/locale`, { form: { lang: locale.split("_")[0] } });
    }

    /**
     * Log devices out. The request carries no session id, so it cannot target one device, and whether the
     * calling session survives is unverified: assume it ends every session, this one included, and a bot
     * calling it then has to log in again. Pass `{ includingCurrent: true }` to confirm that.
     * @experimental DELETE /v1/user/session/ — from the web client.
     * @throws TypeError without the confirmation.
     */
    async endSessions(confirm: { includingCurrent: true }): Promise<unknown> {
        if (confirm?.includingCurrent !== true) {
            throw new TypeError("endSessions may end this session too: pass { includingCurrent: true }");
        }
        return this.core.request("DELETE", `/v1/user/session/`);
    }
}
