import { useState } from "react";
import { createPortal } from "react-dom";
import { useLanguagePacks } from "../lib/google.ts";
import { modelById, useModelStatus } from "../lib/local/brain.ts";
import { isNative, updateSettings, useSettings, type Engine } from "../lib/settings.ts";
import { IconCheck, IconChevron, IconClose, IconGlobe, IconSpark } from "./Icons.tsx";

const ENGINES: { id: Engine; name: string; short: string; what: string; icon: React.ReactNode }[] = [
  {
    id: "local",
    name: "ذكاء اصطناعي على الموبايل",
    short: "ذكاء اصطناعي",
    what: "بيقولك الطلاينة بيقولوها إزاي، ويشرح القاعدة. من غير نت.",
    icon: <IconSpark size={18} />,
  },
  {
    id: "google",
    name: "جوجل ترانزليت",
    short: "جوجل",
    what: "ترجمة سريعة زي جوجل، عربي ⇄ إيطالي. من غير نت.",
    icon: <IconGlobe size={18} />,
  },
  {
    id: "claude",
    name: "Claude",
    short: "Claude",
    what: "أدق حاجة في طريقة الطلاينة والشرح. محتاج نت ومفتاح.",
    icon: <IconSpark size={18} />,
  },
];

/** Header pill to switch between the on-device AI, Google Translate and Claude at any time. */
export function EnginePicker({ onSetup }: { onSetup: () => void }) {
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const local = useModelStatus(modelById(settings.localModel));
  const packs = useLanguagePacks();
  if (!isNative) return null;

  const ready: Record<Engine, boolean> = {
    local: local.status?.state === "ready",
    google: packs.ar && packs.it,
    claude: Boolean(settings.apiKey),
  };
  const current = ENGINES.find((e) => e.id === settings.engine) ?? ENGINES[0];

  return (
    <>
      <button className="engine-pill glass" onClick={() => setOpen(true)} aria-label="اختار طريقة الترجمة">
        {current.icon}
        <span>{current.short}</span>
        <IconChevron size={14} />
      </button>
      {open &&
        createPortal(
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet glass engine-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="اختار">
            <div className="sheet-grip" />
            <div className="sheet-head">
              <div className="sheet-title">تترجم بإيه؟</div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="اقفل">
                <IconClose size={20} />
              </button>
            </div>
            <div className="sheet-body">
              {ENGINES.map((e) => (
                <button
                  key={e.id}
                  className={`engine-card ${settings.engine === e.id ? "active" : ""}`}
                  onClick={() => {
                    updateSettings({ engine: e.id });
                    setOpen(false);
                    local.refresh();
                    packs.refresh();
                    if (!ready[e.id]) onSetup();
                  }}
                >
                  <span className="engine-icon">{e.icon}</span>
                  <span className="engine-text">
                    <b>{e.name}</b>
                    <span className="muted small">{e.what}</span>
                    {!ready[e.id] && <span className="warn small">محتاج تجهيز مرة واحدة من الإعدادات</span>}
                  </span>
                  {settings.engine === e.id && <IconCheck size={18} />}
                </button>
              ))}
              <p className="muted small">السجل وتصريف الكلمات شغالين مع الكل.</p>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
