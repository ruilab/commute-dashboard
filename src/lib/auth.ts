import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const allowedUsers = (process.env.ALLOWED_GITHUB_USERS || "")
  .split(",")
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [GitHub],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.login) return false;
      const username = (profile.login as string).toLowerCase();
      if (allowedUsers.length === 0) return true;
      return allowedUsers.includes(username);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
