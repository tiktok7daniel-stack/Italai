import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (Chrome/Edge/Safari expose it, Firefox doesn't).
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function createRecognition(): Recognition | null {
  const w = window as unknown as Record<string, new () => Recognition>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export const speechSupported = typeof window !== "undefined" && createRecognition() !== null;

export type Lang = "ar-EG" | "it-IT";

/**
 * Speech recognizer.
 * - `once` mode: start()/stop() a single utterance (hold-to-talk); onFinal fires once with the whole text on stop.
 * - `stream` mode: keeps listening (restarts after silence) and fires onFinal for every finished sentence.
 */
export function useRecognizer(lang: Lang, mode: "once" | "stream", onFinal: (text: string) => void) {
  const [active, setActive] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const buffer = useRef("");
  const interimRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const flushOnce = useCallback(() => {
    const text = (buffer.current + " " + interimRef.current).trim();
    buffer.current = "";
    interimRef.current = "";
    setInterim("");
    if (text) onFinalRef.current(text);
  }, []);

  const start = useCallback(() => {
    if (wanted.current) return;
    const r = createRecognition();
    if (!r) {
      setError("unsupported");
      return;
    }
    setError("");
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0].transcript;
        if (res.isFinal) {
          if (mode === "stream") {
            if (t.trim()) onFinalRef.current(t.trim());
          } else {
            buffer.current += " " + t;
          }
        } else {
          live += t;
        }
      }
      interimRef.current = live;
      setInterim(mode === "once" ? (buffer.current + " " + live).trim() : live);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wanted.current = false;
        setError("denied");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(e.error);
      }
    };
    r.onend = () => {
      if (rec.current !== r) return; // a newer session already replaced this one
      // Browsers end recognition after silence; keep streaming while the user wants it.
      if (wanted.current && mode === "stream") {
        try {
          r.start();
          return;
        } catch {
          /* fall through */
        }
      }
      wanted.current = false;
      rec.current = null;
      setActive(false);
      if (mode === "once") flushOnce();
      else setInterim("");
    };
    rec.current = r;
    wanted.current = true;
    buffer.current = "";
    interimRef.current = "";
    try {
      r.start();
      setActive(true);
    } catch {
      wanted.current = false;
    }
  }, [lang, mode, flushOnce]);

  const stop = useCallback(() => {
    wanted.current = false;
    rec.current?.stop();
  }, []);

  useEffect(
    () => () => {
      wanted.current = false;
      rec.current?.abort();
    },
    [],
  );

  return { active, interim, error, start, stop };
}
