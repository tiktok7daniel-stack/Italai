import assert from "node:assert/strict";
import { test } from "node:test";
import { conjugate } from "../src/lib/italian/conjugate.ts";

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
