/* resources/user.ts — current user. */
import { BaseResource } from "../http";
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
}
