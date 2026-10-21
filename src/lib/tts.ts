let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith("it"));
  // Prefer the higher quality network/"natural" voices when the platform has them.
  voice =
    voices.find((v) => /natural|neural|premium|enhanced|google/i.test(v.name)) ?? voices[0] ?? null;
}

if (typeof speechSynthesis !== "undefined") {
  pickVoice();
  speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
}

/** Speaks Italian; resolves when finished (or immediately if TTS is unavailable). */
export function speak(text: string, rate = 1): Promise<void> {
  if (typeof speechSynthesis === "undefined" || !text) return Promise.resolve();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "it-IT";
  if (voice) u.voice = voice;
  u.rate = rate;
  return new Promise((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}
