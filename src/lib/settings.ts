import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import { DEFAULT_MODEL } from "../../shared/dillo.ts";
import { load, save } from "./storage.ts";

export interface Settings {
  apiKey: string; // stays on this device only
  model: string;
  rate: number; // speech speed for the Italian voice
}

const KEY = "dillo.settings.v1";
let settings: Settings = { apiKey: "", model: DEFAULT_MODEL, rate: 1, ...load<Partial<Settings>>(KEY, {}) };
const listeners = new Set<() => void>();

export const isNative = Capacitor.isNativePlatform();

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

/** The app needs a key of its own unless it's the web build talking to its server. */
export function needsKey(s: Settings) {
  return isNative && !s.apiKey;
}
