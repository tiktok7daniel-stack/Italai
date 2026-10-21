import { useEffect, useState } from "react";
import { testKey } from "../lib/api.ts";
import { isNative, updateSettings, useSettings } from "../lib/settings.ts";
import { speak } from "../lib/tts.ts";
import { IconCheck, IconClose, IconPlay } from "./Icons.tsx";

const MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", hint: "الأذكى (الافتراضي)" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "أسرع وأرخص" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", hint: "الأسرع والأرخص" },
];

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const [key, setKey] = useState(settings.apiKey);
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<"" | "testing" | "ok" | string>("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveKey() {
    const trimmed = key.trim();
    setStatus("testing");
    const problem = await testKey(trimmed);
    if (problem) {
      setStatus(problem);
      return;
    }
    updateSettings({ apiKey: trimmed });
    setStatus("ok");
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="الإعدادات">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="sheet-title">الإعدادات</div>
          <button className="icon-btn" onClick={onClose} aria-label="اقفل">
            <IconClose size={20} />
          </button>
        </div>

        <div className="sheet-body">
          <section className="block">
            <h4>مفتاح Claude API</h4>
            <p className="muted small">
              ده اللي بيخلي التطبيق يفهم ويترجم. بيتحفظ على موبايلك بس، وبيتبعت لـ Anthropic وبس.
            </p>
            <div className="key-row">
              <input
                dir="ltr"
                type={reveal ? "text" : "password"}
                placeholder="sk-ant-..."
                value={key}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setKey(e.target.value);
                  setStatus("");
                }}
              />
              <button className="link small" onClick={() => setReveal(!reveal)}>
                {reveal ? "إخفاء" : "إظهار"}
              </button>
            </div>
            <button className="btn primary wide" disabled={!key.trim() || status === "testing"} onClick={saveKey}>
              {status === "testing" ? "بجرّب المفتاح…" : status === "ok" ? <><IconCheck size={18} /> اتحفظ وشغال</> : "احفظ وجرّب"}
            </button>
            {status && status !== "testing" && status !== "ok" && <div className="error small">{status}</div>}
            {settings.apiKey && status !== "ok" && <div className="muted small">في مفتاح محفوظ ✓</div>}

            <details className="howto">
              <summary>أجيب المفتاح منين؟</summary>
              <ol>
                <li>
                  افتح <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a> واعمل حساب.
                </li>
                <li>من Billing اشحن رصيد صغير (الاستخدام بالجملة، مش اشتراك شهري).</li>
                <li>من API Keys دوس Create Key، انسخه وحطه هنا.</li>
              </ol>
            </details>
          </section>

          <section className="block">
            <h4>الموديل</h4>
            <div className="model-list">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  className={`model ${settings.model === m.id ? "active" : ""}`}
                  onClick={() => updateSettings({ model: m.id })}
                >
                  <b dir="ltr">{m.label}</b>
                  <span className="muted small">{m.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="block">
            <h4>سرعة الصوت الإيطالي</h4>
            <div className="rate-row">
              <input
                type="range"
                min={0.6}
                max={1.3}
                step={0.05}
                value={settings.rate}
                onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
              />
              <span className="pill" dir="ltr">{settings.rate.toFixed(2)}×</span>
              <button className="icon-btn sm" onClick={() => speak("Ciao! Come stai? Tutto bene?")} aria-label="جرّب">
                <IconPlay size={16} />
              </button>
            </div>
          </section>

          {!isNative && (
            <p className="muted small">
              في نسخة الويب ممكن تسيب المفتاح فاضي لو السيرفر عنده ANTHROPIC_API_KEY.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
