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
import { analyzeVerb } from "./italian/analyze.ts";
import { conjugate } from "./italian/inflect.ts";
import { pronounce } from "./italian/pronounce.ts";
import { googleTranslate, packsReady, type Dir } from "./google.ts";
import { addHistory, sentencesWith } from "./history.ts";
import { searchPhrases, type Phrase } from "./knowledge/search.ts";
import { modelById, modelStatus } from "./local/brain.ts";
import { heardLocal, phraseAsResult, sayLocal, wordLocal, type Progress, type SayView } from "./local/engine.ts";
import { getSettings, isNative } from "./settings.ts";
import { load, save } from "./storage.ts";

export type { Dir, Heard, Progress, Register, SayIt, SayView, WordInfo };

const ERRORS: Record<string, string> = {
  no_key: "لازم تحط مفتاح Claude API الأول من الإعدادات.",
  missing_key: "مفتاح Claude API مش شغال. اتأكد منه في الإعدادات.",
  rate_limited: "طلبات كتير ورا بعض، استنى ثانية وجرب تاني.",
  refused: "مقدرتش أساعد في الجملة دي.",
  upstream: "في مشكلة مؤقتة في الاتصال، جرب تاني.",
  offline: "مفيش نت، اتأكد من الاتصال وجرب تاني.",
  credit: "Claude رفض الطلب. غالباً الرصيد في حسابك خلص أو محتاج تفعّل الدفع من console.anthropic.com.",
  no_model: "الموديل لسه مش متحمّل على الموبايل. نزّله من الإعدادات (مرة واحدة بس).",
  local_failed: "الموديل اللي على الموبايل مقدرش يرد. جرب تاني، ولو فضلت المشكلة جرّب الموديل الأصغر من الإعدادات.",
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

/** Claude: with a key saved on the device talk to it directly; the web build can use its server. */
function viaClaude<T>(path: string, body: object, run: (c: Anthropic, model: string) => Promise<T>): Promise<T> {
  if (getSettings().apiKey) return direct(run);
  if (isNative) return Promise.reject(new Error(ERRORS.no_key));
  return post<T>(path, body);
}

const useLocal = () => isNative && getSettings().engine === "local";
const useGoogle = () => isNative && getSettings().engine === "google";

export interface Translation {
  dir: Dir;
  source: string;
  understood: string; // the source as the translator read it (Egyptian words in standard Arabic)
  target: string;
  phrase: { phrase: Phrase; exact: boolean } | null; // how Italians say it, from the phrasebook
}

/** Google Translate on the phone, plus the phrasebook's native wording when one matches. */
export async function translate(text: string, dir: Dir, origin: "translate" | "conversation" = "translate"): Promise<Translation> {
  const r = await googleTranslate(text, dir);
  const best = dir === "ar-it" ? searchPhrases(text, 1)[0] : undefined;
  const phrase = best && best.score >= 0.6 ? { phrase: best.phrase, exact: best.score >= 0.97 } : null;
  addHistory({ dir, ar: dir === "ar-it" ? text : r.text, it: dir === "ar-it" ? r.text : text, source: origin });
  return { dir, source: text, understood: r.understood, target: r.text, phrase };
}

async function viaLocal<T>(run: () => Promise<T>): Promise<T> {
  const model = modelById(getSettings().localModel);
  const status = await modelStatus(model).catch(() => null);
  if (status?.state !== "ready") throw new Error(ERRORS.no_model);
  try {
    return await run();
  } catch (error) {
    console.warn("local model failed", error);
    throw new Error(ERRORS.local_failed);
  }
}

/**
 * What an Italian would say. With the on-device AI the Italian line comes back first and the
 * explanation follows through onDetails (the result has detailsPending until then).
 */
export async function sayIt(
  text: string,
  register: Register,
  situation: string,
  context: string[],
  onProgress?: (p: Progress) => void,
  origin: "translate" | "conversation" = "translate",
  onDetails?: (full: SayView) => void,
): Promise<SayView> {
  const result = await sayItRaw(text, register, situation, context, onProgress, onDetails);
  addHistory({ dir: "ar-it", ar: text, it: result.natural.it, source: origin });
  return result;
}

async function sayItRaw(
  text: string,
  register: Register,
  situation: string,
  context: string[],
  onProgress?: (p: Progress) => void,
  onDetails?: (full: SayView) => void,
): Promise<SayView> {
  // Exactly a phrasebook sentence: answer instantly, offline, with the curated native wording.
  const best = searchPhrases(text, 1)[0];
  if (best && best.score >= 0.97 && register === "auto") return phraseAsResult(best, text);

  if (useGoogle()) {
    const r = await googleTranslate(text, "ar-it");
    const native = best && best.score >= 0.6 ? best.phrase.it.split(" / ")[0] : "";
    return {
      understood_ar: text,
      natural: { it: r.text, pron_ar: pronounce(r.text), vibe_ar: "ترجمة جوجل" },
      alternatives:
        native && native !== r.text
          ? [{ register: "casual", label_ar: "الطلاينة غالباً بيقولوها كده", it: native, pron_ar: pronounce(native) }]
          : [],
      literal_trap: { it: "", why_ar: "" },
      chunks: [],
      grammar: [],
      culture_tip_ar: native ? best!.phrase.note : "",
    };
  }
  if (useLocal()) return viaLocal(() => sayLocal(text, register, situation, context, onProgress, onDetails));
  const input = { text, register, situation, context };
  return viaClaude<SayIt>("/api/say", input, (c, m) => ask(c, m, sayRequest(input)));
}

export async function heard(text: string, context: string[], onProgress?: (p: Progress) => void): Promise<Heard> {
  let result: Heard;
  if (useGoogle()) {
    const r = await googleTranslate(text, "it-ar");
    result = { it_clean: text, ar: r.text, idioms: [], reply_ideas: [] };
  } else if (useLocal()) {
    result = await viaLocal(() => heardLocal(text, context, onProgress));
  } else {
    const input = { text, context };
    result = await viaClaude<Heard>("/api/heard", input, (c, m) => ask(c, m, heardRequest(input)));
  }
  addHistory({ dir: "it-ar", ar: result.ar, it: result.it_clean || text, source: "conversation" });
  return result;
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

const TENSE_AR: Record<string, string> = {
  presente: "المضارع",
  "passato prossimo": "الماضي",
  imperfetto: "الماضي المستمر",
  "futuro semplice": "المستقبل",
  "condizionale presente": "الشرطي",
  "congiuntivo presente": "صيغة الاحتمال",
  imperativo: "الأمر",
  "participio passato": "اسم المفعول",
  gerundio: "الـ gerundio (بيعمل)",
  infinito: "المصدر",
};
const NO_PERSON = new Set(["infinito", "participio passato", "gerundio"]);

/**
 * Verb facts come from the rule engine, never from a model: the lemma, the exact tense and person
 * of this form, and all conjugation tables.
 */
function withVerbRules(info: WordInfo | null, word: string): WordInfo | null {
  const hits = analyzeVerb(word, info?.pos === "verb" ? info.lemma : "");
  const hit = hits.find((h) => h.lemma === info?.lemma) ?? hits[0];
  const lemma = hit?.lemma ?? (info?.pos === "verb" ? info.lemma : "");
  const conj = lemma ? conjugate(lemma) : null;
  if (!conj) return info;

  const rule = hit
    ? `من الفعل ${conj.infinitive} · ${TENSE_AR[hit.tense] ?? hit.tense}` +
      (NO_PERSON.has(hit.tense) ? "" : ` · ${hit.person}`) +
      (hit.clitic ? ` · ومعاه الضمير «${hit.clitic}»` : "") +
      (hit.guessed ? " · (عرفته من آخر الكلمة)" : "")
    : "";
  const base: WordInfo = info ?? {
    word,
    lemma: conj.infinitive,
    pos: "verb",
    pos_ar: "فعل",
    meanings_ar: [],
    meaning_here_ar: "",
    pron_ar: pronounce(word),
    ipa: "",
    how_formed_ar: "",
    noun_info: { gender: "", singular: "", plural: "", feminine: "" },
    verb: { infinitive: "", auxiliary: "", past_participle: "", gerund: "", group_ar: "", tense_here: "", person_here: "", tenses: [] },
    origin_ar: "",
    family: [],
    examples: [],
    memory_tip_ar: "",
  };
  const inTable = hit && conj.tenses.some((t) => t.name_it === hit.tense);
  return {
    ...base,
    lemma: conj.infinitive,
    pos: "verb",
    pos_ar: "فعل",
    how_formed_ar: [rule, base.how_formed_ar].filter(Boolean).join("\n"),
    verb: {
      infinitive: conj.infinitive,
      auxiliary: conj.auxiliary,
      past_participle: conj.past_participle,
      gerund: conj.gerund,
      group_ar: conj.group_ar,
      tense_here: inTable ? hit.tense : "",
      person_here: inTable ? hit.person : "",
      tenses: conj.tenses,
    },
  };
}

// Word lookups are cached per word+sentence so a second long-press is instant (and free).
const WORD_CACHE = "dillo.words.v2";
const wordCache = load<Record<string, WordInfo>>(WORD_CACHE, {});

export async function lookupWord(word: string, sentence: string, onProgress?: (p: Progress) => void): Promise<WordInfo> {
  const key = `${getSettings().engine}|${word.toLowerCase()}|${sentence}`;
  if (wordCache[key]) return wordCache[key];
  const input = { word, sentence };
  let info: WordInfo | null = null;
  let failure: Error | null = null;
  try {
    // Google's meaning is instant when its packs are on the phone, so the AI engine uses it too.
    if (useGoogle() || (useLocal() && (await packsReady()))) return await wordGoogle(word, sentence);
    info = useLocal()
      ? await viaLocal(() => wordLocal(word, sentence, onProgress))
      : await viaClaude<WordInfo>("/api/word", input, (c, m) => ask(c, m, wordRequest(input)));
  } catch (e) {
    failure = e as Error;
  }
  const merged = withVerbRules(info, word);
  if (!merged) throw failure ?? new Error("حصلت مشكلة، جرب تاني.");
  if (info) {
    wordCache[key] = merged;
    const keys = Object.keys(wordCache);
    if (keys.length > 300) delete wordCache[keys[0]];
    save(WORD_CACHE, wordCache);
  } else if (failure) {
    // The verb facts still show offline; explain why the meaning is missing.
    merged.memory_tip_ar = failure.message;
  }
  return merged;
}

/**
 * Word lookup without AI: verb facts and tables from the rule engines, meanings from Google
 * Translate (the word and its dictionary form), examples from sentences already in the history.
 */
async function wordGoogle(word: string, sentence: string): Promise<WordInfo> {
  const base = withVerbRules(null, word) ?? {
    word,
    lemma: word,
    pos: "other" as const,
    pos_ar: "كلمة",
    meanings_ar: [],
    meaning_here_ar: "",
    pron_ar: pronounce(word),
    ipa: "",
    how_formed_ar: "",
    noun_info: { gender: "" as const, singular: "", plural: "", feminine: "" },
    verb: { infinitive: "", auxiliary: "" as const, past_participle: "", gerund: "", group_ar: "", tense_here: "", person_here: "" as const, tenses: [] },
    origin_ar: "",
    family: [],
    examples: [],
    memory_tip_ar: "",
  };
  const lemma = base.lemma.toLowerCase() !== word.toLowerCase() ? base.lemma : "";
  const [wordAr, lemmaAr] = await Promise.all([
    googleTranslate(word, "it-ar").then((r) => r.text).catch(() => ""),
    lemma ? googleTranslate(lemma, "it-ar").then((r) => r.text).catch(() => "") : Promise.resolve(""),
  ]);
  const meanings = [...new Set([wordAr, lemmaAr].map((m) => m.trim()).filter(Boolean))];
  const examples = sentencesWith(word)
    .filter((h) => h.it !== sentence)
    .map((h) => ({ it: h.it, ar: h.ar }));
  return {
    ...base,
    meaning_here_ar: wordAr,
    meanings_ar: meanings.length > 1 ? meanings : [],
    examples,
    memory_tip_ar: lemma && lemmaAr ? `المصدر ${lemma} معناه «${lemmaAr}»` : "",
  };
}
