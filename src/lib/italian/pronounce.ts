// Italian -> Arabic-letter pronunciation, written for Egyptian readers (ج = hard g, دج = soft g).
// Italian spelling is regular, so rules are enough: no dictionary, no AI.

const VOWELS = "aeiouàèéìíòóùú";
const isVowel = (c: string | undefined) => c !== undefined && VOWELS.includes(c);

const VOWEL_AR: Record<string, string> = {
  a: "ا", à: "ا", e: "ي", è: "ي", é: "ي", i: "ي", ì: "ي", í: "ي", o: "و", ò: "و", ó: "و", u: "و", ù: "و", ú: "و",
};
const INITIAL_VOWEL: Record<string, string> = {
  a: "أ", à: "أ", e: "إ", è: "إ", é: "إ", i: "إي", ì: "إي", í: "إي", o: "أو", ò: "أو", ó: "أو", u: "أو", ù: "أو", ú: "أو",
};
const CONSONANT: Record<string, string> = {
  b: "ب", d: "د", f: "ف", l: "ل", m: "م", n: "ن", p: "ب", r: "ر", t: "ت", v: "ڤ", k: "ك", w: "و", y: "ي", j: "ي", x: "كس",
};

function word(w: string): string {
  const s = w.toLowerCase();
  let out = "";
  let i = 0;
  // Appends a consonant sound, doubling it with a shadda when the Italian letter is doubled.
  const put = (ar: string, len: number) => {
    out += ar;
    i += len;
  };
  while (i < s.length) {
    const c = s[i];
    const n = s[i + 1];
    const n2 = s[i + 2];
    const doubled = n === c && !isVowel(c);
    if (isVowel(c)) {
      // "ia/io/iu" after a vowel or at start are glides; elsewhere plain vowels.
      out += i === 0 ? INITIAL_VOWEL[c] : VOWEL_AR[c];
      i += 1;
      continue;
    }
    if (doubled) {
      // Render the second letter with a shadda: process the pair as one consonant.
      const rest = word(s.slice(i + 1));
      const first = rest.charAt(0);
      // "دج"/"تش"/"تس" are two letters: double the last one.
      const digraph = /^(دج|تش|تس)/.test(rest) ? rest.slice(0, 2) : first;
      out += digraph + "ّ" + rest.slice(digraph.length);
      return out;
    }
    if (c === "s" && n === "c") {
      if (n2 === "i" && isVowel(s[i + 3])) {
        put("ش", 3);
        continue;
      }
      if (n2 === "e" || n2 === "i") {
        put("ش", 2);
        continue;
      }
      if (n2 === "h") {
        put("سك", 3);
        continue;
      }
      put("سك", 2);
      continue;
    }
    if (c === "c") {
      if (n === "q") {
        put("كّ", 2);
        continue;
      }
      if (n === "h") {
        put("ك", 2);
        continue;
      }
      if (n === "i" && isVowel(n2)) {
        put("تش", 2);
        continue;
      }
      if (n === "e" || n === "i") {
        put("تش", 1);
        continue;
      }
      put("ك", 1);
      continue;
    }
    if (c === "g") {
      if (n === "l" && n2 === "i") {
        put(isVowel(s[i + 3]) ? "لّ" : "لّي", 3);
        continue;
      }
      if (n === "n") {
        put("نْي", 2);
        continue;
      }
      if (n === "h") {
        put("ج", 2);
        continue;
      }
      if (n === "i" && isVowel(n2)) {
        put("دج", 2);
        continue;
      }
      if (n === "e" || n === "i") {
        put("دج", 1);
        continue;
      }
      put("ج", 1);
      continue;
    }
    if (c === "q") {
      put("ك", 1);
      continue;
    }
    if (c === "z") {
      put("تس", 1);
      continue;
    }
    if (c === "s") {
      put(isVowel(s[i - 1]) && isVowel(n) ? "ز" : "س", 1);
      continue;
    }
    if (c === "h") {
      i += 1;
      continue;
    }
    if (c === "'" || c === "’") {
      i += 1;
      continue;
    }
    put(CONSONANT[c] ?? c, 1);
  }
  return out;
}

/** "Lascia stare, sennò si sporca." -> "لاشا ستاري، سينّو سي سبوركا." */
export function pronounce(text: string): string {
  return text
    .replace(/[,;]/g, "،")
    .replace(/\?/g, "؟")
    .split(/(\s+|[.!؟،:])/)
    .map((tok) => (/^[a-zàèéìíòóùú'’]+$/i.test(tok) ? word(tok) : tok))
    .join("");
}
