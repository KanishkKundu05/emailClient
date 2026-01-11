import { query } from "./_generated/server";
import { auth, signIn, signOut, store } from "./auth.config";

export { signIn, signOut, store };

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
