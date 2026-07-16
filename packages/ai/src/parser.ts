import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CATEGORIES, CATEGORY_IDS, getCategory, type CategoryId } from "@repo/core";

// Raw JSON Schema for structured outputs (kept in lock-step with ParsedSchema
// below). We hand-write it instead of using the SDK's zod helper so the whole
// workspace can stay on a single Zod major version.
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "understood",
    "type",
    "amount",
    "categoryId",
    "description",
    "occurredAt",
    "confidence",
  ],
  properties: {
    understood: { type: "boolean" },
    type: { type: "string", enum: ["income", "expense"] },
    amount: { type: "number" },
    categoryId: { type: "string", enum: [...CATEGORY_IDS] },
    description: { type: "string" },
    occurredAt: { type: "string" },
    confidence: { type: "number" },
  },
} as const;

/**
 * The structured shape we force Claude to return. Structured outputs guarantee
 * the response validates against this schema — but we STILL re-validate and
 * clamp below, because a schema-valid category can still be the wrong one and
 * a schema-valid amount can still be nonsense.
 */
const ParsedSchema = z.object({
  understood: z
    .boolean()
    .describe("true only if the text describes a real financial transaction"),
  type: z.enum(["income", "expense"]),
  amount: z.number().describe("Positive amount in whole currency units (dollars)"),
  categoryId: z.enum(CATEGORY_IDS),
  description: z.string().describe("Short human description, may be empty"),
  occurredAt: z
    .string()
    .describe('ISO 8601 date (YYYY-MM-DD) resolved from the text, or "" if unspecified'),
  confidence: z.number().describe("0..1 confidence that the parse is correct"),
});

export interface ParsedTransaction {
  type: "income" | "expense";
  amount: number;
  categoryId: CategoryId;
  description: string;
  occurredAt: string; // ISO datetime
  confidence: number;
}

export type ParseResult =
  | { ok: true; data: ParsedTransaction }
  | { ok: false; reason: string };

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

// Simple in-process cache. Keyed by (today + normalized input) so identical
// entries never hit the API twice, while "yesterday"-style relative dates still
// resolve correctly across day boundaries. This is the caching-trick USP: the
// naive approach (one API call per keystroke) is slow and costly; we dedupe.
const cache = new Map<string, ParseResult>();
const MAX_CACHE = 200;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your .env to use natural-language quick-add.",
    );
  }
  client ??= new Anthropic();
  return client;
}

function buildSystemPrompt(now: Date): string {
  const today = now.toISOString().slice(0, 10);
  const categoryLines = CATEGORIES.map(
    (c) => `- ${c.id} (${c.type}): ${c.label}`,
  ).join("\n");

  return `You convert a short natural-language note into a single personal-finance transaction.

Today's date is ${today}. Resolve relative dates ("yesterday", "last friday") against it and return an ISO date (YYYY-MM-DD). If no date is mentioned, return "" for occurredAt.

Choose exactly one category id from this list (match the type — income vs expense — to the category):
${categoryLines}

Rules:
- Infer income vs expense from context (salary/refund/paycheck = income; most spending = expense).
- amount is a positive number in Indian Rupees (e.g. 250 or 49.90), never negative, never with a currency symbol.
- If the note is not a transaction (a greeting, a question, gibberish), set understood=false and confidence=0.
- Set a realistic confidence between 0 and 1.`;
}

/**
 * Parse a natural-language note into a suggested transaction using Claude,
 * validated against our own category taxonomy and money rules. The result is a
 * SUGGESTION — the UI has the user confirm it before anything is persisted.
 */
export async function parseTransaction(
  input: string,
  now: Date = new Date(),
): Promise<ParseResult> {
  const normalized = input.trim();
  if (normalized.length < 2) {
    return { ok: false, reason: "Type a bit more so we can parse it." };
  }
  if (normalized.length > 200) {
    return { ok: false, reason: "That's too long to parse — keep it short." };
  }

  const cacheKey = `${now.toISOString().slice(0, 10)}::${normalized.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let result: ParseResult;
  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(now),
      messages: [{ role: "user", content: normalized }],
      output_config: { format: { type: "json_schema", schema: JSON_SCHEMA } },
    });

    // Structured outputs place the JSON in a text block; parse then re-validate.
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    result = validate(JSON.parse(text), now);
  } catch (err) {
    // Don't cache transient failures.
    return {
      ok: false,
      reason:
        err instanceof Error && err.message.includes("ANTHROPIC_API_KEY")
          ? err.message
          : "Couldn't reach the AI parser. Try again or enter it manually.",
    };
  }

  // Bound the cache.
  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(cacheKey, result);
  return result;
}

/**
 * Re-validate the model output against our own rules. Even with structured
 * outputs the model can (a) pick a category whose type contradicts `type`, or
 * (b) return a zero/negative amount — both schema-valid but wrong. We fix or
 * reject here rather than trusting the LLM.
 */
function validate(parsed: unknown, now: Date): ParseResult {
  const check = ParsedSchema.safeParse(parsed);
  if (!check.success) {
    return { ok: false, reason: "The AI response wasn't in the expected format." };
  }
  const p = check.data;

  if (!p.understood || p.confidence < 0.25) {
    return {
      ok: false,
      reason: "Couldn't confidently read a transaction from that. Try rephrasing.",
    };
  }

  if (!(p.amount > 0) || !Number.isFinite(p.amount)) {
    return { ok: false, reason: "Couldn't find a valid amount in that note." };
  }

  // Guard against a category whose type contradicts the inferred type: fall
  // back to the generic bucket for the correct type instead of trusting it.
  const category = getCategory(p.categoryId);
  let categoryId: CategoryId = p.categoryId;
  if (!category || category.type !== p.type) {
    categoryId = p.type === "income" ? "other-income" : "other-expense";
  }

  const occurredAt = resolveDate(p.occurredAt, now);

  return {
    ok: true,
    data: {
      type: p.type,
      amount: p.amount,
      categoryId,
      description: p.description.slice(0, 200),
      occurredAt,
      confidence: Math.max(0, Math.min(1, p.confidence)),
    },
  };
}

/** Accept the model's date only if it's sane and not in the future; else use now. */
function resolveDate(iso: string, now: Date): string {
  if (!iso) return now.toISOString();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return now.toISOString();
  if (d.getTime() > now.getTime() + 24 * 60 * 60 * 1000) return now.toISOString();
  return d.toISOString();
}
