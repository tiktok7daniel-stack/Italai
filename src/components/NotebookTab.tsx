import { useState } from "react";
import { dueItems, grade, removeItem, useNotebook, type NoteItem } from "../lib/notebook.ts";
import { speak } from "../lib/tts.ts";
import { IconCheck, IconPlay, IconTrash, IconX } from "./Icons.tsx";
import { ItalianText } from "./ItalianText.tsx";

type WordHandler = (word: string, sentence: string) => void;

export function NotebookTab({ onWord }: { onWord: WordHandler }) {
  const items = useNotebook();
  const [filter, setFilter] = useState<"all" | "phrase" | "word">("all");
  const [reviewing, setReviewing] = useState(false);
  const due = dueItems(items);
  const shown = items.filter((i) => filter === "all" || i.kind === filter);

  if (reviewing) return <Review queue={due} onDone={() => setReviewing(false)} />;

  return (
    <div className="tab notebook">
      <section className="intro">
        <h1>
          كشكولي
          <span className="intro-sub">كل جملة وكلمة حفظتها. راجعها كل يوم شوية لحد ما تطلع منك لوحدها.</span>
        </h1>
      </section>

      <div className="stats">
        <div className="stat glass">
          <b>{items.filter((i) => i.kind === "phrase").length}</b>
          <span>جملة</span>
        </div>
        <div className="stat glass">
          <b>{items.filter((i) => i.kind === "word").length}</b>
          <span>كلمة</span>
        </div>
        <div className="stat glass">
          <b>{items.filter((i) => i.box >= 3).length}</b>
          <span>حفظتها</span>
        </div>
      </div>

      <button className="btn primary wide" disabled={due.length === 0} onClick={() => setReviewing(true)}>
        {due.length ? `راجع دلوقتي (${due.length})` : "مفيش مراجعة النهارده 👌"}
      </button>

      <div className="seg glass">
        {(
          [
            ["all", "الكل"],
            ["phrase", "جمل"],
            ["word", "كلمات"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="empty glass">
          <div className="empty-art">📒</div>
          <p>لسه فاضي. احفظ أي جملة أو كلمة بعلامة الحفظ وهتلاقيها هنا.</p>
        </div>
      )}

      <div className="note-list">
        {shown.map((i) => (
          <div className="note glass" key={i.id}>
            <div className="note-main">
              <ItalianText text={i.it} onWord={onWord} className="note-it" />
              <div className="note-ar">{i.ar}</div>
              {i.pron_ar && <div className="muted small">{i.pron_ar}</div>}
            </div>
            <div className="note-side">
              <span className={`level l${i.box}`} title="مستوى الحفظ">
                {[0, 1, 2, 3, 4].map((n) => (
                  <i key={n} className={n <= i.box ? "on" : ""} />
                ))}
              </span>
              <button className="icon-btn sm" onClick={() => speak(i.it)} aria-label="اسمع">
                <IconPlay size={16} />
              </button>
              <button className="icon-btn sm ghost" onClick={() => removeItem(i.id)} aria-label="امسح">
                <IconTrash size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Flashcards: see the Arabic, say the Italian out loud, flip, be honest. */
function Review({ queue, onDone }: { queue: NoteItem[]; onDone: () => void }) {
  const [list] = useState(() => [...queue].sort(() => Math.random() - 0.5));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = list[idx];

  if (!card) {
    return (
      <div className="tab review">
        <div className="review-done glass">
          <div className="empty-art">🎉</div>
          <h2>Bravo! خلصت المراجعة</h2>
          <button className="btn primary" onClick={onDone}>رجوع للكشكول</button>
        </div>
      </div>
    );
  }

  const answer = (knew: boolean) => {
    grade(card.id, knew);
    setFlipped(false);
    setIdx(idx + 1);
  };

  return (
    <div className="tab review">
      <div className="review-top">
        <button className="link" onClick={onDone}>خروج</button>
        <div className="progress">
          <i style={{ width: `${(idx / list.length) * 100}%` }} />
        </div>
        <span className="muted small">{idx + 1}/{list.length}</span>
      </div>

      <button
        className={`flash glass ${flipped ? "flipped" : ""}`}
        onClick={() => {
          if (!flipped) speak(card.it);
          setFlipped(true);
        }}
      >
        <span className="muted small">{card.kind === "phrase" ? "تقولها إزاي بالإيطالي؟" : "الكلمة دي بالإيطالي؟"}</span>
        <span className="flash-ar">{card.ar}</span>
        {flipped ? (
          <>
            <span className="flash-it it" dir="ltr">{card.it}</span>
            <span className="muted">{card.pron_ar}</span>
          </>
        ) : (
          <span className="flash-hint">قولها بصوت عالي، وبعدين دوس تشوف الإجابة</span>
        )}
      </button>

      {flipped && (
        <div className="grade-row">
          <button className="btn danger" onClick={() => answer(false)}>
            <IconX size={18} /> لسه
          </button>
          <button className="btn success" onClick={() => answer(true)}>
            <IconCheck size={18} /> عرفتها
          </button>
        </div>
      )}
    </div>
  );
}
