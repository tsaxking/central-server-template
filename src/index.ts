import { Account } from './structs/account';
import { router, publicProcedure } from './utils/trpc';
import { z } from 'zod';
import { createHTTPServer } from '@trpc/server/adapters/standalone';


const appRouter = router({
    userList: publicProcedure
        .input(z.string())
        .query(async (opts) => {
            const { input } = opts;
            // return (await Account.Account.all(false)).unwrap().map(a => a.safe());
            return (await Account.Account.fromId(input)).unwrap()?.safe();
        }),
});
// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;


const server = createHTTPServer({
    router: appRouter,
});

server.listen(3000);