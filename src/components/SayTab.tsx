import { useState } from "react";
import { sayIt, type Progress, type Register, type SayIt } from "../lib/api.ts";
import { phrasesIn, type Phrase } from "../lib/knowledge/search.ts";
import type { Category } from "../lib/knowledge/phrases.ts";
import { phraseAsResult } from "../lib/local/engine.ts";
import { speak } from "../lib/tts.ts";
import { load, save } from "../lib/storage.ts";
import { speechSupported } from "../lib/speech.ts";
import { IconKeyboard, IconMic, IconPlay, IconSend } from "./Icons.tsx";
import { MicButton } from "./MicButton.tsx";
import { SayResult } from "./SayResult.tsx";

const REGISTERS: { id: Register; label: string }[] = [
  { id: "auto", label: "على حسب الموقف" },
  { id: "casual", label: "مع صحابي (tu)" },
  { id: "polite", label: "باحترام (Lei)" },
];

const SITUATIONS: Category[] = ["عام", "الشغل", "كافيه / بار", "مع صحابي", "مشاعر", "خلاف", "الجيران", "الدكتور", "السوبرماركت", "مواصلات", "ورق وحكومة", "البيت", "التليفون"];

type WordHandler = (word: string, sentence: string) => void;

export function SayTab({ onWord, onShow }: { onWord: WordHandler; onShow: (it: string) => void }) {
  const [register, setRegister] = useState<Register>(() => load("dillo.register", "auto"));
  const [situation, setSituation] = useState<Category | "">("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [typing, setTyping] = useState(!speechSupported);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SayIt | null>(null);

  async function run(text: string) {
    if (!text.trim() || busy) return;
    setAsked(text);
    setBusy(true);
    setError("");
    setResult(null);
    setProgress(null);
    try {
      setResult(await sayIt(text, register, situation, [], setProgress));
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tab say">
      <section className="intro">
        <h1>
          عايز تقول إيه؟
          <span className="intro-sub">قولها بالمصري، وأنا أقولك الطلاينة بيقولوها إزاي بالظبط.</span>
        </h1>
      </section>

      <div className="seg glass" role="tablist">
        {REGISTERS.map((r) => (
          <button
            key={r.id}
            className={register === r.id ? "active" : ""}
            onClick={() => {
              setRegister(r.id);
              save("dillo.register", r.id);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="chips scroll">
        {SITUATIONS.map((s) => (
          <button key={s} className={`chip btn-chip ${situation === s ? "active" : ""}`} onClick={() => setSituation(situation === s ? "" : s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="composer glass">
        {typing ? (
          <form
            className="type-row"
            onSubmit={(e) => {
              e.preventDefault();
              run(draft);
            }}
          >
            <textarea
              dir="rtl"
              rows={2}
              placeholder="مثلاً: لا، مش عايز أشيل الأكل من هنا عشان اللمة التانية متتوسخش"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  run(draft);
                }
              }}
            />
            <button className="icon-btn primary" type="submit" disabled={!draft.trim() || busy} aria-label="ابعت">
              <IconSend size={20} />
            </button>
          </form>
        ) : (
          <MicButton lang="ar-EG" onText={run} onInterim={setInterim} hint="دوس واتكلم بالمصري" />
        )}
        {!typing && interim && <div className="interim">{interim}</div>}
        {speechSupported && (
          <button className="switch-input" onClick={() => setTyping(!typing)}>
            {typing ? (
              <>
                <IconMic size={16} /> اتكلم بدل ما تكتب
              </>
            ) : (
              <>
                <IconKeyboard size={16} /> اكتب بدل ما تتكلم
              </>
            )}
          </button>
        )}
      </div>

      {asked && (busy || result || error) && (
        <div className="asked">
          <span className="muted small">إنت قلت</span>
          <p>{result?.understood_ar || asked}</p>
        </div>
      )}

      {busy && (
        <Thinking
          label={
            progress?.stage === "loading"
              ? "بحمّل الموديل في الذاكرة… (أول مرة بس)"
              : progress?.stage === "thinking" && progress.chars > 0
                ? "بيكتب الرد…"
                : undefined
          }
        />
      )}
      {error && <div className="error">{error}</div>}
      {result && <SayResult r={result} onWord={onWord} onShow={onShow} />}

      {situation && !busy && !result && (
        <PhraseList
          title={situation}
          phrases={phrasesIn(situation)}
          onPick={(p) => {
            setAsked(p.ar);
            setError("");
            setResult(phraseAsResult({ phrase: p, score: 1 }, p.ar));
          }}
        />
      )}
    </div>
  );
}

export function Thinking({ label = "بفكر فيها زي واحد إيطالي…" }: { label?: string }) {
  return (
    <div className="thinking glass">
      <span className="orb" />
      <span>{label}</span>
    </div>
  );
}

/** Ready-made native phrases for a situation; works offline. */
function PhraseList({ title, phrases, onPick }: { title: string; phrases: Phrase[]; onPick: (p: Phrase) => void }) {
  return (
    <section className="card glass phrase-list">
      <div className="card-title">جمل جاهزة · {title}</div>
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
