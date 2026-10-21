import { useSyncExternalStore } from "react";
import { load, save } from "./storage.ts";

export interface NoteItem {
  id: string;
  kind: "phrase" | "word";
  it: string;
  ar: string;
  pron_ar: string;
  note: string;
  box: number; // Leitner box 0..4
  due: number; // timestamp when it should be reviewed next
  created: number;
}

const KEY = "dillo.notebook.v1";
const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [0, 1, 3, 7, 21].map((d) => d * DAY);

let items = load<NoteItem[]>(KEY, []);
const listeners = new Set<() => void>();

function commit(next: NoteItem[]) {
  items = next;
  save(KEY, items);
  listeners.forEach((l) => l());
}

export function useNotebook() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
}

export function hasItem(it: string) {
  return items.some((i) => i.it.toLowerCase() === it.toLowerCase());
}

export function addItem(item: Pick<NoteItem, "kind" | "it" | "ar"> & Partial<Pick<NoteItem, "pron_ar" | "note">>) {
  if (hasItem(item.it)) return;
  const now = Date.now();
  commit([
    { id: crypto.randomUUID(), pron_ar: "", note: "", ...item, box: 0, due: now, created: now },
    ...items,
  ]);
}

export function removeItem(id: string) {
  commit(items.filter((i) => i.id !== id));
}

export function grade(id: string, knewIt: boolean) {
  commit(
    items.map((i) => {
      if (i.id !== id) return i;
      const box = knewIt ? Math.min(i.box + 1, INTERVALS.length - 1) : 0;
      return { ...i, box, due: Date.now() + INTERVALS[box] };
    }),
  );
}

export function dueItems(all: NoteItem[]) {
  const now = Date.now();
  return all.filter((i) => i.due <= now);
}
