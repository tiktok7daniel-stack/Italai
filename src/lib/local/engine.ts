// The on-device "brain": builds compact prompts enriched with the offline knowledge pack
// (closest phrasebook entries + Egyptian glossary), runs Gemma locally with JSON-constrained
// output, and fills the same shapes the UI uses for Claude. Pronunciation and verb tables are
// computed by rules, not by the model.
import type { Heard, SayIt, WordInfo } from "../../../shared/schemas.ts";
import type { Register } from "../../../shared/dillo.ts";
import { pronounce } from "../italian/pronounce.ts";
import { glossary, searchPhrases, type PhraseHit } from "../knowledge/search.ts";
import { ensureLoaded, generate, modelById } from "./brain.ts";
import { getSettings } from "../settings.ts";

const str = { type: "string" };
const obj = (properties: Record<string, object>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const arr = (items: object, maxItems: number) => ({ type: "array", items, maxItems });

const SAY_SCHEMA = obj({
  understood_ar: str,
  it: str,
  why_ar: str,
  literal_it: str,
  literal_why_ar: str,
  casual_it: str,
  polite_it: str,
  chunks: arr(obj({ it: str, ar: str }), 8),
  grammar_title_ar: str,
  grammar_ar: str,
});

const HEARD_SCHEMA = obj({
  it_clean: str,
  ar: str,
  idioms: arr(obj({ it: str, ar: str }), 3),
  replies: arr(obj({ it: str, ar: str }), 2),
});

const WORD_SCHEMA = obj({
  lemma: str,
  pos: { type: "string", enum: ["verb", "noun", "adjective", "adverb", "pronoun", "preposition", "conjunction", "article", "interjection", "expression", "other"] },
  meaning_here_ar: str,
  meanings_ar: arr(str, 4),
  how_formed_ar: str,
  gender: { type: "string", enum: ["m", "f", ""] },
  plural: str,
  origin_ar: str,
  examples: arr(obj({ it: str, ar: str }), 2),
  family: arr(obj({ it: str, ar: str }), 3),
  memory_tip_ar: str,
});

const SYSTEM_SAY = `You are a native Italian speaker helping an Egyptian living in Italy.
He writes in Egyptian Arabic (colloquial). You answer with what an Italian would naturally say in that situation: everyday spoken Italian, not a literal translation. Use the natural fillers and idioms Italians use (dai, guarda, mi sa che, figurati, non mi va, sennò…) when they fit. Keep his meaning and emotion. Keep it short like real speech.
All explanations must be in simple Egyptian Arabic. Reply only with the JSON object.`;

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

interface SayRaw {
  understood_ar: string;
  it: string;
  why_ar: string;
  literal_it: string;
  literal_why_ar: string;
  casual_it: string;
  polite_it: string;
  chunks: { it: string; ar: string }[];
  grammar_title_ar: string;
  grammar_ar: string;
}

export async function sayLocal(
  text: string,
  register: Register,
  situation: string,
  context: string[],
  onProgress?: (p: Progress) => void,
): Promise<SayIt> {
  const hits = searchPhrases(text, 4);
  const prompt =
    `His message (Egyptian Arabic): ${text}\n${REGISTER_HINT[register]}` +
    (situation ? `\nSituation: ${situation}` : "") +
    (context.length ? `\nConversation so far:\n${context.slice(-4).join("\n")}` : "") +
    glossLines(text) +
    examples(hits) +
    `\n\nFill the JSON: understood_ar = his message rewritten clearly in Egyptian Arabic; it = the best natural Italian line; why_ar = one short line why natives say it this way; literal_it = the stiff word-for-word version a learner would make (empty if none); literal_why_ar = why it sounds off; casual_it and polite_it = other natural ways (tu / Lei); chunks = the Italian line split in order into small pieces with Arabic meaning; grammar_title_ar + grammar_ar = one grammar point in it, simply explained.`;
  const r = await run<SayRaw>(SYSTEM_SAY, prompt, SAY_SCHEMA, 700, onProgress);
  const alt = (register: "casual" | "polite", label: string, it: string) =>
    it && it !== r.it ? [{ register, label_ar: label, it, pron_ar: pronounce(it) }] : [];
  return {
    understood_ar: r.understood_ar || text,
    natural: { it: r.it, pron_ar: pronounce(r.it), vibe_ar: r.why_ar },
    alternatives: [...alt("casual", "مع صحابك", r.casual_it), ...alt("polite", "باحترام", r.polite_it)],
    literal_trap: { it: r.literal_it && r.literal_it !== r.it ? r.literal_it : "", why_ar: r.literal_why_ar },
    chunks: (r.chunks ?? []).map((c) => ({ ...c, note_ar: "" })),
    grammar: r.grammar_ar ? [{ title_ar: r.grammar_title_ar || "القاعدة", explain_ar: r.grammar_ar }] : [],
    culture_tip_ar: hits[0]?.score > 0.6 ? hits[0].phrase.note : "",
  };
}

interface HeardRaw {
  it_clean: string;
  ar: string;
  idioms: { it: string; ar: string }[];
  replies: { it: string; ar: string }[];
}

export async function heardLocal(text: string, context: string[], onProgress?: (p: Progress) => void): Promise<Heard> {
  const prompt =
    `Italian he heard: ${text}` +
    (context.length ? `\nConversation so far:\n${context.slice(-4).join("\n")}` : "") +
    `\n\nFill the JSON: it_clean = the sentence with punctuation fixed; ar = its meaning in Egyptian Arabic; idioms = slang/idioms in it explained in Arabic (empty if none); replies = two short natural Italian replies with Arabic meaning.`;
  const r = await run<HeardRaw>(SYSTEM_HEARD, prompt, HEARD_SCHEMA, 400, onProgress);
  return { it_clean: r.it_clean || text, ar: r.ar, idioms: r.idioms ?? [], reply_ideas: r.replies ?? [] };
}

interface WordRaw {
  lemma: string;
  pos: WordInfo["pos"];
  meaning_here_ar: string;
  meanings_ar: string[];
  how_formed_ar: string;
  gender: "m" | "f" | "";
  plural: string;
  origin_ar: string;
  examples: { it: string; ar: string }[];
  family: { it: string; ar: string }[];
  memory_tip_ar: string;
}

const POS_AR: Record<string, string> = {
  verb: "فعل", noun: "اسم", adjective: "صفة", adverb: "ظرف", pronoun: "ضمير", preposition: "حرف جر",
  conjunction: "حرف عطف", article: "أداة تعريف", interjection: "تعبير", expression: "تعبير", other: "كلمة",
};

/** Model part of a word lookup; the verb tables are added by the caller from the rule engine. */
export async function wordLocal(word: string, sentence: string, onProgress?: (p: Progress) => void): Promise<WordInfo> {
  const prompt = `Word: ${word}\nSentence: ${sentence || word}\n\nFill the JSON: lemma = dictionary form (infinitive for verbs); meaning_here_ar = meaning in this sentence; meanings_ar = common meanings; how_formed_ar = how this exact form is built from the lemma; gender/plural for nouns; origin_ar = etymology (Latin root etc.); examples = everyday sentences; family = related words; memory_tip_ar = a fun way to remember it.`;
  const r = await run<WordRaw>(SYSTEM_WORD, prompt, WORD_SCHEMA, 600, onProgress);
  return {
    word,
    lemma: r.lemma || word,
    pos: r.pos ?? "other",
    pos_ar: POS_AR[r.pos] ?? "كلمة",
    meanings_ar: r.meanings_ar ?? [],
    meaning_here_ar: r.meaning_here_ar,
    pron_ar: pronounce(word),
    ipa: "",
    how_formed_ar: r.how_formed_ar,
    noun_info: { gender: r.gender ?? "", singular: r.pos === "noun" ? r.lemma : "", plural: r.plural ?? "", feminine: "" },
    verb: { infinitive: "", auxiliary: "", past_participle: "", gerund: "", group_ar: "", tense_here: "", person_here: "", tenses: [] },
    origin_ar: r.origin_ar,
    family: r.family ?? [],
    examples: r.examples ?? [],
    memory_tip_ar: r.memory_tip_ar,
  };
}
