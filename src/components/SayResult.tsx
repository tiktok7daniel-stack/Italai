import type { SayIt } from "../lib/api.ts";
import { addItem, hasItem, useNotebook } from "../lib/notebook.ts";
import { speak } from "../lib/tts.ts";
import { IconBookmark, IconBulb, IconExpand, IconPlay, IconSlow, IconWarn } from "./Icons.tsx";
import { ItalianText } from "./ItalianText.tsx";

const REGISTER_ICON: Record<string, string> = { casual: "😎", polite: "🤝", short: "⚡", warm: "🤗", firm: "✋" };

type WordHandler = (word: string, sentence: string) => void;

export function SayResult({ r, onWord, onShow, compact = false }: { r: SayIt; onWord: WordHandler; onShow: (it: string) => void; compact?: boolean }) {
  useNotebook();
  const saved = hasItem(r.natural.it);

  return (
    <article className={`result ${compact ? "compact" : ""}`}>
      <div className="hero glass">
        <div className="hero-label">
          <span className="dot" /> الطلاينة بيقولوها كده
        </div>
        <ItalianText text={r.natural.it} onWord={onWord} className="hero-it" />
        <div className="hero-pron">{r.natural.pron_ar}</div>
        {r.natural.vibe_ar && <div className="hero-vibe">{r.natural.vibe_ar}</div>}
        <div className="hero-actions">
          <button className="btn primary" onClick={() => speak(r.natural.it)}>
            <IconPlay size={18} /> اسمعها
          </button>
          <button className="icon-btn" onClick={() => speak(r.natural.it, 0.65)} aria-label="ببطء">
            <IconSlow size={20} />
          </button>
          <button className="icon-btn" onClick={() => onShow(r.natural.it)} aria-label="ورّيها">
            <IconExpand size={20} />
          </button>
          <button
            className={`icon-btn ${saved ? "on" : ""}`}
            aria-label="احفظ"
            onClick={() =>
              addItem({
                kind: "phrase",
                it: r.natural.it,
                ar: r.understood_ar,
                pron_ar: r.natural.pron_ar,
                note: r.natural.vibe_ar,
              })
            }
          >
            <IconBookmark size={20} filled={saved} />
          </button>
        </div>
        <div className="press-hint">دوس على أي كلمة تسمعها · دوسة طويلة تفهمها وتصرّفها</div>
      </div>

      {!compact && (
        <>
          {r.literal_trap.it && (
            <div className="card trap glass">
              <div className="card-title">
                <IconWarn size={16} /> الترجمة الحرفية (محدش بيقولها كده)
              </div>
              <div className="it strike" dir="ltr">{r.literal_trap.it}</div>
              <p className="muted">{r.literal_trap.why_ar}</p>
            </div>
          )}

          <div className="card glass">
            <div className="card-title">تفكيك الجملة</div>
            <div className="chunks" dir="ltr">
              {r.chunks.map((c, i) => (
                <div className="chunk" key={i}>
                  <ItalianText text={c.it} onWord={(w) => onWord(w, r.natural.it)} />
                  <span className="chunk-ar" dir="rtl">{c.ar}</span>
                  {c.note_ar && <span className="chunk-note" dir="rtl">{c.note_ar}</span>}
                </div>
              ))}
            </div>
          </div>

          {r.alternatives.length > 0 && (
            <div className="card glass">
              <div className="card-title">طرق تانية تقولها</div>
              {r.alternatives.map((a) => (
                <div className="alt" key={a.it}>
                  <div className="alt-label">
                    {REGISTER_ICON[a.register]} {a.label_ar}
                  </div>
                  <div className="alt-row">
                    <ItalianText text={a.it} onWord={onWord} className="alt-it" />
                    <button className="icon-btn sm" onClick={() => speak(a.it)} aria-label="اسمع">
                      <IconPlay size={16} />
                    </button>
                  </div>
                  <div className="muted small">{a.pron_ar}</div>
                </div>
              ))}
            </div>
          )}

          {r.grammar.length > 0 && (
            <div className="card glass">
              <div className="card-title">القاعدة ببساطة</div>
              {r.grammar.map((g) => (
                <div className="grammar" key={g.title_ar}>
                  <b>{g.title_ar}</b>
                  <p>{g.explain_ar}</p>
                </div>
              ))}
            </div>
          )}

          {r.culture_tip_ar && (
            <div className="tip">
              <IconBulb size={18} /> {r.culture_tip_ar}
            </div>
          )}
        </>
      )}
    </article>
  );
}
