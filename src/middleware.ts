import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Map routes to required permission keys
const ROUTE_PERMISSIONS: Record<string, string> = {
  "/dashboard":    "dashboard",
  "/projects":     "projects",
  "/deliverables": "deliverables",
  "/calendar":     "calendar",
  "/settings":     "settings",
  "/admin":        "admin",
};

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token as {
      role?: string;
      permissions?: string[];
      email?: string;
    } | null;

    if (!token) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    // Find which permission key applies to this route
    const requiredPermission = Object.entries(ROUTE_PERMISSIONS).find(([route]) =>
      pathname === route || pathname.startsWith(route + "/")
    )?.[1];

    if (requiredPermission) {
      const perms = token.permissions ?? [];
      if (!perms.includes(requiredPermission)) {
        return NextResponse.redirect(new URL("/auth/unauthorized", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/deliverables/:path*",
    "/calendar/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
