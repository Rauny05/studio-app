import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { loadUsers } from "@/lib/users-store";

export type { AllowedUser } from "@/lib/users-store";

export const ADMIN_EMAIL = "raunaq@rmmedia.in";
export const ALL_PERMISSIONS = ["dashboard", "projects", "deliverables", "calendar", "settings", "todos"];

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "passcode",
      name: "Access Code",
      credentials: {
        email: { label: "Email", type: "email" },
        passcode: { label: "Access Code", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.passcode) return null;

        const email = credentials.email.toLowerCase().trim();
        const expectedCode = process.env.APP_ACCESS_CODE;

        // Must have a passcode set in env
        if (!expectedCode) return null;
        if (credentials.passcode !== expectedCode) return null;

        // Email must be admin or in allowed list
        if (email === ADMIN_EMAIL) {
          return { id: email, email, name: "Raunaq", image: null };
        }

        const users = await loadUsers();
        const found = users.find((u) => u.email === email);
        if (!found) return null;

        return { id: email, email, name: found.name ?? email, image: null };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      // Credentials provider already authorized in authorize()
      if (account?.provider === "passcode") return true;
      if (user.email === ADMIN_EMAIL) return true;
      const users = await loadUsers();
      return users.some((u) => u.email === user.email);
    },
    async jwt({ token, user }) {
      const email = token.email ?? user?.email;
      if (!email) return token;

      if (email === ADMIN_EMAIL) {
        token.role = "admin";
        token.permissions = [...ALL_PERMISSIONS, "admin"];
      } else {
        const users = await loadUsers();
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
