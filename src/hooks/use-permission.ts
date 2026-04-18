"use client";

import { useSession } from "next-auth/react";

export type PermissionLevel = "none" | "view" | "edit";

/**
 * Returns the permission level the current user has for a given section.
 * - "edit"  → full access (permission key present, or user is admin)
 * - "view"  → read-only access (only `key:view` present)
 * - "none"  → no access
 */
export function usePermission(section: string): PermissionLevel {
  const { data: session } = useSession();
  const perms = session?.user?.permissions ?? [];

  // Admin role always gets edit access
  if (session?.user?.role === "admin") return "edit";

  if (perms.includes(section)) return "edit";
  if (perms.includes(`${section}:view`)) return "view";
  return "none";
}
