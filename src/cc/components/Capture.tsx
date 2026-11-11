"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShoots, usePrefs, useTasks } from "../store/stores";
import { newTask, parseQuickCapture } from "../lib/planner";
import { newShoot } from "../lib/shoots";
import { Modal, toast } from "./ui";
import { useUI, type CaptureKind } from "./ui-store";
import { useNow } from "./data";

const KINDS: { id: CaptureKind; label: string; hint: string }[] = [
  { id: "task", label: "Task", hint: "Edit reel tomorrow 3pm 90m !high #poco by friday" },
  { id: "shoot", label: "Shoot", hint: "Poco X8 unboxing 12 nov" },
  { id: "idea", label: "Idea", hint: "Rough idea — lands in To Shoot as Idea" },
  { id: "note", label: "Note", hint: "Saved as a tagged task you can triage later" },
  { id: "reminder", label: "Reminder", hint: "Call brand tomorrow 11am" },
];

export function Capture() {
  const { capture, captureText, closeCapture, openCapture } = useUI();
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const { today } = useNow();
  const router = useRouter();
  const addTask = useTasks((s) => s.add);
  const addShoot = useShoots((s) => s.add);
  const log = usePrefs((s) => s.log);

  useEffect(() => { if (capture) setText(captureText); }, [capture, captureText]);
  const p = useMemo(() => parseQuickCapture(text, today), [text, today]);
  const kind = capture ?? "task";

  const submit = () => {
    const title = p.title.trim();
    if (!title) return;
    if (kind === "shoot" || kind === "idea") {
      const s = newShoot({ title, status: "Idea", shootDate: kind === "shoot" ? p.plannedDate : undefined, shootTime: kind === "shoot" ? p.plannedStart : undefined });
      addShoot(s); log(`Added ${kind}: ${title}`, `/to-shoot?open=${s.id}`);
      toast(`${kind === "idea" ? "Idea" : "Shoot"} added`);
      if (kind === "shoot") router.push(`/to-shoot?open=${s.id}`);
    } else {
      const t = newTask({
        title, due: p.due, plannedDate: kind === "reminder" ? (p.plannedDate ?? today) : p.plannedDate, plannedStart: p.plannedStart,
        durationMin: p.durationMin, priority: p.priority, tags: kind === "note" ? [...p.tags, "note"] : p.tags, project: p.project, recurrence: p.recurrence,
      });
      addTask(t); log(`Added ${kind}: ${title}`, `/tasks?open=${t.id}`);
      toast(`${kind === "note" ? "Note" : kind === "reminder" ? "Reminder" : "Task"} added`);
    }
    setText(""); closeCapture();
  };

  return (
    <Modal open={!!capture} onOpenChange={(o) => !o && closeCapture()} title="Quick capture">
      <div className="cc-tabs" role="tablist" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        {KINDS.map((k) => <button key={k.id} role="tab" aria-selected={kind === k.id} className="cc-tab" onClick={() => openCapture(k.id, text)}>{k.label}</button>)}
      </div>
      <input ref={ref} autoFocus className="cc-input" value={text} placeholder={KINDS.find((k) => k.id === kind)?.hint}
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} aria-label="Capture text" />
      <div className="cc-meta" style={{ marginTop: 10, flexWrap: "wrap", minHeight: 22 }}>
        {p.title && <span className="cc-badge">“{p.title}”</span>}
        {p.plannedDate && <span className="cc-badge accent">{kind === "shoot" ? "shoot" : "work"} {p.plannedDate}{p.plannedStart ? ` ${p.plannedStart}` : ""}</span>}
        {p.due && <span className="cc-badge warn">deadline {p.due}</span>}
        {p.durationMin && <span className="cc-badge">{p.durationMin}m</span>}
        {p.priority > 0 && <span className="cc-badge">{["", "low", "medium", "high"][p.priority]}</span>}
        {p.recurrence !== "none" && <span className="cc-badge">repeats {p.recurrence}</span>}
        {p.tags.map((t) => <span key={t} className="cc-badge">#{t}</span>)}
        {p.project && <span className="cc-badge">@{p.project}</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <span className="cc-faint" style={{ marginRight: "auto", alignSelf: "center" }}><kbd>↵</kbd> to save</span>
        <button className="cc-btn ghost" onClick={closeCapture}>Cancel</button>
        <button className="cc-btn primary" disabled={!p.title.trim()} onClick={submit}>Add</button>
      </div>
    </Modal>
  );
}
