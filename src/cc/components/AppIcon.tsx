import { monogram } from "../apps/adapter";

const HUES: Record<string, number> = { Studio: 78, Productivity: 250, Finance: 155, Operations: 215, "Content and Media": 18, "File Management": 190, Development: 280, Utilities: 40, Other: 0 };
/** Monogram tile; hue is derived from the category so related apps read as a family. Ink on a pale tint keeps it quiet. */
export function AppIcon({ name, category, size = 24 }: { name: string; category: string; size?: number }) {
  const h = HUES[category] ?? (Array.from(category).reduce((a, c) => a + c.charCodeAt(0), 0) % 360);
  return <span className="cc-appicon" aria-hidden style={{ width: size, height: size, fontSize: Math.max(8.5, Math.round(size * 0.4)), letterSpacing: size < 22 ? "-.04em" : undefined, ["--h" as string]: h }}>{monogram(name)}</span>;
}
