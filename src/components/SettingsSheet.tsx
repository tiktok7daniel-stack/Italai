import { useEffect, useState } from "react";
import { testKey } from "../lib/api.ts";
import {
  cancelDownload,
  deviceInfo,
  downloadModel,
  ensureLoaded,
  generate,
  MODELS,
  removeModel,
  useModelStatus,
  type LocalModel,
} from "../lib/local/brain.ts";
import { isNative, updateSettings, useSettings } from "../lib/settings.ts";
import { speak } from "../lib/tts.ts";
import { IconCheck, IconClose, IconPlay, IconTrash } from "./Icons.tsx";

const CLAUDE_MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", hint: "الأذكى (الافتراضي)" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "أسرع وأرخص" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", hint: "الأسرع والأرخص" },
];

// Decimal GB, the way phones and Hugging Face show sizes.
const GB = 1e9;
const gb = (bytes: number) => (bytes / GB).toFixed(1);

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const settings = useSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          {isNative && (
            <section className="block">
              <h4>المخ اللي بيترجم</h4>
              <div className="seg glass">
                <button className={settings.engine === "local" ? "active" : ""} onClick={() => updateSettings({ engine: "local" })}>
                  على الموبايل · من غير نت
                </button>
                <button className={settings.engine === "claude" ? "active" : ""} onClick={() => updateSettings({ engine: "claude" })}>
                  Claude · أدق
                </button>
              </div>
              <p className="muted small">
                {settings.engine === "local"
                  ? "ذكاء اصطناعي شغال جوه موبايلك: ببلاش، من غير نت، ومن غير مفتاح. أبطأ شوية وأقل دقة من Claude."
                  : "أدق في طريقة الطلاينة والشرح، بس محتاج نت ومفتاح Claude API."}
              </p>
            </section>
          )}

          {isNative && settings.engine === "local" && <LocalModels />}
          {(!isNative || settings.engine === "claude") && <ClaudeSettings />}

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
        </div>
      </div>
    </div>
  );
}

function LocalModels() {
  const settings = useSettings();
  const [device, setDevice] = useState<{ totalRam: number; freeStorage: number } | null>(null);
  const [mobileData, setMobileData] = useState(false);

  useEffect(() => {
    deviceInfo().then(setDevice).catch(() => {});
  }, []);

  return (
    <section className="block">
      <h4>الموديل اللي على الموبايل</h4>
      {device && (
        <p className="muted small">
          موبايلك: رام {gb(device.totalRam)} جيجا · مساحة فاضية {gb(device.freeStorage)} جيجا
        </p>
      )}
      <div className="model-list">
        {MODELS.map((m) => (
          <ModelCard
            key={m.id}
            model={m}
            active={settings.localModel === m.id}
            ramGb={device ? device.totalRam / GB : null}
            freeBytes={device?.freeStorage ?? null}
            mobileData={mobileData}
            onSelect={() => updateSettings({ localModel: m.id })}
          />
        ))}
      </div>
      <label className="check-row">
        <input type="checkbox" checked={mobileData} onChange={(e) => setMobileData(e.target.checked)} />
        <span>نزّل ببيانات الموبايل كمان (مش واي فاي بس)</span>
      </label>
      <p className="muted small">
        الموديل بيتنزّل مرة واحدة من Hugging Face (من Google)، وبعدها كل حاجة بتشتغل على موبايلك من غير نت.
      </p>
    </section>
  );
}

function ModelCard({
  model,
  active,
  ramGb,
  freeBytes,
  mobileData,
  onSelect,
}: {
  model: LocalModel;
  active: boolean;
  ramGb: number | null;
  freeBytes: number | null;
  mobileData: boolean;
  onSelect: () => void;
}) {
  const { status, refresh } = useModelStatus(model);
  const [busy, setBusy] = useState("");
  const [test, setTest] = useState("");
  const [testReply, setTestReply] = useState("");
  // Phones report a bit less than their nominal RAM (8 GB shows as ~7.4).
  const lowRam = ramGb !== null && ramGb < model.minRamGb - 1;
  const noSpace = freeBytes !== null && freeBytes < model.size * 1.05 && status?.state !== "ready";
  const state = status?.state ?? "absent";
  const pct = status && status.total > 0 ? Math.min(100, Math.round((status.bytes / status.total) * 100)) : 0;

  async function start() {
    setBusy("start");
    await downloadModel(model, mobileData).catch(() => {});
    setBusy("");
    refresh();
  }

  async function tryIt() {
    setTest("بحمّل الموديل في الذاكرة… (أول مرة بتاخد شوية)");
    setTestReply("");
    const t0 = performance.now();
    try {
      const backend = await ensureLoaded(model);
      const t1 = performance.now();
      const reply = await generate("Reply in one short Italian sentence.", "Saluta un amico egiziano.", { maxTokens: 40 });
      const t2 = performance.now();
      setTest(
        `شغال على ${backend === "GPU" ? "كارت الشاشة (GPU)" : "المعالج (CPU)"} · التحميل ${((t1 - t0) / 1000).toFixed(1)} ث · الرد ${((t2 - t1) / 1000).toFixed(1)} ث`,
      );
      setTestReply(reply.trim());
    } catch (e) {
      setTest(`مقدرش يشتغل: ${(e as Error).message}`);
    }
  }

  return (
    <div className={`model local ${active ? "active" : ""}`}>
      <button className="model-main" onClick={onSelect} disabled={state !== "ready"}>
        <span className={`radio ${active && state === "ready" ? "on" : ""}`} />
        <span className="model-text">
          <b dir="ltr">{model.label}</b>
          <span className="muted small">
            {model.hint} · {gb(model.size)} جيجا · محتاج رام {model.minRamGb} جيجا
          </span>
        </span>
      </button>

      {lowRam && state !== "ready" && <div className="warn small">رام موبايلك أقل من المطلوب للموديل ده، غالباً هيبقى بطيء أو مش هيشتغل.</div>}
      {noSpace && <div className="warn small">المساحة الفاضية مش كفاية.</div>}

      {state === "ready" ? (
        <div className="model-actions">
          <span className="ok small">
            <IconCheck size={14} /> متنزّل
          </span>
          <button className="btn small-btn" onClick={tryIt}>جرّبه</button>
          <button
            className="icon-btn sm ghost"
            aria-label="امسح"
            onClick={async () => {
              setBusy("remove");
              await removeModel(model).catch(() => {});
              setBusy("");
              refresh();
            }}
          >
            <IconTrash size={16} />
          </button>
        </div>
      ) : state === "downloading" || state === "waiting" ? (
        <div className="download">
          <div className="progress">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="download-row small">
            <span className="muted">
              {state === "waiting" ? "مستني واي فاي أو الشبكة…" : `${pct}% · ${gb(status?.bytes ?? 0)} من ${gb(status?.total || model.size)} جيجا`}
            </span>
            <button
              className="link small"
              onClick={async () => {
                await cancelDownload(model).catch(() => {});
                refresh();
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="model-actions">
          {state === "failed" && <span className="warn small">التنزيل وقف. جرّب تاني.</span>}
          <button className="btn primary small-btn" disabled={busy !== "" || noSpace} onClick={start}>
            نزّل ({gb(model.size)} جيجا)
          </button>
        </div>
      )}
      {test && (
        <div className="test-out small">
          {test}
          {testReply && (
            <div className="it test-reply" dir="ltr">
              {testReply}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClaudeSettings() {
  const settings = useSettings();
  const [key, setKey] = useState(settings.apiKey);
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<"" | "testing" | "ok" | string>("");

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
    <>
      <section className="block">
        <h4>مفتاح Claude API</h4>
        <p className="muted small">بيتحفظ على موبايلك بس، وبيتبعت لـ Anthropic وبس.</p>
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
        {settings.apiKey && status !== "ok" && <div className="muted small">في مفتاح محفوظ على الجهاز</div>}

        <details className="howto">
          <summary>أجيب المفتاح منين؟</summary>
          <ol>
            <li>
              افتح <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">platform.claude.com</a> بنفس إيميل اشتراكك.
            </li>
            <li>لو معاك Max: اربط الحساب بخطتك وهتاخد رصيد API شهري. لو Pro: اشحن رصيد صغير من Billing.</li>
            <li>من API Keys دوس Create Key، انسخه وحطه هنا.</li>
          </ol>
        </details>
        {!isNative && <p className="muted small">في نسخة الويب ممكن تسيب المفتاح فاضي لو السيرفر عنده ANTHROPIC_API_KEY.</p>}
      </section>

      <section className="block">
        <h4>موديل Claude</h4>
        <div className="model-list">
          {CLAUDE_MODELS.map((m) => (
            <button key={m.id} className={`model ${settings.model === m.id ? "active" : ""}`} onClick={() => updateSettings({ model: m.id })}>
              <b dir="ltr">{m.label}</b>
              <span className="muted small">{m.hint}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
