/* resources/targets.ts — blog goals ("targets"): list, read, create, edit, remove. */
import { BaseResource, apiPath } from "../http";
import { Target, TargetsResponse, type TargetType } from "../types/target";

export interface TargetsListOptions {
    type?: TargetType;
    /** Include finished and removed targets. */
    showDeleted?: boolean;
}

export class TargetsResource extends BaseResource {
    /**
     * A blog's targets.
     * @verified GET /v1/target/{blog}/ (live 200 on the owner's blog; `type` and `show_deleted` filters accepted)
     */
    async list(blogName: string, options: TargetsListOptions = {}): Promise<TargetsResponse> {
        const json = await this.core.request("GET", apiPath`/v1/target/${blogName}/`, {
            params: { type: options.type, show_deleted: options.showDeleted },
        });
        return new TargetsResponse(json);
    }

    /**
     * One target.
     * @verified GET /v1/target/{targetId} (live 200; optional `currency` accepted)
     */
    async get(targetId: number | string, options: { currency?: string } = {}): Promise<Target> {
        const json = await this.core.request("GET", apiPath`/v1/target/${targetId}`, {
            params: { currency: options.currency },
        });
        return new Target(json ?? {});
    }

    /**
     * Create a money target.
     * @experimental POST /v1/target/money — from the web client
     */
    async createMoney(blogName: string, description: string, targetSum: number): Promise<Target> {
        const json = await this.core.request("POST", "/v1/target/money", {
            form: { blog_url: blogName, description, target_sum: targetSum },
        });
        return new Target(json ?? {});
    }

    /**
     * Create a subscribers target.
     * @experimental POST /v1/target/subscribers — from the web client
     */
    async createSubscribers(blogName: string, description: string, targetSum: number): Promise<Target> {
        const json = await this.core.request("POST", "/v1/target/subscribers", {
            form: { blog_url: blogName, description, target_sum: targetSum },
        });
        return new Target(json ?? {});
    }

    /**
     * Change a target's description and sum. Both are required: the web client always sends both, and a PUT
     * without one may reset it.
     * @experimental PUT /v1/target/{targetId} — from the web client
     */
    async edit(targetId: number | string, changes: { description: string; targetSum: number }): Promise<Target> {
        if (typeof changes?.description !== "string" || typeof changes?.targetSum !== "number") {
            throw new TypeError("targets.edit needs both description and targetSum");
        }
        const json = await this.core.request("PUT", apiPath`/v1/target/${targetId}`, {
            form: { target_id: targetId, description: changes.description, target_sum: changes.targetSum },
        });
        return new Target(json ?? {});
    }

    /**
     * Remove a target.
     * @experimental DELETE /v1/target/{targetId} — from the web client
     */
    async remove(targetId: number | string): Promise<true> {
        await this.core.request("DELETE", apiPath`/v1/target/${targetId}`);
        return true;
    }
}
