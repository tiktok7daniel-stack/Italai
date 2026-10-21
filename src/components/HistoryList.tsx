import { useMemo, useState } from "react";
import { clearHistory, dayLabel, removeHistory, useHistory, type HistoryEntry } from "../lib/history.ts";
import { normalizeArabic } from "../lib/knowledge/search.ts";
import { pronounce } from "../lib/italian/pronounce.ts";
import { addItem, hasItem, useNotebook } from "../lib/notebook.ts";
import { speak } from "../lib/tts.ts";
import { Emblem } from "./Emblem.tsx";
import { IconBookmark, IconChat, IconPlay, IconSearch, IconTrash } from "./Icons.tsx";
import { ItalianText } from "./ItalianText.tsx";

type WordHandler = (word: string, sentence: string) => void;

/** Everything ever translated, grouped by day and searchable in both languages. */
export function HistoryList({ onWord }: { onWord: WordHandler }) {
  const history = useHistory();
  useNotebook();
  const [query, setQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim();
    if (!q) return history;
    const qAr = normalizeArabic(q);
    const qIt = q.toLowerCase();
    return history.filter((h) => normalizeArabic(h.ar).includes(qAr) || h.it.toLowerCase().includes(qIt));
  }, [history, query]);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const h of shown) {
      const k = dayLabel(h.at);
      map.set(k, [...(map.get(k) ?? []), h]);
    }
    return [...map.entries()];
  }, [shown]);

  if (history.length === 0) {
    return (
      <div className="empty glass">
        <Emblem>
          <IconChat size={30} />
        </Emblem>
        <p>كل حاجة هتترجمها هتتحفظ هنا لوحدها، بالتاريخ. ترجع لها وقت ما تحب وتدوس على أي كلمة تشرحهالك.</p>
      </div>
    );
  }

  return (
    <div className="history">
      <label className="search glass">
        <IconSearch size={18} />
        <input placeholder="دوّر في كل اللي قلته… (عربي أو إيطالي)" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="muted small">{history.length} جملة محفوظة</div>

      {groups.map(([day, list]) => (
        <section key={day} className="day">
          <div className="section-title">{day}</div>
          {list.map((h) => {
            const saved = hasItem(h.it);
            return (
              <div className="h-row glass" key={h.id}>
                <div className="h-main">
                  <div className="h-ar">{h.ar}</div>
                  <ItalianText text={h.it} onWord={onWord} className="h-it" />
                  <div className="h-meta">
                    {h.source === "conversation" && <span className="pill">محادثة</span>}
                    <span>{new Date(h.at).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                </div>
                <div className="h-side">
                  <button className="icon-btn sm" onClick={() => speak(h.it)} aria-label="اسمع">
                    <IconPlay size={16} />
                  </button>
                  <button
                    className={`icon-btn sm ${saved ? "on" : ""}`}
                    aria-label="احفظ للمراجعة"
                    onClick={() => addItem({ kind: "phrase", it: h.it, ar: h.ar, pron_ar: pronounce(h.it), note: "" })}
                  >
                    <IconBookmark size={16} filled={saved} />
                  </button>
                  <button className="icon-btn sm ghost" onClick={() => removeHistory(h.id)} aria-label="امسح">
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ))}

      {!query && (
        <div className="clear-row">
          {confirmClear ? (
            <>
              <span className="muted small">متأكد؟ مش هتقدر ترجعه.</span>
              <button
                className="btn danger small-btn"
                onClick={() => {
                  clearHistory();
                  setConfirmClear(false);
                }}
              >
                امسح الكل
              </button>
              <button className="link small" onClick={() => setConfirmClear(false)}>
                لا
              </button>
            </>
          ) : (
            <button className="link small" onClick={() => setConfirmClear(true)}>
              امسح السجل كله
            </button>
          )}
        </div>
      )}
    </div>
  );
}
