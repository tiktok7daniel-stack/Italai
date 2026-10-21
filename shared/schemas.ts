import { z } from "zod";

// Shapes shared by the server (structured outputs) and the client (types).
// Every field is required: "no value" is an empty string or empty array,
// which keeps the JSON schema strict and the UI simple.

const Pronounced = {
  it: z.string().describe("The Italian sentence"),
  pron_ar: z.string().describe("How to pronounce it, written in Arabic letters"),
};

export const SayItSchema = z.object({
  understood_ar: z
    .string()
    .describe("What the user meant, rewritten as clean Egyptian Arabic (fixes speech-recognition mistakes)"),
  natural: z.object({
    ...Pronounced,
    vibe_ar: z.string().describe("One short line in Arabic: why this is the way natives say it"),
  }),
  alternatives: z
    .array(
      z.object({
        register: z.enum(["casual", "polite", "short", "warm", "firm"]),
        label_ar: z.string().describe("Arabic label for when to use it, e.g. 'مع صحابك'"),
        ...Pronounced,
      }),
    )
    .describe("2-3 other ways natives would say the same thing"),
  literal_trap: z.object({
    it: z.string().describe("The word-for-word / textbook version a learner would produce. Empty if there is no trap."),
    why_ar: z.string().describe("Why natives don't say it like that. Empty if there is no trap."),
  }),
  chunks: z
    .array(
      z.object({
        it: z.string().describe("A chunk of the natural sentence, in order (a word or a fixed expression)"),
        ar: z.string().describe("Its meaning in Arabic"),
        note_ar: z.string().describe("Short note if it is an idiom/collocation; else empty"),
      }),
    )
    .describe("The natural sentence split into meaningful chunks, covering all of it in order"),
  grammar: z
    .array(z.object({ title_ar: z.string(), explain_ar: z.string() }))
    .describe("1-3 grammar points used (tense, pronoun placement, etc.) explained simply in Arabic"),
  culture_tip_ar: z.string().describe("Optional social/cultural tip in Arabic; empty if none"),
});
export type SayIt = z.infer<typeof SayItSchema>;

export const HeardSchema = z.object({
  it_clean: z.string().describe("The Italian sentence with punctuation/casing fixed (keep the words)"),
  ar: z.string().describe("Natural Egyptian Arabic meaning"),
  idioms: z
    .array(z.object({ it: z.string(), ar: z.string() }))
    .describe("Slang, idioms or colloquial expressions in the sentence explained in Arabic; empty if none"),
  reply_ideas: z
    .array(z.object({ it: z.string(), ar: z.string() }))
    .describe("2 short natural replies the user could say back"),
});
export type Heard = z.infer<typeof HeardSchema>;

const Person = z.enum(["io", "tu", "lui/lei", "noi", "voi", "loro"]);

export const WordSchema = z.object({
  word: z.string(),
  lemma: z.string().describe("Dictionary form: infinitive for verbs, masculine singular for nouns/adjectives"),
  pos: z.enum(["verb", "noun", "adjective", "adverb", "pronoun", "preposition", "conjunction", "article", "interjection", "expression", "other"]),
  pos_ar: z.string(),
  meanings_ar: z.array(z.string()).describe("Arabic meanings, most common first (1-4)"),
  meaning_here_ar: z.string().describe("The meaning in THIS sentence"),
  pron_ar: z.string().describe("Pronunciation in Arabic letters"),
  ipa: z.string(),
  how_formed_ar: z
    .string()
    .describe("Explain in Arabic exactly how this form was built from the lemma (tense, person, ending, contraction, clitics...)"),
  noun_info: z.object({
    gender: z.enum(["m", "f", "both", ""]),
    singular: z.string(),
    plural: z.string(),
    feminine: z.string().describe("Feminine form for adjectives/nouns that have one; else empty"),
  }),
  verb: z.object({
    infinitive: z.string().describe("Empty if not a verb"),
    auxiliary: z.enum(["avere", "essere", "entrambi", ""]),
    past_participle: z.string(),
    gerund: z.string(),
    group_ar: z.string().describe("Conjugation group and whether it's irregular, in Arabic"),
    tense_here: z.string().describe("Name of the tense/mood used in this sentence, in Italian (e.g. 'passato prossimo'); empty if n/a"),
    person_here: z.union([Person, z.literal("")]),
    tenses: z
      .array(
        z.object({
          name_it: z.string(),
          name_ar: z.string(),
          when_ar: z.string().describe("When Italians use this tense, one short Arabic line"),
          forms: z.array(z.object({ person: Person, form: z.string() })).describe("All 6 persons, full form incl. auxiliary"),
        }),
      )
      .describe(
        "For verbs: presente, passato prossimo, imperfetto, futuro semplice, condizionale presente, congiuntivo presente, imperativo (for imperativo use '-' for io). Empty if not a verb.",
      ),
  }),
  origin_ar: z.string().describe("Etymology in Arabic: Latin root etc. Mention Arabic loanword origin if true"),
  family: z.array(z.object({ it: z.string(), ar: z.string() })).describe("Related words from the same root"),
  examples: z.array(z.object({ it: z.string(), ar: z.string() })).describe("2-3 everyday example sentences"),
  memory_tip_ar: z.string().describe("A memorable hook to remember the word, in Arabic"),
});
export type WordInfo = z.infer<typeof WordSchema>;
