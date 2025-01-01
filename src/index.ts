import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { z } from "zod";
// import { db } from "./db";
import { Account } from "./structs/account";
import { publicProcedure, router } from "./utils/trpc";

const appRouter = router({
    userList: publicProcedure
        .query(async () => {
            const users = (await Account.Account.all(false)).unwrap();
            return users.map(a => a.safe());
        }),
    userById: publicProcedure
        .input(z.string())
        .query(async (opts) => {
            const { input } = opts;
            return (await Account.Account.fromId(input)).unwrap()?.safe();
        }),
//   userCreate: publicProcedure
//     .input(z.object({ name: z.string() }))
//     .mutation(async (opts) => {
//       const { input } = opts;
//       const user = await db.user.create(input);
//       return user;
//     }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
    router: appRouter,
});

server.listen(3000);