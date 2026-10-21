import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "./speech.ts";

// Android's recognizer is a single shared service that stops after every pause, and the plugin
// reports neither "final" results nor errors as events. So each hook polls `isListening()`,
// treats a stop as the end of an utterance (after a short grace period for the last result),
// and restarts while the user still wants to listen.

const POLL_MS = 300;
const START_GRACE_MS = 1000;
const FINAL_GRACE_MS = 700;

interface Owner {
  onPartial(text: string): void;
  preempt(): void;
}

let owner: Owner | null = null;
let listening: Promise<unknown> | null = null;

function ensureListener() {
  listening ??= SpeechRecognition.addListener("partialResults", (d) => {
    const text = d.matches?.[0];
    if (text) owner?.onPartial(text);
  });
  return listening;
}

async function prepare(): Promise<"" | "denied" | "unsupported"> {
  try {
    const { available } = await SpeechRecognition.available();
    if (!available) return "unsupported";
    let { speechRecognition } = await SpeechRecognition.checkPermissions();
    if (speechRecognition !== "granted") ({ speechRecognition } = await SpeechRecognition.requestPermissions());
    if (speechRecognition !== "granted") return "denied";
    await ensureListener();
    return "";
  } catch {
    return "unsupported";
  }
}

export function useNativeRecognizer(lang: Lang, mode: "once" | "stream", onFinal: (text: string) => void) {
  const [active, setActive] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const s = useRef({
    running: false,
    wanted: false,
    buffer: "", // finished utterances (once mode)
    latest: "", // current utterance
    startedAt: 0,
    endedAt: 0,
    poll: 0,
    me: null as Owner | null,
  }).current;

  const showInterim = useCallback(() => {
    setInterim(mode === "once" ? `${s.buffer} ${s.latest}`.trim() : s.latest);
  }, [mode, s]);

  const commitUtterance = useCallback(() => {
    const text = s.latest.trim();
    s.latest = "";
    if (!text) return;
    if (mode === "stream") onFinalRef.current(text);
    else s.buffer += ` ${text}`;
  }, [mode, s]);

  const finish = useCallback(() => {
    window.clearInterval(s.poll);
    s.running = false;
    s.wanted = false;
    if (owner === s.me) owner = null;
    setActive(false);
    setInterim("");
    if (mode === "once") {
      const text = s.buffer.trim();
      s.buffer = "";
      if (text) onFinalRef.current(text);
    }
  }, [mode, s]);

  const listen = useCallback(() => {
    s.startedAt = Date.now();
    s.endedAt = 0;
    SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 }).catch(() => {
      /* failures surface as "not listening" in the poll */
    });
  }, [lang, s]);

  const tick = useCallback(async () => {
    if (owner !== s.me) return;
    const { listening: on } = await SpeechRecognition.isListening().catch(() => ({ listening: false }));
    const now = Date.now();
    if (on) {
      s.endedAt = 0;
      return;
    }
    if (s.wanted && now - s.startedAt < START_GRACE_MS) return;
    if (!s.endedAt) {
      s.endedAt = now;
      return;
    }
    if (now - s.endedAt < FINAL_GRACE_MS) return;
    commitUtterance();
    showInterim();
    if (s.wanted) listen();
    else finish();
  }, [s, commitUtterance, showInterim, listen, finish]);

  const start = useCallback(async () => {
    if (s.running) return;
    s.running = true;
    const problem = await prepare();
    if (problem) {
      s.running = false;
      setError(problem);
      return;
    }
    setError("");
    owner?.preempt(); // only one recognizer at a time
    s.me = {
      onPartial: (text) => {
        s.latest = text;
        s.endedAt = 0;
        showInterim();
      },
      preempt: () => {
        s.wanted = false;
        commitUtterance();
        finish();
      },
    };
    owner = s.me;
    s.wanted = true;
    s.buffer = "";
    s.latest = "";
    setActive(true);
    s.poll = window.setInterval(tick, POLL_MS);
    listen();
  }, [s, showInterim, commitUtterance, finish, tick, listen]);

  const stop = useCallback(() => {
    if (!s.running || !s.wanted) return;
    s.wanted = false;
    s.startedAt = 0;
    // The plugin never resolves stop() on Android; the poll picks up the end.
    void SpeechRecognition.stop().catch(() => {});
  }, [s]);

  useEffect(
    () => () => {
      window.clearInterval(s.poll);
      if (owner === s.me) {
        owner = null;
        void SpeechRecognition.stop().catch(() => {});
      }
    },
    [s],
  );

  return { active, interim, error, start, stop };
}
