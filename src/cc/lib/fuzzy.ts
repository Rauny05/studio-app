/** Small subsequence fuzzy matcher with word-boundary and prefix bonuses. Higher is better; -1 = no match. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx === 0) return 1000 - t.length;
  if (idx > 0) return 800 - idx - t.length * 0.1 + (/[\s\-_/]/.test(t[idx - 1]) ? 100 : 0);
  let score = 0, ti = 0, streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    const boundary = found === 0 || /[\s\-_/]/.test(t[found - 1]);
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 6 + (boundary ? 15 : 0) - (found - ti);
    ti = found + 1;
  }
  return Math.max(1, score);
}

export function fuzzyFilter<T>(items: T[], query: string, text: (i: T) => string, limit = 50): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((i) => ({ i, s: fuzzyScore(query, text(i)) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.i);
}
