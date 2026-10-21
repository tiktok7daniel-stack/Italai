import { useEffect, useRef } from "react";
import { useRecognizer, type Lang } from "../lib/speech.ts";
import { IconMic, IconStop } from "./Icons.tsx";

const HOLD_MS = 350;

const ERRORS: Record<string, string> = {
  unsupported: "المتصفح ده مش بيدعم التعرف على الصوت. جرب Chrome أو اكتب بإيدك.",
  denied: "لازم تسمح للتطبيق يستخدم المايك.",
};

/**
 * Hold to talk (release sends), or tap once to start and tap again to send.
 */
export function MicButton({
  lang,
  onText,
  size = "lg",
  hint,
  onInterim,
  onActiveChange,
}: {
  lang: Lang;
  onText: (text: string) => void;
  size?: "lg" | "md";
  hint?: string;
  onInterim?: (text: string) => void;
  onActiveChange?: (active: boolean) => void;
}) {
  const { active, interim, error, start, stop } = useRecognizer(lang, "once", onText);
  const pressedAt = useRef(0);
  const wasActive = useRef(false);
  const onInterimRef = useRef(onInterim);
  onInterimRef.current = onInterim;
  useEffect(() => onInterimRef.current?.(interim), [interim]);
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;
  useEffect(() => onActiveRef.current?.(active), [active]);

  return (
    <div className={`mic-wrap ${size}`}>
      <button
        className={`mic ${active ? "live" : ""}`}
        aria-label={active ? "وقف" : "اتكلم"}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          wasActive.current = active;
          pressedAt.current = Date.now();
          if (!active) start();
        }}
        onPointerUp={() => {
          const held = Date.now() - pressedAt.current > HOLD_MS;
          if (wasActive.current || held) stop();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="mic-ring" />
        <span className="mic-ring r2" />
        {active ? <IconStop size={size === "lg" ? 30 : 22} /> : <IconMic size={size === "lg" ? 34 : 24} />}
      </button>
      {hint && <div className="mic-hint">{active ? "بسمعك… سيب أو دوس تاني لما تخلص" : hint}</div>}
      {error && <div className="error small">{ERRORS[error] ?? "المايك وقف، جرب تاني."}</div>}
    </div>
  );
}
