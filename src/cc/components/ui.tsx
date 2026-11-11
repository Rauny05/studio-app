"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Check, X } from "lucide-react";
import { create } from "zustand";
import type { ReactNode } from "react";
import type { Health } from "../lib/health";
import { diffDays } from "../lib/planner";

/* ---------- Toasts with undo ---------- */
interface ToastItem { id: number; text: string; undo?: () => void; tone?: "err" }
interface ToastState { items: ToastItem[]; push: (t: Omit<ToastItem, "id">) => void; drop: (id: number) => void }
let tid = 0;
export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = ++tid;
    set((s) => ({ items: [...s.items.slice(-2), { ...t, id }] }));
    setTimeout(() => get().drop(id), t.undo ? 6000 : 3500);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));
export const toast = (text: string, opts: { undo?: () => void; tone?: "err" } = {}) => useToasts.getState().push({ text, ...opts });

export function ToastHost() {
  const { items, drop } = useToasts();
  return (
    <div className="cc-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`cc-toast ${t.tone ?? ""}`}>
          <span>{t.text}</span>
          {t.undo && <button onClick={() => { t.undo?.(); drop(t.id); }}>Undo</button>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Radix wrappers ---------- */
export function Modal({ open, onOpenChange, title, children, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="cc-overlay" />
        <Dialog.Content className={`cc-dialog ${wide ? "wide" : ""}`} aria-describedby={undefined}>
          <div className="cc-dialog-hd">
            <Dialog.Title style={{ margin: 0, fontSize: 14 }}>{title}</Dialog.Title>
            <Dialog.Close asChild><button className="cc-iconbtn" style={{ marginLeft: "auto" }} aria-label="Close"><X /></button></Dialog.Close>
          </div>
          <div className="cc-dialog-bd">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface MenuEntry { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; sep?: boolean }
export function Menu({ trigger, items, label, className = "cc-iconbtn", align = "end" }: { trigger: ReactNode; items: MenuEntry[]; label: string; className?: string; align?: "start" | "end" }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild><button className={className} aria-label={label}>{trigger}</button></Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="cc-menu" align={align} sideOffset={4}>
          {items.map((it, i) => it.sep
            ? <div key={i} className="cc-menu-sep" />
            : <Dropdown.Item key={i} className="cc-menu-i" style={it.danger ? { color: "var(--err)" } : undefined} onSelect={it.onSelect}>{it.icon}{it.label}</Dropdown.Item>)}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal><Tooltip.Content className="cc-tip cc-root" side="right" sideOffset={8}>{text}</Tooltip.Content></Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/* ---------- Atoms ---------- */
export function CheckBox({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className="cc-check" data-on={on} onClick={onClick} aria-label={label} aria-pressed={on}>{on && <Check />}</button>;
}
export function Prio({ p }: { p: number }) {
  return <span className="cc-prio" data-p={p} title={["No priority", "Low", "Medium", "High"][p]} role="img" aria-label={["No priority", "Low", "Medium", "High"][p]}><i /><i /><i /></span>;
}
export function HealthDot({ s }: { s?: Health }) {
  return <span className={`cc-health ${s ?? "unknown"}`} role="img" aria-label={s ?? "unknown"} title={s ?? "unknown"} />;
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="cc-empty"><b>{title}</b>{hint}{action && <div style={{ marginTop: 10 }}>{action}</div>}</div>;
}
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div style={{ padding: 14, display: "grid", gap: 12 }} aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <div key={i} className="cc-skel" style={{ width: `${90 - i * 12}%` }} />)}</div>;
}
export function Panel({ title, count, actions, children, id }: { title: string; count?: number | string; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="cc-panel" aria-labelledby={id}>
      <div className="cc-panel-hd"><h2 id={id}>{title}</h2>{count !== undefined && <span className="cc-count">{count}</span>}{actions && <div className="act">{actions}</div>}</div>
      {children}
    </section>
  );
}
export function ConnBanner({ conn, what, detail }: { conn?: string; what: string; detail?: string }) {
  if (!conn || conn === "ok") return null;
  const msg: Record<string, string> = {
    not_configured: `${what} is not connected. Add the Google credentials listed in Integrations.`,
    scope_missing: `${what} access was refused (${detail ?? "scope"}). The stored Google token lacks the required read-only scope — see Integrations.`,
    error: `${what} could not be reached${detail ? ` (${detail})` : ""}. Try again shortly.`,
  };
  return <div className="cc-banner" role="alert"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg><div>{msg[conn] ?? conn}</div></div>;
}

/* ---------- Date formatting (studio timezone aware via plain date strings) ---------- */
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const D = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function fmtDay(d: string | undefined, today: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  const diff = diffDays(d, today);
  if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; if (diff === -1) return "Yesterday";
  const wd = D[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return diff > 0 && diff < 7 ? wd : `${M[m - 1]} ${day}`;
}
export const fmtLong = (d: string) => { const [y, m, day] = d.split("-").map(Number); return `${D[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]}, ${day} ${M[m - 1]} ${y}`; };
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
