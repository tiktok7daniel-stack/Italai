import type { Heard, SayIt, WordInfo } from "../../server/schemas.ts";
import { load, save } from "./storage.ts";

export type { Heard, SayIt, WordInfo };
export type Register = "auto" | "casual" | "polite";

const ERRORS: Record<string, string> = {
  missing_key: "مفتاح Claude API مش متظبط على السيرفر (ANTHROPIC_API_KEY).",
  rate_limited: "طلبات كتير ورا بعض، استنى ثانية وجرب تاني.",
  refused: "مقدرتش أساعد في الجملة دي.",
  upstream: "في مشكلة مؤقتة في الاتصال، جرب تاني.",
};

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

export function sayIt(text: string, register: Register, situation: string, context: string[]) {
  return post<SayIt>("/api/say", { text, register, situation, context });
}

export function heard(text: string, context: string[]) {
  return post<Heard>("/api/heard", { text, context });
}

// Word lookups are cached per word+sentence so a second long-press is instant (and free).
const WORD_CACHE = "dillo.words.v1";
const wordCache = load<Record<string, WordInfo>>(WORD_CACHE, {});

export async function lookupWord(word: string, sentence: string): Promise<WordInfo> {
  const key = `${word.toLowerCase()}|${sentence}`;
  if (wordCache[key]) return wordCache[key];
  const info = await post<WordInfo>("/api/word", { word, sentence });
  wordCache[key] = info;
  const keys = Object.keys(wordCache);
  if (keys.length > 300) delete wordCache[keys[0]];
  save(WORD_CACHE, wordCache);
  return info;
}
