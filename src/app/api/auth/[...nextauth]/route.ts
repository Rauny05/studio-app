import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface AllowedUser {
  email: string;
  name?: string;
  role: "admin" | "member";
  permissions: string[]; // "dashboard" | "projects" | "deliverables" | "calendar" | "settings"
  addedAt: string;
}

export const ADMIN_EMAIL = "raunaq@rmmedia.in";
export const ALL_PERMISSIONS = ["dashboard", "projects", "deliverables", "calendar", "settings"];

function loadUsers(): AllowedUser[] {
  const path = join(process.cwd(), "data", "allowed-users.json");
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as AllowedUser[];
  } catch {
    return [];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (user.email === ADMIN_EMAIL) return true;
      const users = loadUsers();
      return users.some((u) => u.email === user.email);
    },
    async jwt({ token, user }) {
      // Runs on sign-in and on every request
      const email = token.email ?? user?.email;
      if (!email) return token;

      if (email === ADMIN_EMAIL) {
        token.role = "admin";
        token.permissions = [...ALL_PERMISSIONS, "admin"];
      } else {
        const users = loadUsers();
        const found = users.find((u) => u.email === email);
        token.role = found?.role ?? "member";
        token.permissions = found?.permissions ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "admin" | "member";
        session.user.permissions = token.permissions as string[];
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: { strategy: "jwt" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
