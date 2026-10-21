import { useCallback, useState } from "react";
import { IconBook, IconChat, IconGear, IconSpark } from "./components/Icons.tsx";
import { LiveTab } from "./components/LiveTab.tsx";
import { NotebookTab } from "./components/NotebookTab.tsx";
import { SayTab } from "./components/SayTab.tsx";
import { SettingsSheet } from "./components/SettingsSheet.tsx";
import { ShowMode } from "./components/ShowMode.tsx";
import { WordSheet } from "./components/WordSheet.tsx";
import { dueItems, useNotebook } from "./lib/notebook.ts";
import { modelById, useModelStatus } from "./lib/local/brain.ts";
import { isNative, needsKey, useSettings } from "./lib/settings.ts";
import { load, save } from "./lib/storage.ts";

type Tab = "say" | "live" | "book";

export function App() {
  const [tab, setTab] = useState<Tab>("say");
  const [word, setWord] = useState<{ word: string; sentence: string } | null>(null);
  const [show, setShow] = useState("");
  const settings = useSettings();
  const missingKey = needsKey(settings);
  const local = useModelStatus(modelById(settings.localModel));
  const missingModel = isNative && settings.engine === "local" && local.status !== null && local.status.state !== "ready";
  // First launch of the app: open the settings to set up the model.
  const [settingsOpen, setSettingsOpen] = useState(() => isNative && !load("dillo.onboarded", false));
  const due = dueItems(useNotebook()).length;

  const onWord = useCallback((w: string, sentence: string) => setWord({ word: w, sentence }), []);
  const closeWord = useCallback(() => setWord(null), []);
  const closeShow = useCallback(() => setShow(""), []);
  const closeSettings = useCallback(() => {
    save("dillo.onboarded", true);
    setSettingsOpen(false);
    local.refresh();
  }, [local]);

  return (
    <div className="app">
      <div className="bg" aria-hidden>
        <i className="b1" />
        <i className="b2" />
        <i className="b3" />
      </div>

      <header className="top">
        <div className="brand">
          <img src="/logo.svg" alt="" width={36} height={36} />
          <div>
            <b>Dillo</b>
            <small>قولها زي الطلاينة</small>
          </div>
        </div>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="الإعدادات">
          <IconGear size={20} />
        </button>
      </header>
      {missingKey && (
        <button className="setup-banner glass" onClick={() => setSettingsOpen(true)}>
          <b>خطوة واحدة وتبدأ</b>
          <span>حط مفتاح Claude API عشان التطبيق يشتغل ←</span>
        </button>
      )}
      {missingModel && (
        <button className="setup-banner glass" onClick={() => setSettingsOpen(true)}>
          <b>{local.status?.state === "downloading" ? "الموديل بيتنزّل…" : "نزّل المخ على موبايلك"}</b>
          <span>
            {local.status?.state === "downloading"
              ? "تقدر تستخدم الجمل الجاهزة لحد ما يخلص ←"
              : "مرة واحدة بس، وبعدها يشتغل من غير نت ←"}
          </span>
        </button>
      )}

      <main>
        {/* Tabs stay mounted so a running conversation isn't lost when you peek at the notebook. */}
        <div hidden={tab !== "say"}>
          <SayTab onWord={onWord} onShow={setShow} />
        </div>
        <div hidden={tab !== "live"}>
          <LiveTab onWord={onWord} onShow={setShow} />
        </div>
        <div hidden={tab !== "book"}>
          <NotebookTab onWord={onWord} />
        </div>
      </main>

      <nav className="dock glass" aria-label="التنقل">
        <DockItem active={tab === "say"} onClick={() => setTab("say")} icon={<IconSpark size={22} />} label="قولها" />
        <DockItem active={tab === "live"} onClick={() => setTab("live")} icon={<IconChat size={22} />} label="محادثة" />
        <DockItem active={tab === "book"} onClick={() => setTab("book")} icon={<IconBook size={22} />} label="كشكولي" badge={due} />
      </nav>

      {word && <WordSheet word={word.word} sentence={word.sentence} onClose={closeWord} />}
      {show && <ShowMode text={show} onClose={closeShow} />}
      {settingsOpen && <SettingsSheet onClose={closeSettings} />}
    </div>
  );
}

function DockItem({
  active,
  onClick,
  icon,
  label,
  badge = 0,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button className={`dock-item ${active ? "active" : ""}`} onClick={onClick} aria-current={active}>
      {icon}
      <span>{label}</span>
      {badge > 0 && <em className="badge">{badge}</em>}
    </button>
  );
}
