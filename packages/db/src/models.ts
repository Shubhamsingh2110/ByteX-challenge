import { Schema, type Connection, type InferSchemaType, type Model } from "mongoose";
import { CATEGORY_IDS, type Transaction } from "@repo/core";

const transactionSchema = new Schema(
  {
    type: { type: String, enum: ["income", "expense"], required: true },
    // Money is stored as a positive integer number of cents. `type` carries the sign.
    amountCents: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "amountCents must be an integer number of cents",
      },
    },
    categoryId: { type: String, enum: CATEGORY_IDS, required: true },
    description: { type: String, default: "", maxlength: 200, trim: true },
    occurredAt: { type: Date, required: true },
    // Optional idempotency key: a unique sparse index dedupes retried submits.
    idempotencyKey: { type: String, required: false },
  },
  { timestamps: true },
);

// Sparse + unique: only documents that HAVE a key are constrained.
transactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
transactionSchema.index({ occurredAt: -1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
export type HydratedTransaction = ReturnType<Model<TransactionDoc>["hydrate"]>;

/**
 * Return the Transaction model bound to a SPECIFIC connection. Binding to the
 * connection we actually awaited (rather than mongoose's global default) is what
 * prevents the "buffering timed out" failure under Next's bundler.
 */
export function getTransactionModel(conn: Connection): Model<TransactionDoc> {
  return (
    (conn.models.Transaction as Model<TransactionDoc>) ??
    conn.model<TransactionDoc>("Transaction", transactionSchema)
  );
}

/** Map a Mongoose document to the framework-free domain shape used everywhere. */
export function toDomain(doc: HydratedTransaction): Transaction {
  return {
    id: doc._id.toString(),
    type: doc.type as Transaction["type"],
    amountCents: doc.amountCents,
    categoryId: doc.categoryId as Transaction["categoryId"],
    description: doc.description ?? "",
    occurredAt: doc.occurredAt.toISOString(),
    createdAt: (doc.createdAt ?? doc.occurredAt).toISOString(),
  };
}
