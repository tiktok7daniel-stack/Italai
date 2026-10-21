// Offline Arabic search over the phrasebook and the Egyptian glossary.
import { EGYPTIAN, type GlossRow } from "./egyptian.ts";
import { PHRASES, type Category } from "./phrases.ts";

export interface Phrase {
  category: Category;
  ar: string; // the main Egyptian wording
  variants: string[];
  it: string;
  note: string;
}

export const PHRASEBOOK: Phrase[] = PHRASES.map(([category, ar, it, note]) => {
  const variants = ar.split("|");
  return { category, ar: variants[0], variants, it, note };
});

/** Unifies spelling so "إزاي/ازاي", "أوضة/اوضه" and diacritics compare equal. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, "") // harakat, tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^ء-ي0-9a-z\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strips Egyptian clitics: و/ف/ب/ه/ال/م prefixes and ش/ك/ه/ها/ني/لي suffixes. */
function stem(word: string): string {
  let w = word;
  if (w.length > 4) w = w.replace(/^(وال|بال|فال|ال)/, "");
  if (w.length > 3) w = w.replace(/^(و|ف)/, "");
  if (w.length > 3) w = w.replace(/^(ه|ب|م)(?=[اتنيا])/, "");
  if (w.length > 4) w = w.replace(/(هاش|هوش|كيش|كوش|نيش|ليش)$/, "");
  if (w.length > 3) w = w.replace(/(ش)$/, "");
  if (w.length > 4) w = w.replace(/(هم|ها|نا|ني|لي|لك|كم|كي)$/, "");
  if (w.length > 3) w = w.replace(/(ه|ك)$/, "");
  return w;
}

const tokens = (s: string) => normalizeArabic(s).split(" ").filter((t) => t.length > 1);

interface Indexed {
  phrase: Phrase;
  stems: Set<string>;
  normals: string[];
}

const INDEX: Indexed[] = PHRASEBOOK.map((phrase) => ({
  phrase,
  normals: phrase.variants.map(normalizeArabic),
  stems: new Set(phrase.variants.flatMap(tokens).map(stem)),
}));

// Words that appear in many phrases carry less weight.
const DF = new Map<string, number>();
for (const e of INDEX) for (const s of e.stems) DF.set(s, (DF.get(s) ?? 0) + 1);

export interface PhraseHit {
  phrase: Phrase;
  score: number; // 0..1, 1 = the user said exactly this
}

export function searchPhrases(query: string, limit = 5): PhraseHit[] {
  const q = normalizeArabic(query);
  if (!q) return [];
  const qStems = [...new Set(tokens(q).map(stem))];
  const hits: PhraseHit[] = [];
  for (const e of INDEX) {
    if (e.normals.includes(q)) {
      hits.push({ phrase: e.phrase, score: 1 });
      continue;
    }
    let got = 0;
    let total = 0;
    for (const s of qStems) {
      const w = 1 / Math.log2(1 + (DF.get(s) ?? 0) + 1);
      total += w;
      if (e.stems.has(s)) got += w;
    }
    if (got === 0) continue;
    // Recall of the query and coverage of the entry both matter.
    const coverage = qStems.filter((s) => e.stems.has(s)).length / e.stems.size;
    const score = 0.65 * (got / total) + 0.35 * coverage;
    hits.push({ phrase: e.phrase, score: Math.min(score, 0.99) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function phrasesIn(category: Category): Phrase[] {
  return PHRASEBOOK.filter((p) => p.category === category);
}

interface GlossEntry {
  forms: string[];
  meaning: string;
  it: string;
}
const GLOSS: GlossEntry[] = EGYPTIAN.map(([forms, meaning, it]: GlossRow) => ({
  forms: forms.split("|").map(normalizeArabic),
  meaning,
  it,
}));
const GLOSS_BY_FORM = new Map<string, GlossEntry>();
for (const g of GLOSS) for (const f of g.forms) if (!f.includes(" ")) GLOSS_BY_FORM.set(f, g);

/** Egyptian words found in the text, with their meaning and Italian equivalent. */
export function glossary(text: string): { word: string; meaning: string; it: string }[] {
  const norm = normalizeArabic(text);
  const found = new Map<string, { word: string; meaning: string; it: string }>();
  // Multi-word expressions first.
  for (const g of GLOSS) {
    for (const f of g.forms) {
      if (f.includes(" ") && ` ${norm} `.includes(` ${f} `)) found.set(f, { word: f, meaning: g.meaning, it: g.it });
    }
  }
  for (const t of norm.split(" ")) {
    // لصاحبي -> صاحبي, هقدر -> قدر -> اقدر, بيشتغل -> يشتغل
    const bare = t.length > 3 ? t.replace(/^(ل|ب|و|ف|ه|ع)/, "") : t;
    const candidates = [t, stem(t), bare, "ا" + bare, bare.replace(/^ي/, "ا")];
    const g = candidates.map((c) => GLOSS_BY_FORM.get(c)).find(Boolean);
    if (g && !found.has(t)) found.set(t, { word: t, meaning: g.meaning, it: g.it });
  }
  return [...found.values()];
}

/** First clean gloss: "أعرف / عارف" -> "أعرف"; explanations in parentheses are not usable. */
function plainMeaning(meaning: string): string | null {
  const first = meaning.split(" / ")[0].trim();
  if (/[()]/.test(first) || first.split(" ").length > 3) return null;
  return first;
}

/**
 * Rewrites Egyptian words as standard Arabic for the offline translator:
 * "مش عايز اشيل الاكل" -> "ليس أريد أزِل الطعام" style word-level substitutions.
 * Prefixes are kept (لـ، و، ف) and the Egyptian future ه becomes سـ.
 */
export function standardize(text: string): string {
  let out = ` ${text.replace(/\s+/g, " ").trim()} `;
  for (const g of GLOSS) {
    const to = plainMeaning(g.meaning);
    if (!to) continue;
    for (const f of g.forms) if (f.includes(" ") && out.includes(` ${f} `)) out = out.split(` ${f} `).join(` ${to} `);
  }
  return out
    .trim()
    .split(" ")
    .map((tok) => {
      const t = normalizeArabic(tok);
      if (!t) return tok;
      const direct = GLOSS_BY_FORM.get(t);
      if (direct) return plainMeaning(direct.meaning) ?? tok;
      const prefix = t.length > 3 ? (t.match(/^(وال|بال|فال|لل|ال|ل|و|ف|ه|ب)/)?.[0] ?? "") : "";
      if (!prefix) return tok;
      const bare = t.slice(prefix.length);
      // بيشتغل / هيروح: the glossary gives first-person verbs, so other persons stay as written.
      if ((prefix === "ب" || prefix === "ه") && /^[يتن]/.test(bare)) return tok;
      const g =
        GLOSS_BY_FORM.get(bare) ??
        GLOSS_BY_FORM.get("ا" + bare);
      const m = g && plainMeaning(g.meaning);
      if (!m) return tok;
      if (prefix.endsWith("ال") || prefix === "لل") return prefix + m.replace(/^ال/, ""); // الاكل -> الطعام
      if (prefix === "ه") return "س" + m; // هروح -> سأذهب
      if (prefix === "ب") return m; // باكل -> آكل
      return prefix + m;
    })
    .join(" ");
}
