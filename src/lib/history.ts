// Everything translated is kept on the phone, newest first, so nothing said is ever lost.
import { useSyncExternalStore } from "react";
import { load, save } from "./storage.ts";

export type HistoryDir = "ar-it" | "it-ar";

export interface HistoryEntry {
  id: string;
  dir: HistoryDir;
  ar: string; // the Arabic side (what was said, or the translation)
  it: string; // the Italian side
  at: number;
  source: "translate" | "conversation";
}

const KEY = "dillo.history.v1";
const MAX = 3000;

let items = load<HistoryEntry[]>(KEY, []);
const listeners = new Set<() => void>();

function commit(next: HistoryEntry[]) {
  items = next.slice(0, MAX);
  save(KEY, items);
  listeners.forEach((l) => l());
}

export function useHistory() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
}

export function addHistory(entry: Omit<HistoryEntry, "id" | "at">) {
  if (!entry.ar.trim() || !entry.it.trim()) return;
  // Saying the same thing again moves it to the top instead of duplicating it.
  const rest = items.filter((i) => !(i.ar === entry.ar && i.it === entry.it));
  commit([{ ...entry, id: crypto.randomUUID(), at: Date.now() }, ...rest]);
}

export function removeHistory(id: string) {
  commit(items.filter((i) => i.id !== id));
}

export function clearHistory() {
  commit([]);
}

/** Italian sentences from the history that use a word (for examples in the word sheet). */
export function sentencesWith(word: string, limit = 3): HistoryEntry[] {
  const re = new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
  return items.filter((i) => re.test(i.it)).slice(0, limit);
}

/** Groups entries by day for display: "النهارده", "امبارح", or the date. */
export function dayLabel(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return "النهارده";
  if (diff === 1) return "امبارح";
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}
