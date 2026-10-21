// Optional web server: serves the built app and proxies Claude with a server-side key.
// The Android app doesn't need it (it calls Claude directly with the key saved on the phone).
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ask, BadInput, DEFAULT_MODEL, heardRequest, RefusedError, sayRequest, wordRequest } from "../shared/dillo.ts";

const MODEL = process.env.CLAUDE_MODEL ?? DEFAULT_MODEL;
const PORT = Number(process.env.PORT ?? 8787);

// The SDK also reads `ant auth login` profiles from disk; this is only used to explain failures.
const hasCredentials = Boolean(
  process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE,
);
const client = new Anthropic();
const app = express();
app.use(express.json({ limit: "64kb" }));

function handle(fn: (body: Record<string, unknown>) => Promise<unknown>): express.RequestHandler {
  return async (req, res) => {
    try {
      res.json(await fn(req.body ?? {}));
    } catch (error) {
      if (error instanceof BadInput) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof RefusedError) {
        res.status(422).json({ error: "refused" });
      } else if (error instanceof Anthropic.AuthenticationError) {
        res.status(500).json({ error: "missing_key" });
      } else if (error instanceof Anthropic.RateLimitError) {
        res.status(429).json({ error: "rate_limited" });
      } else if (error instanceof Anthropic.APIError) {
        console.error("Claude API error", error.status, error.message);
        res.status(502).json({ error: "upstream" });
      } else {
        console.error(error);
        res.status(500).json({ error: hasCredentials ? "internal" : "missing_key" });
      }
    }
  };
}

app.post("/api/say", handle((body) => ask(client, MODEL, sayRequest(body as never))));
app.post("/api/heard", handle((body) => ask(client, MODEL, heardRequest(body as never))));
app.post("/api/word", handle((body) => ask(client, MODEL, wordRequest(body as never))));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Dillo API on http://localhost:${PORT} (model ${MODEL})`);
  if (!hasCredentials) console.warn("ANTHROPIC_API_KEY is not set: requests will fail unless an `ant auth login` profile exists.");
});
