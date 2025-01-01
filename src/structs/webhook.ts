import { text } from "drizzle-orm/pg-core";
import { Struct } from "drizzle-struct/back-end";
import { attemptAsync } from "ts-utils/check";

export namespace Webhook {
    export const Webhook = new Struct({
        name: 'webhook',
        structure: {
            url: text('url').notNull().unique().unique(),
            key: text('key').notNull().unique().unique(),
        }
    });

    export const Permissions = new Struct({
        name: 'webhook_permissions',
        structure: {
            webhookId: text('webhook_id').notNull(),
            struct: text('struct').notNull(),
            permission: text('permission').notNull()
        }
    });

    export const get = (key: string) => {
        return attemptAsync(async () => {
            const webhook = (await Webhook.fromProperty('key', key, false)).unwrap()[0];
            if (!webhook) return undefined;
            const permissions = (await Permissions.fromProperty('webhookId', webhook.id, false)).unwrap();
            return { webhook, permissions };
        });
    }
}