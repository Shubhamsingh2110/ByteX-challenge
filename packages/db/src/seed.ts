/**
 * Seeds the ledger with a realistic month of demo transactions so the
 * dashboard, insights, and Sankey chart have something to show out of the box.
 *
 * Run from the repo root:  pnpm --filter @repo/db seed
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { toCents, type CategoryId, type TransactionType } from "@repo/core";

// Load secrets from the repo-root .env regardless of where the script runs.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

const { connectToDatabase } = await import("./connection");
const { TransactionModel } = await import("./models");

interface SeedRow {
  type: TransactionType;
  amount: string;
  categoryId: CategoryId;
  description: string;
  daysAgo: number;
}

const ROWS: SeedRow[] = [
  { type: "income", amount: "5200.00", categoryId: "salary", description: "Monthly salary", daysAgo: 28 },
  { type: "income", amount: "850.00", categoryId: "freelance", description: "Logo design gig", daysAgo: 20 },
  { type: "income", amount: "120.50", categoryId: "investment", description: "Dividend payout", daysAgo: 12 },

  { type: "expense", amount: "1450.00", categoryId: "housing", description: "Rent", daysAgo: 27 },
  { type: "expense", amount: "89.99", categoryId: "utilities", description: "Electricity", daysAgo: 25 },
  { type: "expense", amount: "60.00", categoryId: "utilities", description: "Internet", daysAgo: 25 },

  // Groceries: a stable baseline plus one clear anomaly (the "3x" story).
  { type: "expense", amount: "52.30", categoryId: "groceries", description: "Weekly shop", daysAgo: 24 },
  { type: "expense", amount: "48.75", categoryId: "groceries", description: "Weekly shop", daysAgo: 17 },
  { type: "expense", amount: "55.10", categoryId: "groceries", description: "Weekly shop", daysAgo: 10 },
  { type: "expense", amount: "51.40", categoryId: "groceries", description: "Weekly shop", daysAgo: 3 },
  { type: "expense", amount: "212.80", categoryId: "groceries", description: "Costco bulk run", daysAgo: 8 },

  { type: "expense", amount: "18.50", categoryId: "dining", description: "Lunch", daysAgo: 22 },
  { type: "expense", amount: "42.00", categoryId: "dining", description: "Dinner w/ friends", daysAgo: 15 },
  { type: "expense", amount: "9.75", categoryId: "dining", description: "Coffee & pastry", daysAgo: 6 },

  { type: "expense", amount: "35.00", categoryId: "transport", description: "Gas", daysAgo: 19 },
  { type: "expense", amount: "2.75", categoryId: "transport", description: "Metro fare", daysAgo: 5 },

  { type: "expense", amount: "15.99", categoryId: "subscriptions", description: "Streaming", daysAgo: 14 },
  { type: "expense", amount: "11.99", categoryId: "subscriptions", description: "Music", daysAgo: 14 },
  { type: "expense", amount: "120.00", categoryId: "health", description: "Dentist copay", daysAgo: 9 },
  { type: "expense", amount: "64.20", categoryId: "shopping", description: "New running shoes", daysAgo: 4 },
  { type: "expense", amount: "27.99", categoryId: "entertainment", description: "Concert tickets", daysAgo: 2 },
];

async function main() {
  await connectToDatabase();
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

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
