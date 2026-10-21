// The on-device "brain": builds compact prompts enriched with the offline knowledge pack
// (closest phrasebook entries + Egyptian glossary), runs Gemma locally with JSON-constrained
// output, and fills the same shapes the UI uses for Claude. Pronunciation and verb tables are
// computed by rules, not by the model.
import type { Heard, SayIt, WordInfo } from "../../../shared/schemas.ts";
import type { Register } from "../../../shared/dillo.ts";
import { pronounce } from "../italian/pronounce.ts";
import { glossary, searchPhrases, type PhraseHit } from "../knowledge/search.ts";
import { cancelGeneration, ensureLoaded, generate, modelById } from "./brain.ts";
import { getSettings } from "../settings.ts";

const str = { type: "string" };
const obj = (properties: Record<string, object>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const arr = (items: object, maxItems: number) => ({ type: "array", items, maxItems });

// Stage 1 is tiny so the Italian line shows in seconds; stage 2 (the explanation) runs after.
const SAY_FAST_SCHEMA = obj({ it: str, why_ar: str });
const SAY_DETAILS_SCHEMA = obj({
  literal_it: str,
  literal_why_ar: str,
  casual_it: str,
  polite_it: str,
  chunks: arr(obj({ it: str, ar: str }), 6),
  grammar_title_ar: str,
  grammar_ar: str,
});

const HEARD_SCHEMA = obj({
  ar: str,
  idioms: arr(obj({ it: str, ar: str }), 2),
  replies: arr(obj({ it: str, ar: str }), 2),
});

// Verb facts, tables and pronunciation come from rules; the model only gives the meaning.
const WORD_SCHEMA = obj({
  lemma: str,
  pos: { type: "string", enum: ["verb", "noun", "adjective", "adverb", "pronoun", "preposition", "conjunction", "article", "interjection", "expression", "other"] },
  meaning_here_ar: str,
  meanings_ar: arr(str, 3),
});

const SYSTEM_SAY = `You are a native Italian speaker helping an Egyptian living in Italy. He writes Egyptian Arabic. Give what an Italian would naturally say in that moment: everyday spoken Italian with natural fillers and idioms when they fit, not a literal translation. Keep his meaning and emotion, keep it short. Explanations in simple Egyptian Arabic. Reply only with the JSON object.`;

const SYSTEM_HEARD = `You help an Egyptian living in Italy understand Italian he just heard. Give the meaning in natural Egyptian Arabic (not word for word), explain slang or idioms, and suggest two short natural replies in Italian. Reply only with the JSON object.`;

const SYSTEM_WORD = `You are an Italian teacher for an Egyptian learner. Explain one Italian word as used in the given sentence. Be accurate. Explanations in simple Egyptian Arabic. Reply only with the JSON object.`;

const REGISTER_HINT: Record<Register, string> = {
  auto: "Pick the register that fits.",
  casual: "He talks to friends: casual, use tu.",
  polite: "He talks to someone he must be polite with: use Lei.",
};

function examples(hits: PhraseHit[]): string {
  if (!hits.length) return "";
  return (
    "\nHow Italians say similar things (examples):\n" +
    hits.map((h) => `- "${h.phrase.ar}" → ${h.phrase.it}`).join("\n")
  );
}

function glossLines(text: string): string {
  const g = glossary(text);
  if (!g.length) return "";
  return "\nEgyptian words in his message:\n" + g.map((x) => `- ${x.word} = ${x.meaning} (Italian: ${x.it})`).join("\n");
}

/** Parses model JSON; tolerates code fences or text around it. */
function parseJson<T>(raw: string): T {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("bad_json");
  const body = raw.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(body) as T;
}

async function run<T>(system: string, prompt: string, schema: object, maxTokens: number, onProgress?: (p: Progress) => void): Promise<T> {
  const model = modelById(getSettings().localModel);
  onProgress?.({ stage: "loading" });
  await ensureLoaded(model);
  onProgress?.({ stage: "thinking", chars: 0 });
  const onToken = (chars: number) => onProgress?.({ stage: "thinking", chars });
  let text: string;
  try {
    text = await generate(system, prompt, { schema, maxTokens, onToken });
  } catch {
    // Constrained decoding can fail on some devices; the prompt alone still asks for JSON.
    text = await generate(system, prompt + "\nReturn only the JSON object.", { maxTokens, onToken });
  }
  try {
    return parseJson<T>(text);
  } catch {
    // One retry, a bit more deterministic.
    const again = await generate(system, prompt + "\nReturn valid JSON only.", { schema, maxTokens, temperature: 0.2 });
    return parseJson<T>(again);
  }
}

export type Progress = { stage: "loading" } | { stage: "thinking"; chars: number };

/** A phrasebook entry as a full result (used directly when the user said exactly that). */
export function phraseAsResult(hit: PhraseHit, understood: string): SayIt {
  const it = hit.phrase.it.split(" / ")[0];
  const alts = hit.phrase.it.split(" / ").slice(1);
  return {
    understood_ar: understood,
    natural: { it, pron_ar: pronounce(it), vibe_ar: hit.phrase.note },
    alternatives: alts.map((a) => ({ register: "short", label_ar: "كمان ممكن تقول", it: a, pron_ar: pronounce(a) })),
    literal_trap: { it: "", why_ar: "" },
    chunks: [],
    grammar: [],
    culture_tip_ar: "",
  };
}

export type SayView = SayIt & { detailsPending?: boolean };

interface SayDetails {
  literal_it: string;
  literal_why_ar: string;
  casual_it: string;
  polite_it: string;
  chunks: { it: string; ar: string }[];
  grammar_title_ar: string;
  grammar_ar: string;
}

let sayRun = 0;
let detailsActive = false;

/**
 * Two stages so the answer appears fast: first only the natural Italian line (a few seconds),
 * then the explanation in the background, delivered through onDetails. A newer request cancels
 * an explanation still being written.
 */
export async function sayLocal(
  text: string,
  register: Register,
  situation: string,
  context: string[],
  onProgress?: (p: Progress) => void,
  onDetails?: (full: SayView) => void,
): Promise<SayView> {
  const run_id = ++sayRun;
  if (detailsActive) await cancelGeneration();
  const hits = searchPhrases(text, 3);
  const prompt =
    `His message (Egyptian Arabic): ${text}\n${REGISTER_HINT[register]}` +
    (situation ? `\nSituation: ${situation}` : "") +
    (context.length ? `\nConversation so far:\n${context.slice(-3).join("\n")}` : "") +
    glossLines(text) +
    examples(hits) +
    `\n\nJSON: it = the best natural Italian line; why_ar = one short Arabic line on why natives say it this way.`;
  const fast = await run<{ it: string; why_ar: string }>(SYSTEM_SAY, prompt, SAY_FAST_SCHEMA, 120, onProgress);
  const base: SayView = {
    understood_ar: text,
    natural: { it: fast.it, pron_ar: pronounce(fast.it), vibe_ar: fast.why_ar },
    alternatives: [],
    literal_trap: { it: "", why_ar: "" },
    chunks: [],
    grammar: [],
    culture_tip_ar: hits[0]?.score > 0.6 ? hits[0].phrase.note : "",
    detailsPending: Boolean(onDetails),
  };
  if (onDetails) {
    const detailsPrompt =
      `His message (Egyptian Arabic): ${text}\nThe natural Italian line: ${fast.it}\n\n` +
      `JSON: literal_it = the stiff word-for-word version a learner would make (empty if none); literal_why_ar = why it sounds off; casual_it / polite_it = other natural ways (tu / Lei); chunks = the Italian line split in order into small pieces with Arabic meaning; grammar_title_ar + grammar_ar = one grammar point in it, simply explained in Arabic.`;
    detailsActive = true;
    run<SayDetails>(SYSTEM_SAY, detailsPrompt, SAY_DETAILS_SCHEMA, 450)
      .finally(() => {
        if (run_id === sayRun) detailsActive = false;
      })
      .then((d) => {
        if (run_id !== sayRun) return; // a newer sentence replaced this one
        const alt = (reg: "casual" | "polite", label: string, it: string) =>
          it && it !== fast.it ? [{ register: reg, label_ar: label, it, pron_ar: pronounce(it) }] : [];
        onDetails({
          ...base,
          detailsPending: false,
          alternatives: [...alt("casual", "مع صحابك", d.casual_it), ...alt("polite", "باحترام", d.polite_it)],
          literal_trap: { it: d.literal_it && d.literal_it !== fast.it ? d.literal_it : "", why_ar: d.literal_why_ar },
          chunks: (d.chunks ?? []).map((c) => ({ ...c, note_ar: "" })),
          grammar: d.grammar_ar ? [{ title_ar: d.grammar_title_ar || "القاعدة", explain_ar: d.grammar_ar }] : [],
        });
      })
      .catch(() => {
        if (run_id === sayRun) onDetails({ ...base, detailsPending: false });
      });
  }
  return base;
}

interface HeardRaw {
  ar: string;
  idioms: { it: string; ar: string }[];
  replies: { it: string; ar: string }[];
}

export async function heardLocal(text: string, context: string[], onProgress?: (p: Progress) => void): Promise<Heard> {
  const prompt =
    `Italian he heard: ${text}` +
    (context.length ? `\nConversation so far:\n${context.slice(-3).join("\n")}` : "") +
    `\n\nJSON: ar = its meaning in Egyptian Arabic; idioms = slang/idioms in it explained in Arabic (empty if none); replies = two short natural Italian replies with Arabic meaning.`;
  const r = await run<HeardRaw>(SYSTEM_HEARD, prompt, HEARD_SCHEMA, 220, onProgress);
  return { it_clean: text, ar: r.ar, idioms: r.idioms ?? [], reply_ideas: r.replies ?? [] };
}

interface WordRaw {
  lemma: string;
  pos: WordInfo["pos"];
  meaning_here_ar: string;
  meanings_ar: string[];
}

const POS_AR: Record<string, string> = {
  verb: "فعل", noun: "اسم", adjective: "صفة", adverb: "ظرف", pronoun: "ضمير", preposition: "حرف جر",
  conjunction: "حرف عطف", article: "أداة تعريف", interjection: "تعبير", expression: "تعبير", other: "كلمة",
};

/** Model part of a word lookup (just the meaning); verb facts and tables come from the rule engines. */
export async function wordLocal(word: string, sentence: string, onProgress?: (p: Progress) => void): Promise<WordInfo> {
  const prompt = `Word: ${word}\nSentence: ${sentence || word}\n\nJSON: lemma = dictionary form; meaning_here_ar = its Arabic meaning in this sentence; meanings_ar = other common Arabic meanings.`;
  const r = await run<WordRaw>(SYSTEM_WORD, prompt, WORD_SCHEMA, 90, onProgress);
  return {
    word,
    lemma: r.lemma || word,
    pos: r.pos ?? "other",
    pos_ar: POS_AR[r.pos] ?? "كلمة",
    meanings_ar: (r.meanings_ar ?? []).filter((m) => m && m !== r.meaning_here_ar),
    meaning_here_ar: r.meaning_here_ar,
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
}
