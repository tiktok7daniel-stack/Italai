// Italian conjugation tables from ablaut (MIT, validated against two Italian lexicons on 280k
// forms), with the rule engine in conjugate.ts as fallback. Reflexive verbs are built here on top
// of the base verb: pronouns, essere in compound tenses, enclitic imperatives.
import { conjugate as ablautConjugate, initSync } from "@v4nn4/ablaut";
import { conjugateRules, parseInfinitive, PERSONS, type Conjugation, type TenseTable } from "./conjugate.ts";

type Six = string[];

let ready = false;

/** Loads the WebAssembly engine; until then the rule engine answers. */
export async function initInflect(load: () => Promise<BufferSource>): Promise<void> {
  if (ready) return;
  try {
    initSync({ module: await load() });
    ready = true;
  } catch (e) {
    console.warn("ablaut unavailable, using rules", e);
  }
}

export function initInflectSync(bytes: BufferSource) {
  initSync({ module: bytes });
  ready = true;
}

interface AblautIt {
  infinitive: string;
  auxiliary: string;
  gerund: string;
  pastParticiple: string;
  imperative: Six; // tu, Lei, noi, voi, loro
  present: Six;
  imperfect: Six;
  pastHistoric: Six;
  future: Six;
  conditional: Six;
  subjunctivePresent: Six;
  subjunctiveImperfect: Six;
  passatoProssimo: Six;
  trapassatoProssimo: Six;
  futuroAnteriore: Six;
  condizionalePassato: Six;
  congiuntivoPassato: Six;
  congiuntivoTrapassato: Six;
}

// [ablaut field, Italian name, Arabic name, when Italians use it]
const TENSES: [keyof AblautIt, string, string, string][] = [
  ["present", "presente", "المضارع", "دلوقتي، أو حاجة بتحصل على طول"],
  ["passatoProssimo", "passato prossimo", "الماضي", "حاجة حصلت وخلصت"],
  ["imperfect", "imperfetto", "الماضي المستمر", "كان بيحصل، أو وصف في الماضي"],
  ["future", "futuro semplice", "المستقبل", "هيحصل"],
  ["conditional", "condizionale presente", "الشرطي", "لو… / بأدب: كنت عايز"],
  ["subjunctivePresent", "congiuntivo presente", "صيغة الاحتمال", "بعد penso che / voglio che…"],
  ["imperative", "imperativo", "الأمر", "اعمل! / متعملش"],
  ["subjunctiveImperfect", "congiuntivo imperfetto", "الاحتمال في الماضي", "بعد se: لو كنت…"],
  ["condizionalePassato", "condizionale passato", "الشرطي في الماضي", "كان ممكن… / كنت هعمل"],
  ["trapassatoProssimo", "trapassato prossimo", "الماضي قبل الماضي", "كان عمل (قبل حاجة تانية)"],
  ["futuroAnteriore", "futuro anteriore", "المستقبل التام", "هيكون عمل"],
  ["pastHistoric", "passato remoto", "الماضي البعيد", "في الكتب والحكايات، وفي جنوب إيطاليا"],
  ["congiuntivoPassato", "congiuntivo passato", "الاحتمال التام", "penso che abbia fatto"],
  ["congiuntivoTrapassato", "congiuntivo trapassato", "الاحتمال قبل الماضي", "se avessi saputo…"],
];
const COMPOUND = new Set(["passatoProssimo", "trapassatoProssimo", "futuroAnteriore", "condizionalePassato", "congiuntivoPassato", "congiuntivoTrapassato"]);
const REFL = ["mi", "ti", "si", "ci", "vi", "si"];

/** "sono andato" -> "sono andato/a" so learners see the agreement. */
function agree(form: string, plural: boolean): string {
  return form.replace(/([oi])$/, (_, v) => (v === "o" && !plural ? "o/a" : v === "i" && plural ? "i/e" : v));
}

function fromAblaut(inf: string, reflexive: boolean, rawLower: string): Conjugation | null {
  let a: AblautIt;
  try {
    a = ablautConjugate(inf, "it") as AblautIt;
  } catch {
    return null;
  }
  const essere = reflexive || a.auxiliary === "essere";
  // Compound tenses of a reflexive verb use essere: take them from "essere"'s own tables.
  const essereTables = reflexive && a.auxiliary !== "essere" ? (ablautConjugate("essere", "it") as AblautIt) : null;
  const essereAux: Partial<Record<keyof AblautIt, Six>> = essereTables
    ? {
        passatoProssimo: essereTables.present,
        trapassatoProssimo: essereTables.imperfect,
        futuroAnteriore: essereTables.future,
        condizionalePassato: essereTables.conditional,
        congiuntivoPassato: essereTables.subjunctivePresent,
        congiuntivoTrapassato: essereTables.subjunctiveImperfect,
      }
    : {};
  const part = a.pastParticiple;

  const tenses: TenseTable[] = TENSES.map(([key, name_it, name_ar, when_ar]) => {
    let forms: Six = a[key] as Six;
    if (key === "imperative") forms = ["—", ...forms];
    if (COMPOUND.has(key)) {
      if (essereAux[key]) forms = essereAux[key]!.map((aux, i) => `${aux} ${part.slice(0, -1)}${i < 3 ? "o" : "i"}`);
      if (essere) forms = forms.map((f, i) => agree(f, i >= 3));
    }
    if (reflexive) {
      if (key === "imperative") {
        forms = forms.map((f, i) => (i === 0 ? f : i === 1 || i === 3 || i === 4 ? `${f.replace(/'$/, "")}${["", "ti", "", "ci", "vi"][i]}` : `si ${f}`));
      } else {
        forms = forms.map((f, i) => `${REFL[i]} ${f}`);
      }
    }
    return { name_it, name_ar, when_ar, forms: PERSONS.map((person, i) => ({ person, form: forms[i] })) };
  });

  const rules = conjugateRules(inf);
  const irregular = rules?.irregular ?? false;
  const group = inf.endsWith("are") ? "المجموعة الأولى (-are)" : inf.endsWith("ire") ? "المجموعة التالتة (-ire)" : "المجموعة التانية (-ere)";
  const isc = a.present[0].endsWith("isco");
  return {
    infinitive: reflexive ? rawLower : inf,
    reflexive,
    auxiliary: essere ? "essere" : "avere",
    past_participle: part,
    gerund: a.gerund,
    irregular,
    group_ar: group + (isc ? " بـ -isc-" : "") + (irregular ? " · شاذ" : " · منتظم") + (reflexive ? " · انعكاسي" : ""),
    tenses,
  };
}

/** Full conjugation of an infinitive (lavare, lavarsi…), or null for non-verbs. */
export function conjugate(raw: string): Conjugation | null {
  const parsed = parseInfinitive(raw);
  if (!parsed) return null;
  if (ready) {
    const c = fromAblaut(parsed.inf, parsed.reflexive, raw.trim().toLowerCase());
    if (c) return c;
  }
  return conjugateRules(raw);
}
