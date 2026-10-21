// Google Translate on the phone (ML Kit): the same engine as Google Translate's offline mode.
// Each language pack (~30 MB) downloads once over Wi-Fi, then translation works without internet.
import { Language, Translation } from "@capacitor-mlkit/translation";
import { useEffect, useState } from "react";
import { standardize } from "./knowledge/search.ts";
import { isNative } from "./settings.ts";

export type Dir = "ar-it" | "it-ar";

export const googleAvailable = isNative;

const LANG = { ar: Language.Arabic, it: Language.Italian };

export async function googleTranslate(text: string, dir: Dir): Promise<{ text: string; understood: string }> {
  // Egyptian words become standard Arabic first: the offline model was trained on standard Arabic.
  const understood = dir === "ar-it" ? standardize(text) : text;
  const [from, to] = dir === "ar-it" ? [LANG.ar, LANG.it] : [LANG.it, LANG.ar];
  try {
    const r = await Translation.translate({ text: understood, sourceLanguage: from, targetLanguage: to });
    return { text: r.text, understood };
  } catch (e) {
    const packs = await downloadedPacks().catch(() => [] as Language[]);
    if (!packs.includes(from) || !packs.includes(to)) {
      throw new Error("الترجمة محتاجة تنزّل ملفات العربي والإيطالي مرة واحدة على واي فاي. افتح الإعدادات ونزّلهم.");
    }
    throw new Error("الترجمة مقدرتش تشتغل، جرب تاني.", { cause: e });
  }
}

export async function downloadedPacks(): Promise<Language[]> {
  const r = await Translation.getDownloadedModels();
  return r.languages;
}

/** True when both Arabic and Italian can be translated offline. */
export async function packsReady(): Promise<boolean> {
  const packs = await downloadedPacks().catch(() => [] as Language[]);
  return packs.includes(LANG.ar) && packs.includes(LANG.it);
}

export function downloadPack(lang: "ar" | "it") {
  return Translation.downloadModel({ language: LANG[lang] });
}

/** Which language packs are on the phone; re-check with refresh(). */
export function useLanguagePacks() {
  const [packs, setPacks] = useState<Language[] | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!googleAvailable) return;
    let live = true;
    downloadedPacks()
      .then((p) => live && setPacks(p))
      .catch(() => live && setPacks([]));
    return () => {
      live = false;
    };
  }, [tick]);
  return {
    ar: packs?.includes(LANG.ar) ?? false,
    it: packs?.includes(LANG.it) ?? false,
    loaded: packs !== null,
    refresh: () => setTick((t) => t + 1),
  };
}
