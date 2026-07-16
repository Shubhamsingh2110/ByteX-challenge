/**
 * Seeds the ledger with a realistic month of demo transactions so the
 * dashboard, insights, and Sankey chart have something to show out of the box.
 *
 * Run from the repo root:  pnpm --filter @repo/db seed
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { toCents, type CategoryId, type TransactionType } from "@repo/core";

// Load secrets from the repo-root .env regardless of where the script runs.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

const { getConnection } = await import("./connection");
const { getTransactionModel } = await import("./models");

interface SeedRow {
  type: TransactionType;
  amount: string;
  categoryId: CategoryId;
  description: string;
  daysAgo: number;
}

const ROWS: SeedRow[] = [
  { type: "income", amount: "85000", categoryId: "salary", description: "Monthly salary", daysAgo: 28 },
  { type: "income", amount: "14500", categoryId: "freelance", description: "Logo design gig", daysAgo: 20 },
  { type: "income", amount: "2150.50", categoryId: "investment", description: "Dividend payout", daysAgo: 12 },

  { type: "expense", amount: "22000", categoryId: "housing", description: "Rent", daysAgo: 27 },
  { type: "expense", amount: "1899", categoryId: "utilities", description: "Electricity", daysAgo: 25 },
  { type: "expense", amount: "799", categoryId: "utilities", description: "Broadband", daysAgo: 25 },

  // Groceries: a stable baseline plus one clear anomaly (the "N× your usual" story).
  { type: "expense", amount: "1240", categoryId: "groceries", description: "Weekly shop", daysAgo: 24 },
  { type: "expense", amount: "1185", categoryId: "groceries", description: "Weekly shop", daysAgo: 17 },
  { type: "expense", amount: "1320", categoryId: "groceries", description: "Weekly shop", daysAgo: 10 },
  { type: "expense", amount: "1105", categoryId: "groceries", description: "Weekly shop", daysAgo: 3 },
  { type: "expense", amount: "5480", categoryId: "groceries", description: "Big monthly stock-up", daysAgo: 8 },

  { type: "expense", amount: "320", categoryId: "dining", description: "Lunch", daysAgo: 22 },
  { type: "expense", amount: "1850", categoryId: "dining", description: "Dinner with friends", daysAgo: 15 },
  { type: "expense", amount: "180", categoryId: "dining", description: "Chai & snacks", daysAgo: 6 },

  { type: "expense", amount: "2400", categoryId: "transport", description: "Petrol", daysAgo: 19 },
  { type: "expense", amount: "120", categoryId: "transport", description: "Auto fare", daysAgo: 5 },

  { type: "expense", amount: "649", categoryId: "subscriptions", description: "Streaming", daysAgo: 14 },
  { type: "expense", amount: "119", categoryId: "subscriptions", description: "Music", daysAgo: 14 },
  { type: "expense", amount: "1500", categoryId: "health", description: "Dentist visit", daysAgo: 9 },
  { type: "expense", amount: "3299", categoryId: "shopping", description: "New running shoes", daysAgo: 4 },
  { type: "expense", amount: "1200", categoryId: "entertainment", description: "Concert tickets", daysAgo: 2 },
];

async function main() {
  const conn = await getConnection();
  const TransactionModel = getTransactionModel(conn);
  console.log("Connected to MongoDB Atlas ✓");

  const deleted = await TransactionModel.deleteMany({});
  console.log(`Cleared ${deleted.deletedCount} existing transactions`);

  const now = Date.now();
  const docs = ROWS.map((r) => ({
    type: r.type,
    amountCents: toCents(r.amount),
    categoryId: r.categoryId,
    description: r.description,
    occurredAt: new Date(now - r.daysAgo * 24 * 60 * 60 * 1000),
  }));

  const inserted = await TransactionModel.insertMany(docs);
  console.log(`Inserted ${inserted.length} demo transactions ✓`);

  await conn.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
