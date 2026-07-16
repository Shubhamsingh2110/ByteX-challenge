import type { FilterQuery } from "mongoose";
import type { CategoryId, CreateTransactionInput, Transaction, TransactionType } from "@repo/core";
import { getConnection } from "./connection";
import { getTransactionModel, toDomain, type TransactionDoc } from "./models";

export interface ListFilter {
  type?: TransactionType;
  categoryId?: CategoryId;
  from?: Date;
  to?: Date;
  limit?: number;
}

async function model() {
  const conn = await getConnection();
  return getTransactionModel(conn);
}

/**
 * Create a transaction. If an idempotency key is supplied, a retried submit
 * with the same key returns the original row instead of inserting a duplicate —
 * even under a race, because the unique index rejects the second insert and we
 * fall back to reading the winner.
 */
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  const Transaction = await model();

  if (input.idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return toDomain(existing);
  }

  try {
    const doc = await Transaction.create({
      type: input.type,
      amountCents: input.amount, // already normalized to integer cents by Zod
      categoryId: input.categoryId,
      description: input.description,
      occurredAt: input.occurredAt,
      idempotencyKey: input.idempotencyKey,
    });
    return toDomain(doc);
  } catch (err) {
    if (isDuplicateKeyError(err) && input.idempotencyKey) {
      const winner = await Transaction.findOne({ idempotencyKey: input.idempotencyKey });
      if (winner) return toDomain(winner);
    }
    throw err;
  }
}

export async function listTransactions(filter: ListFilter = {}): Promise<Transaction[]> {
  const Transaction = await model();

  const query: FilterQuery<TransactionDoc> = {};
  if (filter.type) query.type = filter.type;
  if (filter.categoryId) query.categoryId = filter.categoryId;
  if (filter.from || filter.to) {
    query.occurredAt = {};
    if (filter.from) query.occurredAt.$gte = filter.from;
    if (filter.to) query.occurredAt.$lte = filter.to;
  }

  const docs = await Transaction.find(query)
    .sort({ occurredAt: -1, createdAt: -1 })
    .limit(filter.limit ?? 500);

  return docs.map(toDomain);
}

export async function deleteTransaction(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  const Transaction = await model();
  const res = await Transaction.deleteOne({ _id: id });
  return res.deletedCount === 1;
}

export async function updateTransaction(
  id: string,
  input: CreateTransactionInput,
): Promise<Transaction | null> {
  if (!isValidObjectId(id)) return null;
  const Transaction = await model();

  const doc = await Transaction.findByIdAndUpdate(
    id,
    {
      type: input.type,
      amountCents: input.amount,
      categoryId: input.categoryId,
      description: input.description,
      occurredAt: input.occurredAt,
    },
    { new: true, runValidators: true },
  );

  return doc ? toDomain(doc) : null;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}
