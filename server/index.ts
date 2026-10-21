import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import { HEARD_SYSTEM, SAY_IT_SYSTEM, WORD_SYSTEM } from "./prompts.ts";
import { HeardSchema, SayItSchema, WordSchema } from "./schemas.ts";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const PORT = Number(process.env.PORT ?? 8787);

// The SDK also reads `ant auth login` profiles from disk; this is only used to explain failures.
const hasCredentials = Boolean(
  process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE,
);
const client = new Anthropic();
const app = express();
app.use(express.json({ limit: "64kb" }));

type Effort = "low" | "medium" | "high";

class RefusedError extends Error {}
class BadInput extends Error {}

async function ask<S extends z.ZodType>(schema: S, system: string, user: string, effort: Effort): Promise<z.infer<S>> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // The system prompt is identical across requests, so it caches.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort, format: betaZodOutputFormat(schema) },
  });
  if (response.stop_reason === "refusal") throw new RefusedError("refused");
  if (!response.parsed_output) throw new Error(`no structured output (stop_reason=${response.stop_reason})`);
  return response.parsed_output;
}

function str(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function context(lines: unknown): string {
  if (!Array.isArray(lines) || lines.length === 0) return "";
  const recent = lines.slice(-6).map((l) => `- ${str(l, 400)}`).join("\n");
  return `\n\nRecent conversation (most recent last):\n${recent}`;
}

const REGISTER: Record<string, string> = {
  auto: "Pick the register that fits the situation.",
  casual: "They are talking with friends / peers: casual, use tu.",
  polite: "They are talking to someone they should be polite with: use Lei.",
};

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

app.post(
  "/api/say",
  handle(async (body) => {
    const text = str(body.text);
    if (!text) throw new BadInput("text is required");
    const register = REGISTER[str(body.register)] ?? REGISTER.auto;
    const situation = str(body.situation, 300);
    const prompt =
      `What I want to say (Egyptian Arabic):\n${text}\n\n${register}` +
      (situation ? `\nSituation: ${situation}` : "") +
      context(body.context);
    return ask(SayItSchema, SAY_IT_SYSTEM, prompt, "medium");
  }),
);

app.post(
  "/api/heard",
  handle(async (body) => {
    const text = str(body.text);
    if (!text) throw new BadInput("text is required");
    return ask(HeardSchema, HEARD_SYSTEM, `Heard (Italian):\n${text}${context(body.context)}`, "low");
  }),
);

app.post(
  "/api/word",
  handle(async (body) => {
    const word = str(body.word, 80);
    if (!word) throw new BadInput("word is required");
    const sentence = str(body.sentence, 600);
    return ask(WordSchema, WORD_SYSTEM, `Word: ${word}\nSentence: ${sentence || word}`, "low");
  }),
);

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
