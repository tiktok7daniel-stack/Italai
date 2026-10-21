import { useEffect, useState } from "react";
import { lookupWord, type Progress, type WordInfo } from "../lib/api.ts";
import { getSettings } from "../lib/settings.ts";
import { addItem, hasItem, useNotebook } from "../lib/notebook.ts";
import { speak } from "../lib/tts.ts";
import { IconBookmark, IconBulb, IconClose, IconPlay } from "./Icons.tsx";

const GENDER: Record<string, string> = { m: "مذكر", f: "مؤنث", both: "مذكر ومؤنث" };

export function WordSheet({ word, sentence, onClose }: { word: string; sentence: string; onClose: () => void }) {
  const [info, setInfo] = useState<WordInfo | null>(null);
  const [error, setError] = useState("");
  const [tense, setTense] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  useNotebook();

  useEffect(() => {
    let live = true;
    setInfo(null);
    setError("");
    setProgress(null);
    lookupWord(word, sentence, setProgress)
      .then((i) => {
        if (!live) return;
        setInfo(i);
        const here = i.verb.tenses.findIndex((t) => t.name_it.toLowerCase() === i.verb.tense_here.toLowerCase());
        setTense(Math.max(0, here));
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [word, sentence]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saved = info ? hasItem(info.lemma || info.word) : false;
  const t = info?.verb.tenses[tense];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={word}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div>
            <div className="sheet-word it" dir="ltr">{word}</div>
            {info && (
              <div className="sheet-sub">
                <span className="pill">{info.pos_ar}</span>
                {info.lemma && info.lemma.toLowerCase() !== word.toLowerCase() && (
                  <span className="muted">
                    من <b className="it" dir="ltr">{info.lemma}</b>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="row gap-s">
            <button className="icon-btn" onClick={() => speak(word, 0.85)} aria-label="اسمع">
              <IconPlay size={20} />
            </button>
            {info && (
              <button
                className={`icon-btn ${saved ? "on" : ""}`}
                aria-label="احفظ"
                onClick={() =>
                  addItem({
                    kind: "word",
                    it: info.lemma || info.word,
                    ar: info.meanings_ar.join("، "),
                    pron_ar: info.pron_ar,
                    note: info.how_formed_ar,
                  })
                }
              >
                <IconBookmark size={20} filled={saved} />
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="اقفل">
              <IconClose size={20} />
            </button>
          </div>
        </div>

        <div className="sheet-body">
          {error && <div className="error">{error}</div>}
          {!info && !error && (
            <>
              {progress?.stage === "loading" && <div className="muted small">بحمّل الموديل في الذاكرة… (أول مرة بس)</div>}
              <Skeleton />
            </>
          )}
          {info && (
            <>
              <section className="meaning-hero">
                {info.meaning_here_ar && <div className="meaning-here">{info.meaning_here_ar}</div>}
                <div className="muted small">
                  النطق: <b>{info.pron_ar}</b> {info.ipa && <span dir="ltr" className="ipa">/{info.ipa}/</span>}
                </div>
                {info.meanings_ar.length > 1 && (
                  <div className="chips">
                    {info.meanings_ar.map((m) => (
                      <span key={m} className="chip">{m}</span>
                    ))}
                  </div>
                )}
              </section>

              {info.how_formed_ar && (
                <Block title="الكلمة دي جت إزاي؟">
                  <p className="pre-line">{info.how_formed_ar}</p>
                </Block>
              )}

              {info.verb.tenses.length > 0 && t && (
                <Block title={`تصريف ${info.verb.infinitive}`}>
                  <div className="verb-meta">
                    <span className="pill">{info.verb.group_ar}</span>
                    {info.verb.auxiliary && (
                      <span className="pill">
                        المساعد: <b className="it">{info.verb.auxiliary}</b>
                      </span>
                    )}
                    {info.verb.past_participle && (
                      <span className="pill">
                        اسم المفعول: <b className="it">{info.verb.past_participle}</b>
                      </span>
                    )}
                    {info.verb.gerund && (
                      <span className="pill">
                        Gerundio: <b className="it">{info.verb.gerund}</b>
                      </span>
                    )}
                  </div>
                  <div className="tense-tabs" dir="ltr">
                    {info.verb.tenses.map((x, i) => (
                      <button
                        key={x.name_it}
                        className={`tense-tab ${i === tense ? "active" : ""} ${
                          x.name_it.toLowerCase() === info.verb.tense_here.toLowerCase() ? "here" : ""
                        }`}
                        onClick={() => setTense(i)}
                      >
                        {x.name_it}
                      </button>
                    ))}
                  </div>
                  <div className="tense-card">
                    <div className="tense-name">
                      {t.name_ar}
                      <span className="muted small"> · {t.when_ar}</span>
                    </div>
                    <div className="conj" dir="ltr">
                      {t.forms.map((f) => {
                        const here =
                          t.name_it.toLowerCase() === info.verb.tense_here.toLowerCase() &&
                          f.person === info.verb.person_here;
                        return (
                          <button key={f.person} className={`conj-row ${here ? "here" : ""}`} onClick={() => speak(f.form === "-" ? "" : f.form)}>
                            <span className="conj-p">{f.person}</span>
                            <span className="conj-f it">{f.form}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Block>
              )}

              {(info.noun_info.plural || info.noun_info.gender) && (
                <Block title="المفرد والجمع">
                  <div className="verb-meta">
                    {GENDER[info.noun_info.gender] && <span className="pill">{GENDER[info.noun_info.gender]}</span>}
                    {info.noun_info.singular && <span className="pill">مفرد: <b className="it">{info.noun_info.singular}</b></span>}
                    {info.noun_info.plural && <span className="pill">جمع: <b className="it">{info.noun_info.plural}</b></span>}
                    {info.noun_info.feminine && <span className="pill">مؤنث: <b className="it">{info.noun_info.feminine}</b></span>}
                  </div>
                </Block>
              )}

              {info.origin_ar && (
                <Block title="أصل الكلمة">
                  <p>{info.origin_ar}</p>
                </Block>
              )}

              {info.examples.length > 0 && (
                <Block title={getSettings().engine === "google" ? "جمل قلتها قبل كده فيها الكلمة دي" : "أمثلة من الحياة"}>
                  {info.examples.map((ex) => (
                    <button className="example" key={ex.it} onClick={() => speak(ex.it)}>
                      <span className="it" dir="ltr">{ex.it}</span>
                      <span className="muted">{ex.ar}</span>
                    </button>
                  ))}
                </Block>
              )}

              {info.family.length > 0 && (
                <Block title="كلمات من نفس العيلة">
                  <div className="chips">
                    {info.family.map((f) => (
                      <span key={f.it} className="chip">
                        <b className="it" dir="ltr">{f.it}</b> · {f.ar}
                      </span>
                    ))}
                  </div>
                </Block>
              )}

              {info.memory_tip_ar && (
                <div className="tip">
                  <IconBulb size={18} /> {info.memory_tip_ar}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="block">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="skeleton">
      <div className="sk w60" />
      <div className="sk w40" />
      <div className="sk w90" />
      <div className="sk w80" />
      <div className="sk w70" />
    </div>
  );
}
