import { useEffect, useRef, useState } from "react";
import { heard, sayIt, type Heard, type SayIt } from "../lib/api.ts";
import { speechSupported, useRecognizer } from "../lib/speech.ts";
import { speak } from "../lib/tts.ts";
import { Emblem } from "./Emblem.tsx";
import { IconBubbles, IconEar, IconPlay, IconSend, IconStop } from "./Icons.tsx";
import { ItalianText } from "./ItalianText.tsx";
import { MicButton } from "./MicButton.tsx";
import { SayResult } from "./SayResult.tsx";

type Entry =
  | { id: number; who: "them"; text: string; data?: Heard; error?: string }
  | { id: number; who: "me"; text: string; data?: SayIt; error?: string };

type WordHandler = (word: string, sentence: string) => void;

let nextId = 1;

/**
 * Conversation mode: the app keeps listening to the Italian side and explains each sentence live.
 * When it's your turn, hold the Arabic mic and it gives you the native way to answer,
 * aware of what was just said.
 */
export function LiveTab({ onWord, onShow }: { onWord: WordHandler; onShow: (it: string) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [myInterim, setMyInterim] = useState("");
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const context = () =>
    entriesRef.current
      .slice(-6)
      .map((e) => (e.who === "them" ? `Italian: ${e.text}` : `Me: ${e.data?.natural.it ?? e.text}`));

  function patch(id: number, p: Partial<Entry>) {
    setEntries((list) => list.map((e) => (e.id === id ? ({ ...e, ...p } as Entry) : e)));
  }

  function onHeard(text: string) {
    const id = nextId++;
    const ctx = context();
    setEntries((l) => [...l, { id, who: "them", text }]);
    heard(text, ctx)
      .then((data) => patch(id, { data }))
      .catch((e: Error) => patch(id, { error: e.message }));
  }

  const listener = useRecognizer("it-IT", "stream", onHeard);
  // Only one recognizer can run at a time, and we don't want to transcribe our own TTS:
  // pause the Italian listener during my turn and resume it after the answer is spoken.
  const resume = useRef(false);
  function resumeListening() {
    if (resume.current) {
      resume.current = false;
      listener.start();
    }
  }
  function onMyMic() {
    if (listener.active) {
      resume.current = true;
      listener.stop();
    }
  }

  function onMine(text: string) {
    if (!text.trim()) return resumeListening();
    const id = nextId++;
    const ctx = context();
    setEntries((l) => [...l, { id, who: "me", text }]);
    sayIt(text, "auto", "", ctx, undefined, "conversation", (full) => patch(id, { data: full }))
      .then((data) => {
        patch(id, { data });
        return speak(data.natural.it);
      })
      .catch((e: Error) => patch(id, { error: e.message }))
      .finally(resumeListening);
  }

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, listener.interim, myInterim]);

  return (
    <div className="tab live">
      <section className="intro">
        <h1>
          وضع المحادثة
          <span className="intro-sub">سيبه يسمع الإيطالي ويترجملك على طول. ولما ييجي دورك، اتكلم بالعربي وهو يقولك تردّ إزاي.</span>
        </h1>
      </section>

      <button
        className={`listen-toggle glass ${listener.active ? "on" : ""}`}
        onClick={() => (listener.active ? listener.stop() : listener.start())}
        disabled={!speechSupported}
      >
        <span className="eq" aria-hidden>
          <i /><i /><i /><i />
        </span>
        <span className="lt-text">
          <b>{listener.active ? "بسمع الإيطالي…" : "ابدأ السماع"}</b>
          <small>{listener.active ? "دوس عشان توقف" : "حط التليفون قريب من اللي بيتكلم"}</small>
        </span>
        {listener.active ? <IconStop size={20} /> : <IconEar size={22} />}
      </button>
      {listener.error === "denied" && <div className="error">لازم تسمح للتطبيق يستخدم المايك.</div>}
      {!speechSupported && <div className="error">المتصفح ده مش بيدعم السماع. استخدم Chrome على أندرويد أو الكمبيوتر، أو Safari على الآيفون.</div>}

      <div className="thread">
        {entries.length === 0 && !listener.interim && (
          <div className="empty glass">
            <Emblem>
              <IconBubbles size={30} />
            </Emblem>
            <div className="lang-pair" dir="ltr">
              <span>Italiano</span>
              <i />
              <span>العربية</span>
            </div>
            <p>الكلام اللي هتسمعه هيظهر هنا بالإيطالي ومعاه معناه بالمصري. دوسة طويلة على أي كلمة تشرحهالك.</p>
          </div>
        )}
        {entries.map((e) =>
          e.who === "them" ? (
            <div className="bubble them glass" key={e.id}>
              <ItalianText text={e.data?.it_clean ?? e.text} onWord={onWord} className="bubble-it" />
              {e.data ? (
                <>
                  <div className="bubble-ar">{e.data.ar}</div>
                  {e.data.idioms.map((i) => (
                    <div className="idiom" key={i.it}>
                      <b className="it" dir="ltr">{i.it}</b> — {i.ar}
                    </div>
                  ))}
                  {e.data.reply_ideas.length > 0 && (
                    <div className="replies">
                      <span className="muted small">ممكن ترد بـ:</span>
                      {e.data.reply_ideas.map((r) => (
                        <button key={r.it} className="reply" onClick={() => speak(r.it)}>
                          <span className="it" dir="ltr">{r.it}</span>
                          <span className="muted small">{r.ar}</span>
                          <IconPlay size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : e.error ? (
                <div className="error small">{e.error}</div>
              ) : (
                <div className="typing"><i /><i /><i /></div>
              )}
            </div>
          ) : (
            <div className="bubble me" key={e.id}>
              <div className="bubble-said">{e.data?.understood_ar ?? e.text}</div>
              {e.data ? (
                <SayResult r={e.data} onWord={onWord} onShow={onShow} compact />
              ) : e.error ? (
                <div className="error small">{e.error}</div>
              ) : (
                <div className="typing"><i /><i /><i /></div>
              )}
            </div>
          ),
        )}
        {listener.interim && <div className="bubble them ghost it" dir="ltr">{listener.interim}</div>}
        {myInterim && <div className="bubble me ghost">{myInterim}</div>}
        <div ref={bottom} />
      </div>

      <div className="my-turn glass">
        {speechSupported ? (
          <>
            <MicButton
              lang="ar-EG"
              size="md"
              onText={onMine}
              onInterim={setMyInterim}
              onPress={onMyMic}
            />
            <div className="my-turn-text">
              <b>دورك</b>
              <small>اتكلم بالعربي، وأنا أقولك تقولها إزاي بالإيطالي</small>
            </div>
          </>
        ) : (
          <form
            className="type-row"
            onSubmit={(e) => {
              e.preventDefault();
              onMine(draft);
              setDraft("");
            }}
          >
            <input dir="rtl" placeholder="اكتب اللي عايز تقوله بالعربي" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="icon-btn primary" type="submit" aria-label="ابعت">
              <IconSend size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
