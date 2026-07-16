import { z } from "zod";
import { MAX_AMOUNT_CENTS, toCents } from "./money";

export type TransactionType = "income" | "expense";

export interface Category {
  id: string;
  label: string;
  type: TransactionType;
  color: string;
  icon: string;
}

/** Fixed category taxonomy. Colors are used consistently across UI + charts. */
export const CATEGORIES = [
  // Income
  { id: "salary", label: "Salary", type: "income", color: "#22c55e", icon: "💼" },
  { id: "freelance", label: "Freelance", type: "income", color: "#10b981", icon: "🧑‍💻" },
  { id: "investment", label: "Investment", type: "income", color: "#14b8a6", icon: "📈" },
  { id: "gift", label: "Gift", type: "income", color: "#84cc16", icon: "🎁" },
  { id: "other-income", label: "Other Income", type: "income", color: "#4ade80", icon: "➕" },
  // Expense
  { id: "groceries", label: "Groceries", type: "expense", color: "#f97316", icon: "🛒" },
  { id: "dining", label: "Dining", type: "expense", color: "#ef4444", icon: "🍽️" },
  { id: "transport", label: "Transport", type: "expense", color: "#3b82f6", icon: "🚗" },
  { id: "housing", label: "Housing", type: "expense", color: "#8b5cf6", icon: "🏠" },
  { id: "utilities", label: "Utilities", type: "expense", color: "#06b6d4", icon: "💡" },
  { id: "entertainment", label: "Entertainment", type: "expense", color: "#ec4899", icon: "🎬" },
  { id: "health", label: "Health", type: "expense", color: "#f43f5e", icon: "🏥" },
  { id: "shopping", label: "Shopping", type: "expense", color: "#a855f7", icon: "🛍️" },
  { id: "subscriptions", label: "Subscriptions", type: "expense", color: "#6366f1", icon: "🔁" },
  { id: "other-expense", label: "Other Expense", type: "expense", color: "#94a3b8", icon: "➖" },
] as const satisfies readonly Category[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

const CATEGORY_BY_ID = new Map<string, Category>(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): Category | undefined {
  return CATEGORY_BY_ID.get(id);
}

export const incomeCategories = CATEGORIES.filter((c) => c.type === "income");
export const expenseCategories = CATEGORIES.filter((c) => c.type === "expense");

/**
 * Input schema for creating a transaction. Accepts an `amount` as either a
 * human string or number and normalizes it to integer cents. Validates that
 * the chosen category actually matches the transaction type.
 */
export const createTransactionSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    amount: z
      .union([z.string(), z.number()])
      .transform((value, ctx) => {
        try {
          return toCents(value);
        } catch (err) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: err instanceof Error ? err.message : "Invalid amount",
          });
          return z.NEVER;
        }
      })
      .refine((cents) => cents > 0, "Amount must be greater than zero")
      .refine((cents) => cents <= MAX_AMOUNT_CENTS, "Amount is too large"),
    categoryId: z.enum(CATEGORY_IDS),
    description: z.string().trim().max(200, "Keep it under 200 characters").default(""),
    // Accept date strings/Date; default to now. Reject dates far in the future.
    occurredAt: z.coerce
      .date()
      .default(() => new Date())
      .refine(
        (d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000,
        "Date can't be in the future",
      ),
    // Idempotency key prevents duplicate rows from double-submits / retries.
    idempotencyKey: z.string().min(8).max(100).optional(),
  })
  .refine((data) => getCategory(data.categoryId)?.type === data.type, {
    message: "Category doesn't match the selected type",
    path: ["categoryId"],
  });

/** The normalized shape after validation (amount is integer cents). */
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/** A persisted transaction as consumed by the UI + insights layer. */
export interface Transaction {
  id: string;
  type: TransactionType;
  amountCents: number;
  categoryId: CategoryId;
  description: string;
  occurredAt: string; // ISO 8601
  createdAt: string; // ISO 8601
}
