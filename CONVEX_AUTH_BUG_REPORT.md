# Bug Report: Convex Deploy Requires Optional AUTH_SECRET_N Environment Variables

## Summary

When deploying a Convex project with `@convex-dev/auth` and `@auth/core`, the `npx convex deploy` command incorrectly requires `AUTH_SECRET_1`, `AUTH_SECRET_2`, `AUTH_SECRET_3`, and other optional environment variables to be set, even though they are designed to be optional in `@auth/core`.

## Environment

- `@convex-dev/auth`: 0.0.90
- `@auth/core`: 0.37.0
- `convex`: 1.31.3
- Node.js: (latest LTS)
- Platform: macOS

## Steps to Reproduce

1. Create a new Convex project with standard auth setup
2. Configure Google OAuth provider (standard setup per docs)
3. Set the required environment variables:
   ```bash
   npx convex env set AUTH_SECRET "$(openssl rand -base64 32)" --prod
   npx convex env set AUTH_GOOGLE_ID "your-client-id" --prod
   npx convex env set AUTH_GOOGLE_SECRET "your-secret" --prod
   npx convex env set SITE_URL "https://your-app.vercel.app" --prod
   ```
4. Run `npx convex deploy`

## Expected Behavior

Deployment should succeed with only `AUTH_SECRET` set (plus provider credentials and `SITE_URL`).

## Actual Behavior

Deployment fails with cascading errors requiring additional environment variables:

```
✖ Environment variable AUTH_SECRET_1 is used in auth config file but its value was not set.
```

After setting `AUTH_SECRET_1`:
```
✖ Environment variable AUTH_SECRET_2 is used in auth config file but its value was not set.
```

After setting `AUTH_SECRET_2`:
```
✖ Environment variable AUTH_SECRET_3 is used in auth config file but its value was not set.
```

This pattern continues, also requesting:
- `AUTH_REDIRECT_PROXY_URL`
- `AUTH_URL`
- `AUTH_GOOGLE_ISSUER`

## Root Cause Analysis

The issue is in how Convex's deployment validation detects "used" environment variables.

In `@auth/core/lib/utils/env.js` (lines 28-37), the library **optionally** checks for numbered secrets to support key rotation:

```javascript
if (!config.secret?.length) {
    config.secret = [];
    const secret = envObject.AUTH_SECRET;
    if (secret)
        config.secret.push(secret);
    for (const i of [1, 2, 3]) {
        const secret = envObject[`AUTH_SECRET_${i}`];
        if (secret)
            config.secret.unshift(secret);
    }
}
```

**Key observation**: This code only adds secrets to the array **if they exist**. The variables are optional - the `if (secret)` check ensures missing variables are simply skipped.

Similarly, on line 39:
```javascript
config.redirectProxyUrl ?? (config.redirectProxyUrl = envObject.AUTH_REDIRECT_PROXY_URL);
```

This is also optional - it only sets `redirectProxyUrl` if the env var exists.

**The bug**: Convex's static analysis during deployment appears to detect these variable accesses and marks them as "required", ignoring the conditional logic that makes them optional.

## User's Auth Configuration (Standard Implementation)

**convex/auth.config.ts**:
```typescript
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
      // Standard user creation/update logic
    },
  },
});
```

**convex/http.ts**:
```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth.config";

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
```

**convex/auth.ts**:
```typescript
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
```

This is a completely standard implementation following the official Convex Auth documentation.

## Auth.js Documentation Confirms Optional Nature

From [Auth.js Deployment Docs](https://authjs.dev/getting-started/deployment):

> `AUTH_SECRET` – Mandatory; should be "at least a 32 character random string"

The documentation explicitly states only `AUTH_SECRET` is required. `AUTH_SECRET_1`, `AUTH_SECRET_2`, etc. are **never mentioned as requirements** - they exist solely for optional key rotation.

## Workaround

Set all secrets to the same value to satisfy Convex's validation:

```bash
SECRET=$(openssl rand -base64 32)
npx convex env set AUTH_SECRET "$SECRET" --prod
npx convex env set AUTH_SECRET_1 "$SECRET" --prod
npx convex env set AUTH_SECRET_2 "$SECRET" --prod
npx convex env set AUTH_SECRET_3 "$SECRET" --prod
npx convex deploy
```

## Suggested Fix

Convex's environment variable detection during deployment should:

1. Perform deeper static analysis to recognize conditional access patterns (`if (secret)`, nullish coalescing `??`)
2. Or maintain a whitelist of known optional variables from `@auth/core`
3. Or allow library authors to annotate optional vs required env vars

## Impact

- Poor developer experience with confusing cascading errors
- Unnecessary environment variable pollution
- Blocks standard Convex Auth deployments without workaround knowledge
- Creates confusion about what's actually required vs optional

## Note

There was also a separate configuration issue where `auth.config.ts` requires a default export with Convex's `AuthConfig` type. This is documented behavior, but the environment variable validation bug described above is a separate issue that still exists and requires the workaround of setting all optional secrets.
