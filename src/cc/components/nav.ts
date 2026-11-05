import { AppWindow, Briefcase, Calendar, CheckSquare, Film, FileText, Gauge, Home, Inbox, Plug, Settings, Sparkles, Sun, Wallet } from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem { href: string; label: string; icon: ComponentType<{ className?: string }>; legacy?: boolean; keywords?: string; countKey?: "today" | "overdue" | "shoots" }
/** Primary navigation. `title: ""` renders without a heading (the daily core). System links live in the sidebar footer. */
export const NAV: { title: string; items: NavItem[] }[] = [
  { title: "", items: [
    { href: "/home", label: "Home", icon: Home },
    { href: "/my-day", label: "My Day", icon: Sun, countKey: "today" },
    { href: "/tasks", label: "Tasks", icon: CheckSquare, countKey: "overdue" },
    { href: "/to-shoot", label: "To Shoot", icon: Film, countKey: "shoots" },
    { href: "/inbox", label: "Inbox", icon: Inbox, keywords: "gmail email" },
    { href: "/agenda", label: "Calendar", icon: Calendar, keywords: "agenda schedule" },
  ] },
  { title: "Studio", items: [
    { href: "/operations", label: "Operations", icon: Wallet, keywords: "payments approvals go-live revenue" },
    { href: "/studio/deliverables", label: "Deliverables", icon: Briefcase, keywords: "sheet brands payments go-live" },
    { href: "/studio/scripts", label: "Scripts", icon: FileText, keywords: "projects script review" },
    { href: "/studio-ai", label: "Studio AI", icon: Sparkles, keywords: "gemini briefing" },
  ] },
];
export const FOOTER: NavItem[] = [
  { href: "/health", label: "App health", icon: Gauge, keywords: "monitor status" },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/studio/settings", label: "Settings", icon: Settings },
];
export const APPS_LINK: NavItem = { href: "/apps", label: "All apps", icon: AppWindow, keywords: "library launcher favorites" };
export const ALL_NAV: NavItem[] = [...NAV.flatMap((s) => s.items), APPS_LINK, ...FOOTER];
export const TITLES: Record<string, string> = { ...Object.fromEntries(ALL_NAV.map((i) => [i.href, i.label])), "/apps": "Apps", "/studio": "Studio" };
