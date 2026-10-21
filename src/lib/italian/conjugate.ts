// Rule-based Italian verb conjugation (no AI, works offline). Used as the fallback for
// inflect.ts (which prefers the ablaut engine) and for reflexive forms.
// Covers regular -are/-ere/-ire verbs (incl. -isc-), spelling rules (-care, -gare, -iare, -ciare,
// -giare), reflexive verbs, irregular participles and the common irregular verbs with their compounds.

export const PERSONS = ["io", "tu", "lui/lei", "noi", "voi", "loro"] as const;
export type Person = (typeof PERSONS)[number];
type Six = [string, string, string, string, string, string];

export interface TenseTable {
  name_it: string;
  name_ar: string;
  when_ar: string;
  forms: { person: Person; form: string }[];
}

export interface Conjugation {
  infinitive: string;
  reflexive: boolean;
  auxiliary: "avere" | "essere";
  past_participle: string;
  gerund: string;
  irregular: boolean;
  group_ar: string;
  tenses: TenseTable[];
}

interface Irregular {
  pres?: Six;
  imperfStem?: string; // e.g. "face" -> facevo
  fut?: string; // future/conditional stem, e.g. "andr"
  cong?: Six;
  impTu?: string;
  impVoi?: string;
  noImp?: boolean;
  part?: string;
  ger?: string;
  ess?: boolean; // takes essere
}

// Irregular verbs that compounds inherit only when listed explicitly (short bases would
// otherwise match regular verbs such as spedire/tradire).
const IRREGULAR: Record<string, Irregular> = {
  essere: {
    pres: ["sono", "sei", "è", "siamo", "siete", "sono"],
    imperfStem: "",
    fut: "sar",
    cong: ["sia", "sia", "sia", "siamo", "siate", "siano"],
    impTu: "sii",
    impVoi: "siate",
    part: "stato",
    ger: "essendo",
    ess: true,
  },
  avere: {
    pres: ["ho", "hai", "ha", "abbiamo", "avete", "hanno"],
    fut: "avr",
    cong: ["abbia", "abbia", "abbia", "abbiamo", "abbiate", "abbiano"],
    impTu: "abbi",
    impVoi: "abbiate",
    part: "avuto",
  },
  andare: { pres: ["vado", "vai", "va", "andiamo", "andate", "vanno"], fut: "andr", impTu: "va'", part: "andato", ess: true },
  fare: { pres: ["faccio", "fai", "fa", "facciamo", "fate", "fanno"], imperfStem: "face", fut: "far", impTu: "fa'", part: "fatto", ger: "facendo" },
  dare: { pres: ["do", "dai", "dà", "diamo", "date", "danno"], fut: "dar", cong: ["dia", "dia", "dia", "diamo", "diate", "diano"], impTu: "da'", part: "dato" },
  stare: { pres: ["sto", "stai", "sta", "stiamo", "state", "stanno"], fut: "star", cong: ["stia", "stia", "stia", "stiamo", "stiate", "stiano"], impTu: "sta'", part: "stato", ess: true },
  dire: { pres: ["dico", "dici", "dice", "diciamo", "dite", "dicono"], imperfStem: "dice", fut: "dir", impTu: "di'", part: "detto", ger: "dicendo" },
  venire: { pres: ["vengo", "vieni", "viene", "veniamo", "venite", "vengono"], fut: "verr", part: "venuto", ess: true },
  tenere: { pres: ["tengo", "tieni", "tiene", "teniamo", "tenete", "tengono"], fut: "terr", part: "tenuto" },
  volere: { pres: ["voglio", "vuoi", "vuole", "vogliamo", "volete", "vogliono"], fut: "vorr", noImp: true, part: "voluto" },
  potere: { pres: ["posso", "puoi", "può", "possiamo", "potete", "possono"], fut: "potr", noImp: true, part: "potuto" },
  dovere: { pres: ["devo", "devi", "deve", "dobbiamo", "dovete", "devono"], fut: "dovr", cong: ["debba", "debba", "debba", "dobbiamo", "dobbiate", "debbano"], noImp: true, part: "dovuto" },
  sapere: { pres: ["so", "sai", "sa", "sappiamo", "sapete", "sanno"], fut: "sapr", cong: ["sappia", "sappia", "sappia", "sappiamo", "sappiate", "sappiano"], impTu: "sappi", impVoi: "sappiate", part: "saputo" },
  uscire: { pres: ["esco", "esci", "esce", "usciamo", "uscite", "escono"], part: "uscito", ess: true },
  bere: { pres: ["bevo", "bevi", "beve", "beviamo", "bevete", "bevono"], imperfStem: "beve", fut: "berr", part: "bevuto", ger: "bevendo" },
  rimanere: { pres: ["rimango", "rimani", "rimane", "rimaniamo", "rimanete", "rimangono"], fut: "rimarr", part: "rimasto", ess: true },
  porre: { pres: ["pongo", "poni", "pone", "poniamo", "ponete", "pongono"], imperfStem: "pone", fut: "porr", part: "posto", ger: "ponendo" },
  durre: { pres: ["duco", "duci", "duce", "duciamo", "ducete", "ducono"], imperfStem: "duce", fut: "durr", part: "dotto", ger: "ducendo" },
  trarre: { pres: ["traggo", "trai", "trae", "traiamo", "traete", "traggono"], imperfStem: "trae", fut: "trarr", part: "tratto", ger: "traendo" },
  piacere: { pres: ["piaccio", "piaci", "piace", "piacciamo", "piacete", "piacciono"], part: "piaciuto", ess: true },
  tacere: { pres: ["taccio", "taci", "tace", "tacciamo", "tacete", "tacciono"], part: "taciuto" },
  sedere: { pres: ["siedo", "siedi", "siede", "sediamo", "sedete", "siedono"], fut: "sieder", part: "seduto" },
  morire: { pres: ["muoio", "muori", "muore", "moriamo", "morite", "muoiono"], part: "morto", ess: true },
  salire: { pres: ["salgo", "sali", "sale", "saliamo", "salite", "salgono"], part: "salito", ess: true },
  gliere: { pres: ["lgo", "gli", "glie", "gliamo", "gliete", "lgono"], part: "lto" },
  spegnere: { pres: ["spengo", "spegni", "spegne", "spegniamo", "spegnete", "spengono"], part: "spento" },
  parire: { pres: ["paio", "pari", "pare", "pariamo", "parite", "paiono"], part: "parso", ess: true },
  valere: { pres: ["valgo", "vali", "vale", "valiamo", "valete", "valgono"], fut: "varr", part: "valso", ess: true },
  parere: { pres: ["paio", "pari", "pare", "paiamo", "parete", "paiono"], fut: "parr", part: "parso", ess: true },
  udire: { pres: ["odo", "odi", "ode", "udiamo", "udite", "odono"], part: "udito" },
  cuocere: { pres: ["cuocio", "cuoci", "cuoce", "cuociamo", "cuocete", "cuociono"], part: "cotto" },
  cadere: { fut: "cadr", part: "caduto", ess: true },
  vedere: { fut: "vedr", part: "visto" },
  vivere: { fut: "vivr", part: "vissuto" },
  godere: { fut: "godr" },
};

// Compounds of short irregular bases, listed explicitly.
const EXPLICIT_COMPOUNDS: Record<string, string[]> = {
  dire: ["contraddire", "benedire", "maledire", "disdire", "predire", "ridire", "indire"],
  fare: ["rifare", "disfare", "contraffare", "sopraffare", "assuefare", "stupefare", "liquefare"],
  dare: ["ridare"],
  stare: ["sottostare", "sovrastare", "ristare"],
  andare: ["riandare"],
  parire: ["apparire", "comparire", "scomparire"],
  bere: ["ribere"],
};
// Bases long enough to match any verb ending in them.
const SUFFIX_BASES = ["venire", "tenere", "porre", "durre", "trarre", "uscire", "rimanere", "piacere", "tacere", "sedere", "morire", "salire", "gliere", "spegnere", "valere", "cuocere", "cadere", "vedere", "vivere", "godere", "volere", "sapere"];

// Irregular past participles of otherwise regular verbs; compounds are matched by suffix.
const PARTICIPLES: Record<string, string> = {
  prendere: "preso", mettere: "messo", scrivere: "scritto", leggere: "letto", chiudere: "chiuso",
  aprire: "aperto", offrire: "offerto", soffrire: "sofferto", coprire: "coperto", rispondere: "risposto",
  chiedere: "chiesto", vincere: "vinto", perdere: "perso", correre: "corso", decidere: "deciso",
  dividere: "diviso", ridere: "riso", spendere: "speso", accendere: "acceso", scendere: "sceso",
  rendere: "reso", rompere: "rotto", nascondere: "nascosto", piangere: "pianto", spingere: "spinto",
  dipingere: "dipinto", fingere: "finto", giungere: "giunto", muovere: "mosso", discutere: "discusso",
  succedere: "successo", concedere: "concesso", conoscere: "conosciuto", crescere: "cresciuto",
  nascere: "nato", offendere: "offeso", difendere: "difeso", uccidere: "ucciso", primere: "presso",
  reggere: "retto", struggere: "strutto", friggere: "fritto", fondere: "fuso", mergere: "merso",
  sumere: "sunto", mordere: "morso", torcere: "torto", porgere: "porto", sorgere: "sorto",
  scorgere: "scorto", accorgere: "accorto", spargere: "sparso", volgere: "volto", solvere: "solto",
  cludere: "cluso", ludere: "luso", vadere: "vaso", suadere: "suaso", pendere: "peso", tendere: "teso",
  cidere: "ciso", stringere: "stretto", tingere: "tinto", cingere: "cinto", ungere: "unto",
  pungere: "punto", mungere: "munto", redigere: "redatto", dirigere: "diretto", erigere: "eretto",
  esigere: "esatto", espellere: "espulso", scuotere: "scosso", cuotere: "cosso",
};

const ISC = new Set(
  ("capire finire preferire pulire spedire costruire colpire guarire impedire inserire obbedire ubbidire sparire " +
    "suggerire tradire unire restituire gestire fornire garantire stabilire trasferire distribuire sostituire ferire " +
    "condire arrossire dimagrire impazzire ingrandire punire reagire agire chiarire definire favorire gradire proibire " +
    "riferire contribuire attribuire abolire aderire approfondire diminuire istruire percepire starnutire digerire " +
    "smaltire fiorire impallidire stupire ammonire arricchire impoverire indebolire ammattire annuire esaurire " +
    "infastidire insospettire intimidire progredire riunire scolpire seppellire sbalordire ringiovanire invecchire " +
    "concepire costituire eseguire").split(" "),
);

const ESSERE = new Set(
  ("essere andare venire arrivare partire uscire entrare tornare ritornare restare rimanere stare diventare divenire " +
    "nascere morire cadere salire scendere succedere sembrare parere piacere dispiacere riuscire crescere dimagrire " +
    "ingrassare invecchiare costare durare bastare mancare scappare fuggire sparire apparire scomparire accadere " +
    "capitare esistere dipendere guarire emigrare evadere giungere impazzire arrossire servire occorrere sorgere " +
    "rientrare risalire ridiventare avvenire intervenire svenire valere").split(" "),
);

// Verbs where the i of -iare is stressed (scio -> scii, invio -> invii).
const STRESSED_IARE = new Set(["sciare", "inviare", "avviare", "spiare", "deviare", "obliare", "rinviare", "ovviare"]);

const PRES_ARE: Six = ["o", "i", "a", "iamo", "ate", "ano"];
const PRES_ERE: Six = ["o", "i", "e", "iamo", "ete", "ono"];
const PRES_IRE: Six = ["o", "i", "e", "iamo", "ite", "ono"];
const PRES_ISC: Six = ["isco", "isci", "isce", "iamo", "ite", "iscono"];
const IMPERF: Six = ["vo", "vi", "va", "vamo", "vate", "vano"];
const FUT: Six = ["ò", "ai", "à", "emo", "ete", "anno"];
const COND: Six = ["ei", "esti", "ebbe", "emmo", "este", "ebbero"];
const REFL: Six = ["mi", "ti", "si", "ci", "vi", "si"];
const AVERE_PRES: Six = ["ho", "hai", "ha", "abbiamo", "avete", "hanno"];
const ESSERE_PRES: Six = ["sono", "sei", "è", "siamo", "siete", "sono"];

/** Joins a stem and an ending, applying -care/-gare (add h) and -iare (merge i) spelling rules. */
function join(stem: string, ending: string, inf: string): string {
  const front = /^[ei]/.test(ending);
  if (inf.endsWith("are") && front && /[cg]$/.test(stem)) return stem + "h" + ending;
  if (inf.endsWith("iare") && stem.endsWith("i") && ending.startsWith("i")) {
    if (STRESSED_IARE.has(inf) && ending === "i") return stem + ending;
    return stem + ending.slice(1);
  }
  return stem + ending;
}

function findIrregular(inf: string): { base: string; prefix: string; data: Irregular } | null {
  if (IRREGULAR[inf]) return { base: inf, prefix: "", data: IRREGULAR[inf] };
  for (const [base, list] of Object.entries(EXPLICIT_COMPOUNDS)) {
    if (list.includes(inf)) return { base, prefix: inf.slice(0, inf.length - base.length), data: IRREGULAR[base] };
  }
  const base = SUFFIX_BASES.filter((b) => inf.endsWith(b) && inf.length > b.length).sort((a, b) => b.length - a.length)[0];
  if (base) return { base, prefix: inf.slice(0, inf.length - base.length), data: IRREGULAR[base] };
  return null;
}

function participleOf(inf: string, irr: { prefix: string; data: Irregular } | null): string {
  if (irr?.data.part) return irr.prefix + irr.data.part;
  if (PARTICIPLES[inf]) return PARTICIPLES[inf];
  const base = Object.keys(PARTICIPLES)
    .filter((b) => inf.endsWith(b) && inf.length > b.length)
    .sort((a, b) => b.length - a.length)[0];
  if (base) return inf.slice(0, inf.length - base.length) + PARTICIPLES[base];
  if (inf.endsWith("are")) return inf.slice(0, -3) + "ato";
  if (inf.endsWith("ere")) return inf.slice(0, -3) + "uto";
  return inf.slice(0, -3) + "ito";
}

function six(f: (i: number) => string): Six {
  return [f(0), f(1), f(2), f(3), f(4), f(5)];
}

/** Normalizes "lavarsi" -> { inf: "lavare", reflexive: true }; returns null for non-verbs. */
export function parseInfinitive(raw: string): { inf: string; reflexive: boolean } | null {
  const w = raw.trim().toLowerCase();
  if (/(arsi|ersi|irsi|orsi)$/.test(w)) {
    const stem = w.slice(0, -2);
    return { inf: stem.endsWith("r") && !stem.endsWith("rr") && /(ar|er|ir)$/.test(stem) ? stem + "e" : stem.replace(/r$/, "rre"), reflexive: true };
  }
  if (/(are|ere|ire|rre)$/.test(w) && w.length > 3) return { inf: w, reflexive: false };
  return null;
}

export function conjugateRules(raw: string): Conjugation | null {
  const parsed = parseInfinitive(raw);
  if (!parsed) return null;
  const { inf, reflexive } = parsed;
  const irr = findIrregular(inf);
  const d = irr?.data;
  const pre = irr?.prefix ?? "";
  const ending = inf.slice(-3);
  const stem = inf.slice(0, -3);
  const group = ending === "are" ? "are" : ending === "ere" || ending === "rre" ? "ere" : "ire";
  const isc = group === "ire" && !d?.pres && ISC.has(inf);

  // Presente
  const pres: Six = d?.pres
    ? six((i) => pre + d.pres![i])
    : six((i) => join(stem, (group === "are" ? PRES_ARE : group === "ere" ? PRES_ERE : isc ? PRES_ISC : PRES_IRE)[i], inf));

  // Imperfetto
  const imperfStem =
    d?.imperfStem !== undefined ? pre + d.imperfStem : stem + (group === "are" ? "a" : group === "ere" ? "e" : "i");
  const imperf: Six =
    inf === "essere"
      ? ["ero", "eri", "era", "eravamo", "eravate", "erano"]
      : six((i) => imperfStem + IMPERF[i]);

  // Futuro / condizionale
  let futStem: string;
  if (d?.fut) futStem = pre + d.fut;
  else if (group === "ire") futStem = stem + "ir";
  else if (group === "are") {
    // -care/-gare keep the hard sound (cercherò); -ciare/-giare drop the i (mangerò).
    if (/[cg]$/.test(stem)) futStem = stem + "her";
    else if (/[cg]i$/.test(stem) && !STRESSED_IARE.has(inf)) futStem = stem.slice(0, -1) + "er";
    else futStem = stem + "er";
  } else futStem = stem + "er";
  const fut = six((i) => futStem + FUT[i]);
  const cond = six((i) => futStem + COND[i]);

  // Congiuntivo presente: from the io stem for irregulars, regular endings otherwise.
  let cong: Six;
  if (d?.cong) cong = six((i) => pre + d.cong![i]);
  else if (d?.pres) {
    const ioStem = pres[0].replace(/o$/, "");
    const noi = pres[3];
    const a = ioStem + "a";
    cong = [a, a, a, noi, noi.slice(0, -2) + "te", ioStem + "ano"];
  } else if (group === "are") {
    cong = six((i) => join(stem, ["i", "i", "i", "iamo", "iate", "ino"][i], inf));
  } else {
    const s = isc ? stem + "isc" : stem;
    cong = [s + "a", s + "a", s + "a", stem + "iamo", stem + "iate", s + "ano"];
  }

  // Imperativo (io has none)
  let imp: Six;
  if (d?.noImp) imp = ["—", "—", "—", "—", "—", "—"];
  else {
    const tu = d?.impTu ? pre + d.impTu : group === "are" ? pres[2] : pres[1];
    const voi = d?.impVoi ? pre + d.impVoi : pres[4];
    imp = ["—", tu, cong[2], pres[3], voi, cong[5]];
  }

  const part = participleOf(inf, irr);
  const ger = d?.ger ? pre + d.ger : stem + (group === "are" ? "ando" : "endo");
  const essere = reflexive || ESSERE.has(inf) || Boolean(d?.ess && !pre) || ESSERE.has(irr ? irr.base : "");
  const auxPres = essere ? ESSERE_PRES : AVERE_PRES;
  const partFor = (i: number) => (essere ? part.slice(0, -1) + (i < 3 ? "o/a" : "i/e") : part);
  const passato = six((i) => `${auxPres[i]} ${partFor(i)}`);

  const r = (forms: Six): Six => (reflexive ? six((i) => `${REFL[i]} ${forms[i]}`) : forms);
  const rImp = (forms: Six): Six => {
    if (!reflexive || d?.noImp) return forms;
    return [
      "—",
      forms[1].replace(/'$/, "") + "ti",
      `si ${forms[2]}`,
      forms[3] + "ci",
      forms[4] + "vi",
      `si ${forms[5]}`,
    ];
  };

  const table = (name_it: string, name_ar: string, when_ar: string, forms: Six): TenseTable => ({
    name_it,
    name_ar,
    when_ar,
    forms: PERSONS.map((person, i) => ({ person, form: forms[i] })),
  });

  const irregular = Boolean(d) || participleIsIrregular(inf);
  const groupAr =
    (group === "are" ? "المجموعة الأولى (-are)" : group === "ere" ? "المجموعة التانية (-ere)" : isc ? "المجموعة التالتة (-ire) بـ -isc-" : "المجموعة التالتة (-ire)") +
    (d ? " · شاذ" : participleIsIrregular(inf) ? " · اسم المفعول شاذ" : " · منتظم") +
    (reflexive ? " · انعكاسي" : "");

  return {
    infinitive: reflexive ? raw.trim().toLowerCase() : inf,
    reflexive,
    auxiliary: essere ? "essere" : "avere",
    past_participle: part,
    gerund: ger,
    irregular,
    group_ar: groupAr,
    tenses: [
      table("presente", "المضارع", "دلوقتي، أو حاجة بتحصل على طول", r(pres)),
      table("passato prossimo", "الماضي", "حاجة حصلت وخلصت", reflexive ? six((i) => `${REFL[i]} ${passato[i]}`) : passato),
      table("imperfetto", "الماضي المستمر", "كان بيحصل، أو وصف في الماضي", r(imperf)),
      table("futuro semplice", "المستقبل", "هيحصل", r(fut)),
      table("condizionale presente", "الشرطي", "لو… / بأدب: كنت عايز", r(cond)),
      table("congiuntivo presente", "صيغة الاحتمال", "بعد penso che / voglio che…", r(cong)),
      table("imperativo", "الأمر", "اعمل! / متعملش", rImp(imp)),
    ],
  };
}

function participleIsIrregular(inf: string): boolean {
  return Object.keys(PARTICIPLES).some((b) => inf.endsWith(b));
}
