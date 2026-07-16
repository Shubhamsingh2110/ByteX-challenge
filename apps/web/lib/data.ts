import "server-only";
import {
  summarize,
  detectAnomalies,
  forecastMonthEnd,
  buildSankey,
  type Transaction,
  type Summary,
  type Anomaly,
  type Forecast,
  type SankeyData,
} from "@repo/core";
import { listTransactions } from "@repo/db";

export interface LedgerData {
  transactions: Transaction[];
  summary: Summary;
  anomalies: Anomaly[];
  forecast: Forecast;
  sankey: SankeyData;
  /** Set when the DB is unreachable/misconfigured so the UI can degrade gracefully. */
  error?: string;
}

const EMPTY: Omit<LedgerData, "error"> = {
  transactions: [],
  summary: {
    incomeCents: 0,
    expenseCents: 0,
    netCents: 0,
    transactionCount: 0,
    savingsRate: 0,
    byCategory: [],
  },
  anomalies: [],
  forecast: {
    daysElapsed: 0,
    daysInMonth: 0,
    expenseSoFarCents: 0,
    projectedExpenseCents: 0,
    incomeSoFarCents: 0,
    projectedNetCents: 0,
  },
  sankey: { nodes: [], links: [] },
};

/**
 * Loads all ledger data and derives every insight in one pass. If the database
 * is unreachable we return empty data plus a human-readable error instead of
 * throwing, so the page still renders with a helpful banner.
 */
export async function getLedgerData(): Promise<LedgerData> {
  try {
    const transactions = await listTransactions();
    const anomalies = detectAnomalies(transactions);
    return {
      transactions,
      summary: summarize(transactions),
      anomalies,
      forecast: forecastMonthEnd(transactions, new Date()),
      sankey: buildSankey(transactions),
    };
  } catch (err) {
    return {
      ...EMPTY,
      error:
        err instanceof Error
          ? err.message
          : "Could not load transactions. Check your MongoDB connection.",
    };
  }
}
