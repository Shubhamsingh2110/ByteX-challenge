import { getCategory, type CategoryId, type Transaction } from "./schema";
import { sumCents } from "./money";

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface CategorySummary {
  categoryId: CategoryId;
  label: string;
  color: string;
  icon: string;
  totalCents: number;
  count: number;
}

export interface Summary {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  transactionCount: number;
  savingsRate: number; // 0..1, share of income kept
  byCategory: CategorySummary[]; // sorted by totalCents desc
}

export function summarize(transactions: Transaction[]): Summary {
  const income = transactions.filter((t) => t.type === "income");
  const expense = transactions.filter((t) => t.type === "expense");

  const incomeCents = sumCents(income.map((t) => t.amountCents));
  const expenseCents = sumCents(expense.map((t) => t.amountCents));

  const totals = new Map<CategoryId, { total: number; count: number }>();
  for (const t of transactions) {
    const entry = totals.get(t.categoryId) ?? { total: 0, count: 0 };
    entry.total += t.amountCents;
    entry.count += 1;
    totals.set(t.categoryId, entry);
  }

  const byCategory: CategorySummary[] = [...totals.entries()]
    .map(([categoryId, { total, count }]) => {
      const cat = getCategory(categoryId);
      return {
        categoryId,
        label: cat?.label ?? categoryId,
        color: cat?.color ?? "#94a3b8",
        icon: cat?.icon ?? "•",
        totalCents: total,
        count,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    transactionCount: transactions.length,
    savingsRate: incomeCents > 0 ? (incomeCents - expenseCents) / incomeCents : 0,
    byCategory,
  };
}

// ---------------------------------------------------------------------------
// Anomaly detection (the "clever edge-case" USP)
// ---------------------------------------------------------------------------

export interface Anomaly {
  transactionId: string;
  categoryId: CategoryId;
  amountCents: number;
  medianCents: number;
  ratio: number; // amount / median
  message: string;
}

/**
 * Flags expenses that are outliers within their own category.
 *
 * We compare each amount against the category MEDIAN rather than mean+stddev.
 * A single large outlier inflates the mean and the standard deviation enough to
 * exceed its own `mean + 2·stddev` threshold (the "masking effect"), so the
 * naive z-score test silently misses the very thing it's meant to catch. The
 * median is robust to that, and "N× your usual spend" is the natural framing.
 */
const MIN_SAMPLES = 4;
const ANOMALY_RATIO = 2.0;

export function detectAnomalies(transactions: Transaction[]): Anomaly[] {
  const byCategory = new Map<CategoryId, Transaction[]>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const list = byCategory.get(t.categoryId) ?? [];
    list.push(t);
    byCategory.set(t.categoryId, list);
  }

  const anomalies: Anomaly[] = [];

  for (const [categoryId, list] of byCategory) {
    if (list.length < MIN_SAMPLES) continue;

    const median = medianOf(list.map((t) => t.amountCents));
    if (median <= 0) continue;

    for (const t of list) {
      const ratio = t.amountCents / median;
      if (ratio >= ANOMALY_RATIO) {
        anomalies.push({
          transactionId: t.id,
          categoryId,
          amountCents: t.amountCents,
          medianCents: Math.round(median),
          ratio,
          message: `${ratio.toFixed(1)}× your usual ${
            getCategory(categoryId)?.label ?? categoryId
          } spend`,
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.ratio - a.ratio);
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

// ---------------------------------------------------------------------------
// Month-end forecast
// ---------------------------------------------------------------------------

export interface Forecast {
  daysElapsed: number;
  daysInMonth: number;
  expenseSoFarCents: number;
  projectedExpenseCents: number;
  incomeSoFarCents: number;
  projectedNetCents: number;
}

/**
 * Projects end-of-month net position by extrapolating the current month's
 * expense run-rate across the full month. `now` is injected for testability.
 */
export function forecastMonthEnd(transactions: Transaction[], now: Date): Forecast {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = now.getDate();

  const thisMonth = transactions.filter((t) => {
    const d = new Date(t.occurredAt);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const expenseSoFarCents = sumCents(
    thisMonth.filter((t) => t.type === "expense").map((t) => t.amountCents),
  );
  const incomeSoFarCents = sumCents(
    thisMonth.filter((t) => t.type === "income").map((t) => t.amountCents),
  );

  const dailyRate = daysElapsed > 0 ? expenseSoFarCents / daysElapsed : 0;
  const projectedExpenseCents = Math.round(dailyRate * daysInMonth);

  return {
    daysElapsed,
    daysInMonth,
    expenseSoFarCents,
    projectedExpenseCents,
    incomeSoFarCents,
    projectedNetCents: incomeSoFarCents - projectedExpenseCents,
  };
}

// ---------------------------------------------------------------------------
// Sankey money-flow (the signature visualization USP)
// ---------------------------------------------------------------------------

export interface SankeyNode {
  name: string;
  color: string;
  kind: "income" | "hub" | "expense" | "savings";
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number; // cents
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

const HUB_COLOR = "#64748b";
const SAVINGS_COLOR = "#22c55e";
const DEFICIT_COLOR = "#ef4444";

/**
 * Builds a Sankey graph: income categories → a central "Available" hub →
 * expense categories, with leftover flowing to "Savings" (or a "Deficit" node
 * drawn from savings when spending exceeds income).
 */
export function buildSankey(transactions: Transaction[]): SankeyData {
  const income = aggregate(transactions, "income");
  const expense = aggregate(transactions, "expense");

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  const totalIncome = sumCents([...income.values()]);
  const totalExpense = sumCents([...expense.values()]);

  if (totalIncome === 0 && totalExpense === 0) {
    return { nodes, links };
  }

  const hubIndex = pushNode(nodes, { name: "Available", color: HUB_COLOR, kind: "hub" });

  for (const [categoryId, cents] of income) {
    const cat = getCategory(categoryId);
    const idx = pushNode(nodes, {
      name: cat?.label ?? categoryId,
      color: cat?.color ?? HUB_COLOR,
      kind: "income",
    });
    links.push({ source: idx, target: hubIndex, value: cents });
  }

  for (const [categoryId, cents] of expense) {
    const cat = getCategory(categoryId);
    const idx = pushNode(nodes, {
      name: cat?.label ?? categoryId,
      color: cat?.color ?? HUB_COLOR,
      kind: "expense",
    });
    links.push({ source: hubIndex, target: idx, value: cents });
  }

  const net = totalIncome - totalExpense;
  if (net > 0) {
    const idx = pushNode(nodes, { name: "Savings", color: SAVINGS_COLOR, kind: "savings" });
    links.push({ source: hubIndex, target: idx, value: net });
  } else if (net < 0) {
    // Spending exceeded income: draw the shortfall into the hub as a Deficit source.
    const idx = pushNode(nodes, { name: "Deficit", color: DEFICIT_COLOR, kind: "income" });
    links.push({ source: idx, target: hubIndex, value: -net });
  }

  return { nodes, links };
}

function aggregate(
  transactions: Transaction[],
  type: "income" | "expense",
): Map<CategoryId, number> {
  const map = new Map<CategoryId, number>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amountCents);
  }
  return map;
}

function pushNode(nodes: SankeyNode[], node: SankeyNode): number {
  nodes.push(node);
  return nodes.length - 1;
}
