import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import { DEFAULT_MODEL } from "../../shared/dillo.ts";
import { load, save } from "./storage.ts";

export type Engine = "local" | "claude";

export interface Settings {
  engine: Engine; // on-device model (default on the phone) or Claude
  localModel: "e2b" | "e4b";
  apiKey: string; // stays on this device only
  model: string;
  rate: number; // speech speed for the Italian voice
}

const KEY = "dillo.settings.v1";
export const isNative = Capacitor.isNativePlatform();

let settings: Settings = {
  engine: isNative ? "local" : "claude",
  localModel: "e2b",
  apiKey: "",
  model: DEFAULT_MODEL,
  rate: 1,
  ...load<Partial<Settings>>(KEY, {}),
};
// The on-device model only exists in the Android app.
if (!isNative) settings.engine = "claude";
const listeners = new Set<() => void>();

export function getSettings() {
  return settings;
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  save(KEY, settings);
  listeners.forEach((l) => l());
}

export function useSettings() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => settings,
  );
}

/** Claude in the app needs a key of its own (the web build can use its server instead). */
export function needsKey(s: Settings) {
  return isNative && s.engine === "claude" && !s.apiKey;
}
