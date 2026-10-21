import { useState } from "react";
import { translate, type Dir, type Translation } from "../lib/api.ts";
import { useHistory } from "../lib/history.ts";
import { pronounce } from "../lib/italian/pronounce.ts";
import { phrasesIn, type Phrase } from "../lib/knowledge/search.ts";
import type { Category } from "../lib/knowledge/phrases.ts";
import { addItem, hasItem, useNotebook } from "../lib/notebook.ts";
import { speechSupported } from "../lib/speech.ts";
import { speak } from "../lib/tts.ts";
import { IconBookmark, IconBulb, IconClose, IconExpand, IconPlay, IconSend, IconSlow, IconSwap } from "./Icons.tsx";
import { ItalianText } from "./ItalianText.tsx";
import { MicButton } from "./MicButton.tsx";
import { Thinking } from "./SayTab.tsx";

type WordHandler = (word: string, sentence: string) => void;

const SITUATIONS: Category[] = ["عام", "الشغل", "كافيه / بار", "مع صحابي", "مشاعر", "خلاف", "الجيران", "الدكتور", "السوبرماركت", "مواصلات", "ورق وحكومة", "البيت", "التليفون"];

/** Google-Translate-style screen: Arabic <-> Italian, every result saved to the history. */
export function TranslateTab({ onWord, onShow }: { onWord: WordHandler; onShow: (it: string) => void }) {
  const [dir, setDir] = useState<Dir>("ar-it");
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Translation | null>(null);
  const [situation, setSituation] = useState<Category | "">("");
  const history = useHistory();

  const fromAr = dir === "ar-it";

  async function run(text: string, d: Dir = dir) {
    const t = text.trim();
    if (!t || busy) return;
    setDraft(t);
    setBusy(true);
    setError("");
    try {
      setResult(await translate(t, d));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function swap() {
    const next: Dir = fromAr ? "it-ar" : "ar-it";
    setDir(next);
    // Like Google Translate: the translation becomes the new input.
    if (result) {
      setDraft(result.target);
      setResult(null);
    }
  }

  return (
    <div className="tab translate">
      <div className="lang-bar glass">
        <span className={`lang ${fromAr ? "" : "it"}`}>{fromAr ? "العربي" : "Italiano"}</span>
        <button className="swap" onClick={swap} aria-label="اعكس">
          <IconSwap size={20} />
        </button>
        <span className={`lang ${fromAr ? "it" : ""}`}>{fromAr ? "Italiano" : "العربي"}</span>
      </div>

      <div className="composer glass tr-input">
        <textarea
          dir={fromAr ? "rtl" : "ltr"}
          lang={fromAr ? "ar" : "it"}
          className={fromAr ? "" : "it"}
          rows={3}
          placeholder={fromAr ? "اكتب أو قول اللي عايزه…" : "Scrivi o parla in italiano…"}
          value={interim || draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              run(draft);
            }
          }}
        />
        <div className="tr-actions">
          {draft && (
            <button
              className="icon-btn sm ghost"
              aria-label="امسح"
              onClick={() => {
                setDraft("");
                setResult(null);
                setError("");
              }}
            >
              <IconClose size={16} />
            </button>
          )}
          <span className="spacer" />
          {speechSupported && (
            <MicButton
              key={dir}
              size="md"
              lang={fromAr ? "ar-EG" : "it-IT"}
              onInterim={setInterim}
              onText={(t) => {
                setInterim("");
                run(t);
              }}
            />
          )}
          <button className="icon-btn primary" disabled={!draft.trim() || busy} onClick={() => run(draft)} aria-label="ترجم">
            <IconSend size={20} />
          </button>
        </div>
      </div>

      {busy && <Thinking label="بترجم…" />}
      {error && <div className="error">{error}</div>}
      {result && <TranslationCard r={result} onWord={onWord} onShow={onShow} />}

      {!result && !busy && (
        <>
          {history.length > 0 && (
            <section className="recent">
              <div className="section-title">آخر حاجات ترجمتها</div>
              {history.slice(0, 4).map((h) => (
                <button
                  key={h.id}
                  className="recent-row glass"
                  onClick={() => {
                    setDir(h.dir);
                    setDraft(h.dir === "ar-it" ? h.ar : h.it);
                    setResult({
                      dir: h.dir,
                      source: h.dir === "ar-it" ? h.ar : h.it,
                      understood: h.dir === "ar-it" ? h.ar : h.it,
                      target: h.dir === "ar-it" ? h.it : h.ar,
                      phrase: null,
                    });
                  }}
                >
                  <span className="recent-ar">{h.ar}</span>
                  <span className="recent-it it" dir="ltr">{h.it}</span>
                </button>
              ))}
            </section>
          )}

          <div className="section-title">جمل جاهزة حسب الموقف</div>
          <div className="chips scroll">
            {SITUATIONS.map((s) => (
              <button key={s} className={`chip btn-chip ${situation === s ? "active" : ""}`} onClick={() => setSituation(situation === s ? "" : s)}>
                {s}
              </button>
            ))}
          </div>
          {situation && (
            <PhraseList
              phrases={phrasesIn(situation)}
              onPick={(p) => {
                setDir("ar-it");
                setDraft(p.ar);
                run(p.ar, "ar-it");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function TranslationCard({ r, onWord, onShow }: { r: Translation; onWord: WordHandler; onShow: (it: string) => void }) {
  useNotebook();
  const italian = r.dir === "ar-it" ? r.target : r.source;
  const arabic = r.dir === "ar-it" ? r.source : r.target;
  const saved = hasItem(italian);
  const native = r.phrase?.phrase.it.split(" / ")[0];

  const nativeCard = native && native !== italian && (
    <div className="card glass native-card">
      <div className="card-title">
        <IconBulb size={16} /> {r.phrase!.exact ? "الطلاينة بيقولوها كده" : "الطلاينة غالباً بيقولوها كده"}
      </div>
      <ItalianText text={native} onWord={onWord} className="native-it" />
      <div className="muted small">{pronounce(native)}</div>
      {r.phrase!.phrase.note && <p className="native-note">{r.phrase!.phrase.note}</p>}
      <button className="icon-btn sm" onClick={() => speak(native)} aria-label="اسمع">
        <IconPlay size={16} />
      </button>
    </div>
  );

  return (
    <article className="result">
      {r.phrase?.exact && nativeCard}
      <div className="hero glass">
        <div className="hero-label">
          <span className="dot" /> {r.dir === "ar-it" ? "بالإيطالي" : "بالعربي"}
        </div>
        {r.dir === "ar-it" ? (
          <>
            <ItalianText text={italian} onWord={onWord} className="hero-it" />
            <div className="hero-pron">{pronounce(italian)}</div>
          </>
        ) : (
          <>
            <div className="hero-ar">{arabic}</div>
            <div className="source-it">
              <ItalianText text={italian} onWord={onWord} />
            </div>
          </>
        )}
        {r.understood !== r.source && (
          <div className="understood small">
            اتفهمت كـ: <span>{r.understood}</span>
          </div>
        )}
        <div className="hero-actions">
          <button className="btn primary" onClick={() => speak(italian)}>
            <IconPlay size={18} /> اسمعها
          </button>
          <button className="icon-btn" onClick={() => speak(italian, 0.65)} aria-label="ببطء">
            <IconSlow size={20} />
          </button>
          <button className="icon-btn" onClick={() => onShow(italian)} aria-label="ورّيها">
            <IconExpand size={20} />
          </button>
          <button
            className={`icon-btn ${saved ? "on" : ""}`}
            aria-label="احفظ للمراجعة"
            onClick={() => addItem({ kind: "phrase", it: italian, ar: arabic, pron_ar: pronounce(italian), note: "" })}
          >
            <IconBookmark size={20} filled={saved} />
          </button>
        </div>
        <div className="press-hint">دوس على أي كلمة إيطالي تشوف معناها وتصريفها</div>
      </div>
      {!r.phrase?.exact && nativeCard}
    </article>
  );
}

function PhraseList({ phrases, onPick }: { phrases: Phrase[]; onPick: (p: Phrase) => void }) {
  return (
    <section className="card glass phrase-list">
      {phrases.map((p) => (
        <div className="phrase" key={p.ar + p.it}>
          <button className="phrase-main" onClick={() => onPick(p)}>
            <span className="phrase-ar">{p.ar}</span>
            <span className="phrase-it it" dir="ltr">{p.it}</span>
          </button>
          <button className="icon-btn sm" onClick={() => speak(p.it.split(" / ")[0])} aria-label="اسمع">
            <IconPlay size={16} />
          </button>
        </div>
      ))}
    </section>
  );
}
