import { query } from "./_generated/server";
import { auth } from "./auth.config";

export const { signIn, signOut, store } = auth;

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
