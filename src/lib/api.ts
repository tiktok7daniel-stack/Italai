import Anthropic from "@anthropic-ai/sdk";
import {
  ask,
  heardRequest,
  RefusedError,
  sayRequest,
  wordRequest,
  type Register,
} from "../../shared/dillo.ts";
import type { Heard, SayIt, WordInfo } from "../../shared/schemas.ts";
import { getSettings, isNative } from "./settings.ts";
import { load, save } from "./storage.ts";

export type { Heard, Register, SayIt, WordInfo };

const ERRORS: Record<string, string> = {
  no_key: "لازم تحط مفتاح Claude API الأول من الإعدادات.",
  missing_key: "مفتاح Claude API مش شغال. اتأكد منه في الإعدادات.",
  rate_limited: "طلبات كتير ورا بعض، استنى ثانية وجرب تاني.",
  refused: "مقدرتش أساعد في الجملة دي.",
  upstream: "في مشكلة مؤقتة في الاتصال، جرب تاني.",
  offline: "مفيش نت، اتأكد من الاتصال وجرب تاني.",
  credit: "Claude رفض الطلب. غالباً الرصيد في حسابك خلص أو محتاج تفعّل الدفع من console.anthropic.com.",
};

let client: Anthropic | null = null;
let clientKey = "";

function directClient(apiKey: string) {
  if (!client || clientKey !== apiKey) {
    // The key belongs to the phone's owner and never leaves the device except to api.anthropic.com.
    client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    clientKey = apiKey;
  }
  return client;
}

async function direct<T>(run: (c: Anthropic, model: string) => Promise<T>): Promise<T> {
  const { apiKey, model } = getSettings();
  try {
    return await run(directClient(apiKey), model);
  } catch (error) {
    if (error instanceof RefusedError) throw new Error(ERRORS.refused);
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError)
      throw new Error(ERRORS.missing_key);
    if (error instanceof Anthropic.RateLimitError) throw new Error(ERRORS.rate_limited);
    // Most 400s for a fresh personal key are an empty credit balance.
    if (error instanceof Anthropic.BadRequestError) throw new Error(ERRORS.credit);
    if (error instanceof Anthropic.APIConnectionError) throw new Error(ERRORS.offline);
    if (error instanceof Anthropic.APIError) throw new Error(ERRORS.upstream);
    throw new Error("حصلت مشكلة، جرب تاني.");
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("مفيش نت أو السيرفر مش شغال.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ERRORS[data.error] ?? "حصلت مشكلة، جرب تاني.");
  return data as T;
}

/** With a key saved on the device, talk to Claude directly; the web build can fall back to its server. */
function call<T>(path: string, body: object, run: (c: Anthropic, model: string) => Promise<T>): Promise<T> {
  if (getSettings().apiKey) return direct(run);
  if (isNative) return Promise.reject(new Error(ERRORS.no_key));
  return post<T>(path, body);
}

export function sayIt(text: string, register: Register, situation: string, context: string[]) {
  const input = { text, register, situation, context };
  return call<SayIt>("/api/say", input, (c, m) => ask(c, m, sayRequest(input)));
}

export function heard(text: string, context: string[]) {
  const input = { text, context };
  return call<Heard>("/api/heard", input, (c, m) => ask(c, m, heardRequest(input)));
}

/** Quick check used by the settings screen. */
export async function testKey(apiKey: string): Promise<string> {
  try {
    await directClient(apiKey).models.retrieve(getSettings().model);
    return "";
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return "المفتاح ده مش صح.";
    if (error instanceof Anthropic.APIConnectionError) return ERRORS.offline;
    if (error instanceof Anthropic.NotFoundError) return "الموديل ده مش متاح للحساب بتاعك.";
    if (error instanceof Anthropic.APIError) return ERRORS.upstream;
    return "حصلت مشكلة، جرب تاني.";
  }
}

// Word lookups are cached per word+sentence so a second long-press is instant (and free).
const WORD_CACHE = "dillo.words.v1";
const wordCache = load<Record<string, WordInfo>>(WORD_CACHE, {});

export async function lookupWord(word: string, sentence: string): Promise<WordInfo> {
  const key = `${word.toLowerCase()}|${sentence}`;
  if (wordCache[key]) return wordCache[key];
  const input = { word, sentence };
  const info = await call<WordInfo>("/api/word", input, (c, m) => ask(c, m, wordRequest(input)));
  wordCache[key] = info;
  const keys = Object.keys(wordCache);
  if (keys.length > 300) delete wordCache[keys[0]];
  save(WORD_CACHE, wordCache);
  return info;
}
