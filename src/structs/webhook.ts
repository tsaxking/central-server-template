import { text } from "drizzle-orm/pg-core";
import { Struct } from "../struct";

export namespace Webhook {
    export const Webhook = new Struct({
        name: 'webhook',
        structure: {
            url: text('url').notNull().unique(),
            key: text('key').notNull().unique(),
        }
    });
}