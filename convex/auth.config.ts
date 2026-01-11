import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        // Update existing user with new tokens
        if (args.profile && args.type === "oauth") {
          const account = args as { account?: { access_token?: string; refresh_token?: string; expires_at?: number } };
          if (account.account) {
            await ctx.db.patch(args.existingUserId, {
              googleAccessToken: account.account.access_token,
              googleRefreshToken: account.account.refresh_token,
              googleTokenExpiry: account.account.expires_at ? account.account.expires_at * 1000 : undefined,
            });
          }
        }
        return args.existingUserId;
      }
      // Create new user
      const profile = args.profile as { name?: string; email?: string; picture?: string };
      const account = args as { account?: { access_token?: string; refresh_token?: string; expires_at?: number } };
      return await ctx.db.insert("users", {
        name: profile?.name,
        email: profile?.email,
        image: profile?.picture,
        googleAccessToken: account.account?.access_token,
        googleRefreshToken: account.account?.refresh_token,
        googleTokenExpiry: account.account?.expires_at ? account.account.expires_at * 1000 : undefined,
      });
    },
  },
});
