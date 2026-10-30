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
  "/todos":        "todos",
};

// Command Center pages (below in matcher): any signed-in user; /api/cc routes enforce their own session check

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

    // Admin always has full access — skip permission check
    if (token.role === "admin") return NextResponse.next();

    if (requiredPermission) {
      const perms = token.permissions ?? [];
      // Allow both full access (key) and view-only access (key:view)
      const hasAccess =
        perms.includes(requiredPermission) ||
        perms.includes(`${requiredPermission}:view`);
      if (!hasAccess) {
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
    "/workspace/:path*",
    "/studio/:path*",
    "/dashboard/:path*",
    "/projects/:path*",
    "/scripts/:path*",
    "/deliverables/:path*",
    "/calendar/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/todos/:path*",
    "/home/:path*",
    "/my-day/:path*",
    "/tasks/:path*",
    "/to-shoot/:path*",
    "/inbox/:path*",
    "/agenda/:path*",
    "/operations/:path*",
    "/apps/:path*",
    "/studio-ai/:path*",
    "/health/:path*",
    "/integrations/:path*",
  ],
};
