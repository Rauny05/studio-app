"use client";

import { useEffect, useCallback } from "react";

interface Options {
  /** Require Cmd (Mac) or Ctrl (Win) */
  meta?: boolean;
  /** Block when focus is inside an input/textarea */
  blockInInput?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: Options = { blockInInput: true }
) {
  const stable = useCallback(handler, [handler]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (options.meta && !(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;

      if (options.blockInInput !== false) {
        const tag = (document.activeElement?.tagName ?? "").toLowerCase();
        const isEditable =
          tag === "input" ||
          tag === "textarea" ||
          document.activeElement?.getAttribute("contenteditable") === "true";
        if (isEditable) return;
      }

      stable(e);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, stable, options.meta, options.blockInInput]);
}
