// Bridge to the native LocalBrain plugin (Android): on-device Gemma via LiteRT-LM.
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { useEffect, useState } from "react";
import { isNative } from "../settings.ts";

export interface LocalModel {
  id: "e2b" | "e4b";
  label: string;
  file: string;
  url: string;
  size: number;
  minRamGb: number;
  hint: string;
}

// Sizes and RAM guidance match Google's AI Edge Gallery model list.
export const MODELS: LocalModel[] = [
  {
    id: "e2b",
    label: "Gemma 4 · E2B",
    file: "gemma-4-E2B-it.litertlm",
    url: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm?download=true",
    size: 2588147712,
    minRamGb: 8,
    hint: "أسرع، ومناسب لمعظم الموبايلات",
  },
  {
    id: "e4b",
    label: "Gemma 4 · E4B",
    file: "gemma-4-E4B-it.litertlm",
    url: "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm?download=true",
    size: 3659530240,
    minRamGb: 12,
    hint: "أدق، بس محتاج موبايل قوي",
  },
];

export type ModelState = "absent" | "waiting" | "downloading" | "failed" | "ready";

export interface ModelStatus {
  state: ModelState;
  bytes: number;
  total: number;
  loaded: boolean;
  backend: string | null;
}

interface LocalBrainPlugin {
  deviceInfo(): Promise<{ totalRam: number; freeStorage: number }>;
  status(o: { file: string; size: number }): Promise<ModelStatus & { file: string }>;
  download(o: { file: string; url: string; title: string; allowMobileData: boolean }): Promise<void>;
  cancelDownload(o: { file: string }): Promise<void>;
  remove(o: { file: string }): Promise<void>;
  load(o: { file: string; cpuOnly?: boolean }): Promise<{ backend: string }>;
  unload(): Promise<void>;
  generate(o: {
    id: string;
    system: string;
    prompt: string;
    schema?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string; partial?: boolean }>;
  cancel(): Promise<void>;
  addListener(event: "token", fn: (d: { id: string; text: string }) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<LocalBrainPlugin>("LocalBrain");

export const localAvailable = isNative;

export function modelById(id: string): LocalModel {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function deviceInfo() {
  return Native.deviceInfo();
}

export function modelStatus(m: LocalModel): Promise<ModelStatus> {
  return Native.status({ file: m.file, size: m.size });
}

export function downloadModel(m: LocalModel, allowMobileData: boolean) {
  return Native.download({ file: m.file, url: m.url, title: `Dillo · ${m.label}`, allowMobileData });
}

export function cancelDownload(m: LocalModel) {
  return Native.cancelDownload({ file: m.file });
}

export function removeModel(m: LocalModel) {
  loading = null;
  return Native.remove({ file: m.file });
}

let loading: Promise<string> | null = null;
let loadingFile = "";

/** Loads the model once (several seconds the first time); later calls reuse it. */
export function ensureLoaded(m: LocalModel): Promise<string> {
  if (!loading || loadingFile !== m.file) {
    loadingFile = m.file;
    loading = Native.load({ file: m.file }).then((r) => r.backend);
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

let running = false;

/** Stops a generation in progress (e.g. an explanation nobody is waiting for anymore). */
export async function cancelGeneration() {
  if (running) await Native.cancel().catch(() => {});
}

// The native side runs one generation at a time; queue requests here.
let queue: Promise<unknown> = Promise.resolve();
let seq = 0;

export function generate(
  system: string,
  prompt: string,
  opts: { schema?: object; maxTokens?: number; temperature?: number; onToken?: (total: number) => void } = {},
): Promise<string> {
  const run = async () => {
    const id = `g${++seq}`;
    let count = 0;
    const handle = opts.onToken
      ? await Native.addListener("token", (d) => {
          if (d.id !== id) return;
          count += d.text.length;
          opts.onToken!(count);
        })
      : null;
    running = true;
    try {
      const r = await Native.generate({
        id,
        system,
        prompt,
        schema: opts.schema ? JSON.stringify(opts.schema) : undefined,
        maxTokens: opts.maxTokens ?? 900,
        temperature: opts.temperature ?? 0.4,
      });
      return r.text;
    } finally {
      running = false;
      await handle?.remove();
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

/** Polls a model's download/load state while mounted. */
export function useModelStatus(m: LocalModel, intervalMs = 1000) {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!localAvailable) return;
    let live = true;
    let timer = 0;
    const poll = async () => {
      try {
        const s = await modelStatus(m);
        if (!live) return;
        setStatus(s);
        if (s.state === "downloading" || s.state === "waiting") timer = window.setTimeout(poll, intervalMs);
      } catch {
        if (live) timer = window.setTimeout(poll, intervalMs * 3);
      }
    };
    poll();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [m, intervalMs, tick]);
  return { status, refresh: () => setTick((t) => t + 1) };
}
