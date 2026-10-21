import { useRef } from "react";
import { speak } from "../lib/tts.ts";

const LONG_PRESS_MS = 420;

/**
 * Italian text where every word is interactive:
 * tap = hear the word, long-press = open the full word explanation.
 */
export function ItalianText({
  text,
  onWord,
  className = "",
}: {
  text: string;
  onWord: (word: string, sentence: string) => void;
  className?: string;
}) {
  // Keep apostrophes inside words (l'amico, c'è) and split everything else.
  const parts = text.split(/([\p{L}\p{M}’']+)/u);
  return (
    <span className={`it ${className}`} lang="it" dir="ltr">
      {parts.map((p, i) =>
        /\p{L}/u.test(p) ? (
          <Word key={i} word={p} onLong={() => onWord(p.replace(/^[’']+|[’']+$/g, ""), text)} />
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

function Word({ word, onLong }: { word: string; onLong: () => void }) {
  const timer = useRef<number>(0);
  const fired = useRef(false);
  const origin = useRef({ x: 0, y: 0 });

  const cancel = () => window.clearTimeout(timer.current);

  return (
    <span
      className="w"
      role="button"
      tabIndex={0}
      onPointerDown={(e) => {
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        const el = e.currentTarget;
        el.classList.add("pressing");
        timer.current = window.setTimeout(() => {
          fired.current = true;
          el.classList.remove("pressing");
          navigator.vibrate?.(12);
          onLong();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        // Scrolling, not pressing.
        if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 10) {
          cancel();
          e.currentTarget.classList.remove("pressing");
        }
      }}
      onPointerUp={(e) => {
        cancel();
        e.currentTarget.classList.remove("pressing");
        if (!fired.current) speak(word, 0.9);
      }}
      onPointerLeave={(e) => {
        cancel();
        e.currentTarget.classList.remove("pressing");
      }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter") onLong();
      }}
    >
      {word}
    </span>
  );
}
