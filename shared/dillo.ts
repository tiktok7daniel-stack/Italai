// Builds and runs the three Claude requests the app makes. Used by both the Android app
// (direct calls with the user's own key) and the optional web server (key kept server-side).
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { HEARD_SYSTEM, SAY_IT_SYSTEM, WORD_SYSTEM } from "./prompts.ts";
import { HeardSchema, SayItSchema, WordSchema } from "./schemas.ts";

export const DEFAULT_MODEL = "claude-opus-5-5";

export type Register = "auto" | "casual" | "polite";

export interface SayInput {
  text: string;
  register?: Register;
  situation?: string;
  context?: string[];
}
export interface HeardInput {
  text: string;
  context?: string[];
}
export interface WordInput {
  word: string;
  sentence?: string;
}

export class RefusedError extends Error {}
export class BadInput extends Error {}

type Effort = "low" | "medium" | "high";

interface Request<S extends z.ZodType> {
  schema: S;
  system: string;
  user: string;
  effort: Effort;
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

export function sayRequest(input: SayInput): Request<typeof SayItSchema> {
  const text = str(input.text);
  if (!text) throw new BadInput("text is required");
  const register = REGISTER[str(input.register)] ?? REGISTER.auto;
  const situation = str(input.situation, 300);
  const user =
    `What I want to say (Egyptian Arabic):\n${text}\n\n${register}` +
    (situation ? `\nSituation: ${situation}` : "") +
    context(input.context);
  return { schema: SayItSchema, system: SAY_IT_SYSTEM, user, effort: "medium" };
}

export function heardRequest(input: HeardInput): Request<typeof HeardSchema> {
  const text = str(input.text);
  if (!text) throw new BadInput("text is required");
  return { schema: HeardSchema, system: HEARD_SYSTEM, user: `Heard (Italian):\n${text}${context(input.context)}`, effort: "low" };
}

export function wordRequest(input: WordInput): Request<typeof WordSchema> {
  const word = str(input.word, 80);
  if (!word) throw new BadInput("word is required");
  const sentence = str(input.sentence, 600);
  return { schema: WordSchema, system: WORD_SYSTEM, user: `Word: ${word}\nSentence: ${sentence || word}`, effort: "low" };
}

export async function ask<S extends z.ZodType>(client: Anthropic, model: string, req: Request<S>): Promise<z.infer<S>> {
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // The system prompt is identical across requests, so it caches.
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: req.user }],
    output_config: { effort: req.effort, format: betaZodOutputFormat(req.schema) },
  });
  if (response.stop_reason === "refusal") throw new RefusedError("refused");
  if (!response.parsed_output) throw new Error(`no structured output (stop_reason=${response.stop_reason})`);
  return response.parsed_output;
}
