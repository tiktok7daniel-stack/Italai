import { useState } from "react";
import { sayIt, type Register, type SayIt } from "../lib/api.ts";
import { load, save } from "../lib/storage.ts";
import { speechSupported } from "../lib/speech.ts";
import { IconKeyboard, IconMic, IconSend } from "./Icons.tsx";
import { MicButton } from "./MicButton.tsx";
import { SayResult } from "./SayResult.tsx";

const REGISTERS: { id: Register; label: string }[] = [
  { id: "auto", label: "على حسب الموقف" },
  { id: "casual", label: "مع صحابي (tu)" },
  { id: "polite", label: "باحترام (Lei)" },
];

const SITUATIONS = ["الشغل", "كافيه / بار", "الجيران", "الدكتور", "السوبرماركت", "مع صحابي", "مواصلات", "ورق وحكومة"];

type WordHandler = (word: string, sentence: string) => void;

export function SayTab({ onWord, onShow }: { onWord: WordHandler; onShow: (it: string) => void }) {
  const [register, setRegister] = useState<Register>(() => load("dillo.register", "auto"));
  const [situation, setSituation] = useState("");
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
    try {
      setResult(await sayIt(text, register, situation, []));
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

      {busy && <Thinking />}
      {error && <div className="error">{error}</div>}
      {result && <SayResult r={result} onWord={onWord} onShow={onShow} />}
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
