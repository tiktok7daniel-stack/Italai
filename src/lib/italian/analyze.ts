// Recognises a conjugated Italian verb form offline: "sporchi" -> sporcare, presente, tu.
import { PERSONS, type Person } from "./conjugate.ts";
import { conjugate } from "./inflect.ts";
import { VERBS } from "./verbs.ts";

export interface FormMatch {
  lemma: string;
  tense: string; // Italian tense name, as in the conjugation tables
  person: Person;
  clitic: string; // attached pronoun(s), e.g. "lo" in "prendilo"
  guessed?: boolean; // recognised by its ending only (verb not in the built-in list)
}

let index: Map<string, FormMatch[]> | null = null;

const COMPOUND_TENSES = new Set([
  "passato prossimo", "trapassato prossimo", "futuro anteriore", "condizionale passato", "congiuntivo passato", "congiuntivo trapassato",
]);

function add(map: Map<string, FormMatch[]>, form: string, m: FormMatch) {
  const key = form.toLowerCase();
  const list = map.get(key) ?? [];
  if (!list.some((x) => x.lemma === m.lemma && x.tense === m.tense && x.person === m.person)) list.push(m);
  map.set(key, list);
}

function build(verbs: string[]): Map<string, FormMatch[]> {
  const map = new Map<string, FormMatch[]>();
  for (const verb of verbs) {
    const c = conjugate(verb);
    if (!c) continue;
    for (const t of c.tenses) {
      // A bare participle ("preso") is indexed once below, not as every compound tense/person.
      if (COMPOUND_TENSES.has(t.name_it)) continue;
      t.forms.forEach((f, i) => {
        if (f.form === "—") return;
        // Index the bare verb (drop reflexive pronouns and the auxiliary, keep the participle).
        const words = f.form.split(" ");
        const bare = words[words.length - 1].replace(/\/[ae]$/, "").replace("o/a", "o").replace("i/e", "i");
        add(map, bare, { lemma: c.infinitive, tense: t.name_it, person: PERSONS[i], clitic: "" });
        if (words.length === 1) add(map, f.form, { lemma: c.infinitive, tense: t.name_it, person: PERSONS[i], clitic: "" });
      });
    }
    add(map, c.past_participle, { lemma: c.infinitive, tense: "participio passato", person: "io", clitic: "" });
    add(map, c.gerund, { lemma: c.infinitive, tense: "gerundio", person: "io", clitic: "" });
    add(map, c.infinitive, { lemma: c.infinitive, tense: "infinito", person: "io", clitic: "" });
    if (c.reflexive) add(map, c.infinitive.replace(/si$/, "e"), { lemma: c.infinitive, tense: "infinito", person: "io", clitic: "" });
  }
  return map;
}

const CLITICS = ["glielo", "gliela", "glieli", "gliele", "gliene", "melo", "mela", "meli", "mele", "telo", "tela", "celo", "cela", "selo", "sela", "velo", "vela", "mene", "tene", "sene", "cene", "lo", "la", "li", "le", "ne", "mi", "ti", "ci", "vi", "si", "gli"];

/** Possible analyses of a word; empty when it isn't a recognised verb form. */
export function analyzeVerb(raw: string, hintLemma = ""): FormMatch[] {
  index ??= build(VERBS);
  const word = raw.toLowerCase().replace(/[’']/g, "'").replace(/^[^a-zàèéìòù]+|[^a-zàèéìòù']+$/g, "");
  if (!word) return [];
  const direct = index.get(word);
  if (direct) return direct;

  // A hint from the model (e.g. a verb outside our list) is accepted only if it really produces the form.
  if (hintLemma && conjugate(hintLemma)) {
    const one = build([hintLemma]).get(word);
    if (one) return one;
  }

  // Enclitic pronouns: prendilo, parlarne, andandoci, dimmelo (di' + me + lo), fammi (fa' + mi).
  for (const cl of CLITICS) {
    if (!word.endsWith(cl) || word.length <= cl.length + 1) continue;
    const base = word.slice(0, -cl.length);
    const tries = [base, base + "e"]; // parlar-ne -> parlare
    if (base.endsWith(cl[0])) tries.push(base.slice(0, -1) + "'"); // dim-mi -> di'
    for (const t of tries) {
      const hits = index.get(t);
      if (hits) return hits.map((h) => ({ ...h, clitic: cl }));
    }
  }
  return guessByEnding(word);
}

// Endings that only verbs have (so "casa" or "patate" are never mistaken for verbs).
const AMBIGUOUS = new Set(["ato", "ata", "ati", "ate", "ito", "ita", "iti", "ite", "uto", "uta", "uti", "ute", "ano", "ono", "ino", "ete", "are", "ere", "ire", "ai", "ei"]);
let endings: { ending: string; inf: string; tense: string; person: Person }[] | null = null;

function regularEndings() {
  const models: [string, string][] = [["parlare", "parl"], ["credere", "cred"], ["dormire", "dorm"], ["finire", "fin"]];
  const list: { ending: string; inf: string; tense: string; person: Person }[] = [];
  for (const [verb, stem] of models) {
    const c = conjugate(verb);
    if (!c) continue;
    for (const t of c.tenses) {
      // A bare participle ("preso") is indexed once below, not as every compound tense/person.
      if (COMPOUND_TENSES.has(t.name_it)) continue;
      t.forms.forEach((f, i) => {
        if (!f.form.startsWith(stem) || f.form.includes(" ")) return;
        const ending = f.form.slice(stem.length);
        if (ending.length >= 3 && !AMBIGUOUS.has(ending)) list.push({ ending, inf: verb.slice(stem.length), tense: t.name_it, person: PERSONS[i] });
      });
    }
    for (const g of [c.gerund]) list.push({ ending: g.slice(stem.length), inf: verb.slice(stem.length), tense: "gerundio", person: "io" });
  }
  return list.sort((a, b) => b.ending.length - a.ending.length);
}

/** Recognises a regular form of a verb outside the list from its ending, verified by conjugating it. */
function guessByEnding(word: string): FormMatch[] {
  endings ??= regularEndings();
  for (const e of endings) {
    if (!word.endsWith(e.ending) || word.length - e.ending.length < 2) continue;
    const lemma = word.slice(0, -e.ending.length) + e.inf;
    const c = conjugate(lemma);
    const t = c?.tenses.find((x) => x.name_it === e.tense);
    const ok = e.tense === "gerundio" ? c?.gerund === word : t?.forms.find((f) => f.person === e.person)?.form === word;
    if (c && ok) return [{ lemma, tense: e.tense, person: e.person, clitic: "", guessed: true }];
  }
  return [];
}
