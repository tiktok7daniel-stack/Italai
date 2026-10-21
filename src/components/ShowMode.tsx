import { useEffect } from "react";
import { speak } from "../lib/tts.ts";
import { IconClose, IconPlay } from "./Icons.tsx";

/** Full-screen card to turn the phone around and show the sentence to the Italian you're talking to. */
export function ShowMode({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="show-mode" onClick={onClose}>
      <div className="show-text it" lang="it" dir="ltr">{text}</div>
      <div className="show-actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn primary" onClick={() => speak(text)}>
          <IconPlay size={18} /> شغّل الصوت
        </button>
        <button className="icon-btn" onClick={onClose} aria-label="اقفل">
          <IconClose size={20} />
        </button>
      </div>
    </div>
  );
}
