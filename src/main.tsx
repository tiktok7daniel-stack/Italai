import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ablautWasm from "@v4nn4/ablaut/ablaut_bg.wasm?url";
import { App } from "./App.tsx";
import { analyzeVerb } from "./lib/italian/analyze.ts";
import { initInflect } from "./lib/italian/inflect.ts";
import "./styles.css";

// Load the conjugation engine, then build the verb-form index while the app is idle,
// so the first tap on a word is instant.
initInflect(() => fetch(ablautWasm).then((r) => r.arrayBuffer())).then(() => {
  const warm = () => analyzeVerb("parlo");
  if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 4000 });
  else setTimeout(warm, 1500);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
