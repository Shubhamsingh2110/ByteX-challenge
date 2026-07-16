import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
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

// Sparse + unique: only documents that HAVE a key are constrained, so many
// docs without a key coexist while retries with the same key can't duplicate.
transactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true },
);
// Common query path: newest transactions first.
transactionSchema.index({ occurredAt: -1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;

// Guard against Next.js hot-reload re-registering the model (OverwriteModelError).
export const TransactionModel: Model<TransactionDoc> =
  (mongoose.models.Transaction as Model<TransactionDoc>) ??
  mongoose.model<TransactionDoc>("Transaction", transactionSchema);

/** Map a Mongoose document to the framework-free domain shape used everywhere. */
export function toDomain(doc: mongoose.HydratedDocument<TransactionDoc>): Transaction {
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
