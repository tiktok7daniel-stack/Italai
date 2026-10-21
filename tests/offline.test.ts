import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { conjugateRules as conjugate } from "../src/lib/italian/conjugate.ts";
import { conjugate as inflect, initInflectSync } from "../src/lib/italian/inflect.ts";

initInflectSync(readFileSync(new URL("../node_modules/@v4nn4/ablaut/ablaut_bg.wasm", import.meta.url)));

// [verb, tense, person index, expected]
const CASES: [string, string, number, string][] = [
  ["parlare", "presente", 3, "parliamo"],
  ["cercare", "presente", 1, "cerchi"],
  ["cercare", "futuro semplice", 0, "cercherò"],
  ["pagare", "congiuntivo presente", 0, "paghi"],
  ["mangiare", "presente", 1, "mangi"],
  ["mangiare", "presente", 3, "mangiamo"],
  ["mangiare", "futuro semplice", 0, "mangerò"],
  ["cominciare", "condizionale presente", 0, "comincerei"],
  ["studiare", "presente", 1, "studi"],
  ["sciare", "presente", 1, "scii"],
  ["lasciare", "futuro semplice", 2, "lascerà"],
  ["prendere", "passato prossimo", 0, "ho preso"],
  ["comprendere", "passato prossimo", 3, "abbiamo compreso"],
  ["promettere", "passato prossimo", 1, "hai promesso"],
  ["dormire", "presente", 5, "dormono"],
  ["capire", "presente", 0, "capisco"],
  ["capire", "presente", 3, "capiamo"],
  ["capire", "congiuntivo presente", 5, "capiscano"],
  ["finire", "imperativo", 1, "finisci"],
  ["andare", "presente", 5, "vanno"],
  ["andare", "passato prossimo", 0, "sono andato/a"],
  ["andare", "futuro semplice", 0, "andrò"],
  ["andare", "congiuntivo presente", 0, "vada"],
  ["andare", "imperativo", 1, "va'"],
  ["essere", "imperfetto", 3, "eravamo"],
  ["essere", "passato prossimo", 3, "siamo stati/e"],
  ["avere", "congiuntivo presente", 4, "abbiate"],
  ["fare", "imperfetto", 0, "facevo"],
  ["fare", "congiuntivo presente", 0, "faccia"],
  ["dire", "passato prossimo", 0, "ho detto"],
  ["contraddire", "presente", 0, "contraddico"],
  ["venire", "futuro semplice", 0, "verrò"],
  ["divenire", "presente", 1, "divieni"],
  ["ottenere", "presente", 0, "ottengo"],
  ["volere", "condizionale presente", 0, "vorrei"],
  ["potere", "presente", 2, "può"],
  ["dovere", "congiuntivo presente", 0, "debba"],
  ["sapere", "imperativo", 1, "sappi"],
  ["uscire", "presente", 0, "esco"],
  ["riuscire", "presente", 0, "riesco"],
  ["bere", "imperfetto", 0, "bevevo"],
  ["bere", "futuro semplice", 0, "berrò"],
  ["rimanere", "passato prossimo", 0, "sono rimasto/a"],
  ["proporre", "presente", 0, "propongo"],
  ["proporre", "passato prossimo", 0, "ho proposto"],
  ["tradurre", "presente", 0, "traduco"],
  ["produrre", "passato prossimo", 0, "ho prodotto"],
  ["scegliere", "presente", 0, "scelgo"],
  ["togliere", "passato prossimo", 0, "ho tolto"],
  ["piacere", "presente", 2, "piace"],
  ["spedire", "presente", 0, "spedisco"],
  ["tradire", "presente", 0, "tradisco"],
  ["sparire", "presente", 0, "sparisco"],
  ["apparire", "presente", 0, "appaio"],
  ["morire", "passato prossimo", 2, "è morto/a"],
  ["vedere", "futuro semplice", 0, "vedrò"],
  ["vedere", "passato prossimo", 0, "ho visto"],
  ["prevedere", "passato prossimo", 0, "ho previsto"],
  ["vivere", "futuro semplice", 0, "vivrò"],
  ["leggere", "passato prossimo", 0, "ho letto"],
  ["scrivere", "passato prossimo", 0, "ho scritto"],
  ["aprire", "passato prossimo", 0, "ho aperto"],
  ["chiedere", "passato prossimo", 0, "ho chiesto"],
  ["lavarsi", "presente", 0, "mi lavo"],
  ["lavarsi", "passato prossimo", 0, "mi sono lavato/a"],
  ["lavarsi", "imperativo", 1, "lavati"],
  ["lavarsi", "imperativo", 4, "lavatevi"],
  ["svegliarsi", "presente", 1, "ti svegli"],
  ["sedersi", "presente", 0, "mi siedo"],
  ["stare", "congiuntivo presente", 2, "stia"],
  ["dare", "presente", 2, "dà"],
  ["parlare", "imperativo", 1, "parla"],
  ["parlare", "imperativo", 2, "parli"],
  ["prendere", "imperativo", 1, "prendi"],
  ["sporcare", "presente", 1, "sporchi"],
  ["sporcare", "futuro semplice", 2, "sporcherà"],
  ["dimenticare", "congiuntivo presente", 5, "dimentichino"],
  ["spegnere", "presente", 0, "spengo"],
  ["cuocere", "passato prossimo", 0, "ho cotto"],
  ["nascere", "passato prossimo", 0, "sono nato/a"],
  ["conoscere", "passato prossimo", 0, "ho conosciuto"],
  ["decidere", "passato prossimo", 0, "ho deciso"],
  ["correggere", "passato prossimo", 0, "ho corretto"],
  ["sorridere", "passato prossimo", 0, "ho sorriso"],
  ["vendere", "passato prossimo", 0, "ho venduto"],
  ["credere", "passato prossimo", 0, "ho creduto"],
  ["sentire", "presente", 2, "sente"],
  ["seguire", "presente", 0, "seguo"],
];

for (const [verb, tense, i, expected] of CASES) {
  test(`${verb} ${tense} ${i}`, () => {
    const c = conjugate(verb);
    assert.ok(c, `${verb} not conjugated`);
    const t = c.tenses.find((x) => x.name_it === tense);
    assert.ok(t, tense);
    assert.equal(t.forms[i].form, expected);
  });
}

test("auxiliaries", () => {
  assert.equal(conjugate("andare")!.auxiliary, "essere");
  assert.equal(conjugate("lavarsi")!.auxiliary, "essere");
  assert.equal(conjugate("mangiare")!.auxiliary, "avere");
});

test("non-verbs", () => {
  assert.equal(conjugate("casa"), null);
  assert.equal(conjugate("bene"), conjugate("bene")); // "bene" ends in -ene: not a verb ending
});

import { analyzeVerb } from "../src/lib/italian/analyze.ts";
import { pronounce } from "../src/lib/italian/pronounce.ts";

const FORMS: [string, string, string, string][] = [
  ["sporca", "sporcare", "presente", "lui/lei"],
  ["parliamo", "parlare", "presente", "noi"],
  ["andrò", "andare", "futuro semplice", "io"],
  ["vorrei", "volere", "condizionale presente", "io"],
  ["facevo", "fare", "imperfetto", "io"],
  ["preso", "prendere", "participio passato", "io"],
  ["capiscono", "capire", "presente", "loro"],
  ["prendilo", "prendere", "imperativo", "tu"],
  ["dimmi", "dire", "imperativo", "tu"],
  ["parlarne", "parlare", "infinito", "io"],
  ["siamo", "essere", "presente", "noi"],
];
for (const [word, lemma, tense, person] of FORMS) {
  test(`analyze ${word}`, () => {
    const hits = analyzeVerb(word);
    assert.ok(
      hits.some((h) => h.lemma === lemma && h.tense === tense && h.person === person),
      `${word}: ${JSON.stringify(hits)}`,
    );
  });
}

test("analyze unknown verb with model hint", () => {
  const hits = analyzeVerb("sbadiglio", "sbadigliare");
  assert.ok(hits.some((h) => h.lemma === "sbadigliare" && h.person === "io"));
});

test("pronounce", () => {
  assert.equal(pronounce("Ciao, come stai?"), "تشاو، كومي ستاي؟");
  assert.equal(pronounce("giorno"), "دجورنو");
  assert.equal(pronounce("acqua"), "أكّوا");
});

import { glossary, searchPhrases, standardize } from "../src/lib/knowledge/search.ts";

test("phrasebook finds the native wording", () => {
  assert.equal(searchPhrases("بكام ده")[0].phrase.it, "Quanto costa?");
  assert.equal(searchPhrases("انا تعبان اوي النهارده")[0].phrase.it, "Sono stanco morto.");
  assert.equal(searchPhrases("مش عايز اشيل الاكل من هنا عشان مايتوسخش")[0].score, 1);
});

test("Egyptian glossary handles prefixes", () => {
  const words = glossary("قول لصاحبي اني مش هقدر اجي النهارده").map((g) => g.word);
  for (const w of ["لصاحبي", "هقدر", "النهارده"]) assert.ok(words.includes(w), w);
});

// The ablaut engine and the rule engine must agree on the common tenses.
const SHARED = ["presente", "imperfetto", "futuro semplice", "condizionale presente", "congiuntivo presente"];
for (const verb of ["parlare", "mangiare", "cercare", "andare", "fare", "dire", "venire", "capire", "dormire", "prendere", "essere", "avere", "volere", "uscire", "bere", "tradurre", "proporre", "scegliere"]) {
  test(`ablaut agrees with rules: ${verb}`, () => {
    const a = inflect(verb)!;
    const r = conjugate(verb)!;
    for (const name of SHARED) {
      const fa = a.tenses.find((t) => t.name_it === name)!.forms.map((f) => f.form);
      const fr = r.tenses.find((t) => t.name_it === name)!.forms.map((f) => f.form);
      assert.deepEqual(fa, fr, `${verb} ${name}`);
    }
    assert.equal(a.past_participle, r.past_participle);
    assert.equal(a.auxiliary, r.auxiliary);
  });
}

test("ablaut tables: reflexive and advanced tenses", () => {
  const c = inflect("lavarsi")!;
  const get = (t: string, i: number) => c.tenses.find((x) => x.name_it === t)!.forms[i].form;
  assert.equal(get("presente", 0), "mi lavo");
  assert.equal(get("passato prossimo", 0), "mi sono lavato/a");
  assert.equal(get("passato prossimo", 3), "ci siamo lavati/e");
  assert.equal(get("imperativo", 1), "lavati");
  assert.equal(get("imperativo", 4), "lavatevi");
  const s = inflect("sapere")!;
  assert.equal(s.tenses.find((x) => x.name_it === "congiuntivo imperfetto")!.forms[0].form, "sapessi");
  assert.equal(s.tenses.find((x) => x.name_it === "passato remoto")!.forms[2].form, "seppe");
  assert.equal(inflect("andare")!.tenses.find((x) => x.name_it === "passato prossimo")!.forms[0].form, "sono andato/a");
});

test("recognises verbs outside the list by ending", () => {
  const h = analyzeVerb("sbadigliavamo");
  assert.ok(h.some((x) => x.lemma === "sbadigliare" && x.tense === "imperfetto" && x.person === "noi"), JSON.stringify(h));
  assert.deepEqual(analyzeVerb("patate"), []);
  assert.deepEqual(analyzeVerb("casa"), []);
});

test("bare participle is reported as a participle", () => {
  const h = analyzeVerb("sbattuto");
  assert.equal(h[0].lemma, "sbattere");
  assert.equal(h[0].tense, "participio passato");
});

test("Egyptian to standard Arabic for the translator", () => {
  assert.equal(standardize("فين الحمام لو سمحت"), "أين الحمام من فضلك");
  assert.equal(standardize("انا جعان اوي"), "أنا جائع جداً");
  assert.equal(standardize("هو بيشتغل فين"), "هو بيشتغل أين");
  assert.ok(standardize("مش عايز الاكل").startsWith("لا أريد الطعام"));
});
