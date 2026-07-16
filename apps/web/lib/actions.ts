"use server";

import { revalidatePath } from "next/cache";
import { createTransactionSchema, type Transaction } from "@repo/core";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@repo/db";
import { parseTransaction, type ParsedTransaction } from "@repo/ai";
import type { ActionResult, RawTransactionInput } from "./types";

function toFieldErrors(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    (map[key] ??= []).push(issue.message);
  }
  return map;
}

/** Translate any thrown error into a friendly, non-leaky message. */
function friendlyDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("MONGODB_URI")) {
    return "Database isn't configured. Add MONGODB_URI to your .env file.";
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|server selection/i.test(msg)) {
    return "Couldn't reach the database. Check your connection and try again.";
  }
  return "Something went wrong saving your transaction. Please try again.";
}

export async function createTransactionAction(
  input: RawTransactionInput,
): Promise<ActionResult<Transaction>> {
  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  try {
    const data = await createTransaction(parsed.data);
    revalidatePath("/");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: friendlyDbError(err) };
  }
}

export async function updateTransactionAction(
  id: string,
  input: RawTransactionInput,
): Promise<ActionResult<Transaction>> {
  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  try {
    const data = await updateTransaction(id, parsed.data);
    if (!data) {
      return { ok: false, error: "That transaction no longer exists." };
    }
    revalidatePath("/");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: friendlyDbError(err) };
  }
}

/**
 * Parse a natural-language note into a suggested transaction via Claude.
 * Returns a suggestion the user reviews before saving — never auto-persisted.
 */
export async function parseQuickAddAction(
  text: string,
): Promise<ActionResult<ParsedTransaction>> {
  const result = await parseTransaction(text, new Date());
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, error: result.reason };
}

export async function deleteTransactionAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const deleted = await deleteTransaction(id);
    if (!deleted) {
      return { ok: false, error: "That transaction no longer exists." };
    }
    revalidatePath("/");
    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: friendlyDbError(err) };
  }
}
