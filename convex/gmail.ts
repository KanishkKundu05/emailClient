import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
  };
  internalDate: string;
}

interface Email {
  id: string;
  name: string;
  email: string;
  subject: string;
  date: string;
  teaser: string;
}

export const getUserToken = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.googleAccessToken || null;
  },
});

export const fetchEmails = action({
  args: {},
  handler: async (ctx): Promise<Email[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const accessToken = await ctx.runQuery(internal.gmail.getUserToken, {
      userId: userId as Id<"users">,
    });

    if (!accessToken) {
      return [];
    }

    try {
      // Fetch list of message IDs from inbox
      const listResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!listResponse.ok) {
        console.error("Failed to fetch email list:", await listResponse.text());
        return [];
      }

      const listData = await listResponse.json();
      const messages: GmailMessage[] = listData.messages || [];

      if (messages.length === 0) {
        return [];
      }

      // Fetch details for each message
      const emails: Email[] = [];
      for (const msg of messages) {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!detailResponse.ok) {
          continue;
        }

        const detail: GmailMessageDetail = await detailResponse.json();

        const headers = detail.payload?.headers || [];
        const fromHeader = headers.find((h) => h.name === "From")?.value || "";
        const subject = headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
        const dateHeader = headers.find((h) => h.name === "Date")?.value || "";

        // Parse the From header to extract name and email
        const fromMatch = fromHeader.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
        const name = fromMatch?.[1] || fromMatch?.[2] || fromHeader;
        const email = fromMatch?.[2] || fromHeader;

        // Format the date
        const date = formatEmailDate(dateHeader);

        emails.push({
          id: msg.id,
          name: name.trim(),
          email: email.trim(),
          subject,
          date,
          teaser: detail.snippet || "",
        });
      }

      return emails;
    } catch (error) {
      console.error("Error fetching emails:", error);
      return [];
    }
  },
});

function formatEmailDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 14) {
      return "1 week ago";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  } catch {
    return dateString;
  }
}
