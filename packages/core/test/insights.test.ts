import { describe, it, expect } from "vitest";
import {
  summarize,
  detectAnomalies,
  forecastMonthEnd,
  buildSankey,
} from "../src/insights.js";
import type { Transaction } from "../src/schema.js";

let idSeq = 0;
function tx(partial: Partial<Transaction> & Pick<Transaction, "type" | "amountCents" | "categoryId">): Transaction {
  idSeq += 1;
  return {
    id: `t${idSeq}`,
    description: "",
    occurredAt: "2026-07-10T12:00:00.000Z",
    createdAt: "2026-07-10T12:00:00.000Z",
    ...partial,
  };
}

describe("summarize", () => {
  it("computes income, expense, net, and savings rate", () => {
    const s = summarize([
      tx({ type: "income", amountCents: 500000, categoryId: "salary" }),
      tx({ type: "expense", amountCents: 120000, categoryId: "housing" }),
      tx({ type: "expense", amountCents: 30000, categoryId: "groceries" }),
    ]);
    expect(s.incomeCents).toBe(500000);
    expect(s.expenseCents).toBe(150000);
    expect(s.netCents).toBe(350000);
    expect(s.savingsRate).toBeCloseTo(0.7, 5);
    expect(s.transactionCount).toBe(3);
  });

  it("sorts categories by total descending", () => {
    const s = summarize([
      tx({ type: "expense", amountCents: 100, categoryId: "dining" }),
      tx({ type: "expense", amountCents: 900, categoryId: "groceries" }),
    ]);
    expect(s.byCategory[0]?.categoryId).toBe("groceries");
  });

  it("handles an empty ledger without dividing by zero", () => {
    const s = summarize([]);
    expect(s.netCents).toBe(0);
    expect(s.savingsRate).toBe(0);
  });
});

describe("detectAnomalies", () => {
  it("flags an expense that is a clear outlier within its category", () => {
    const txns = [
      tx({ type: "expense", amountCents: 5000, categoryId: "groceries" }),
      tx({ type: "expense", amountCents: 5200, categoryId: "groceries" }),
      tx({ type: "expense", amountCents: 4800, categoryId: "groceries" }),
      tx({ type: "expense", amountCents: 5100, categoryId: "groceries" }),
      tx({ type: "expense", amountCents: 30000, categoryId: "groceries" }), // outlier
    ];
    const anomalies = detectAnomalies(txns);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.amountCents).toBe(30000);
    expect(anomalies[0]?.ratio).toBeGreaterThan(2);
  });

  it("does not flag anything without enough history", () => {
    const txns = [
      tx({ type: "expense", amountCents: 5000, categoryId: "dining" }),
      tx({ type: "expense", amountCents: 90000, categoryId: "dining" }),
    ];
    expect(detectAnomalies(txns)).toHaveLength(0);
  });

  it("ignores income transactions", () => {
    const txns = Array.from({ length: 5 }, (_, i) =>
      tx({ type: "income", amountCents: i === 4 ? 999999 : 5000, categoryId: "salary" }),
    );
    expect(detectAnomalies(txns)).toHaveLength(0);
  });
});

describe("forecastMonthEnd", () => {
  it("extrapolates expense run-rate across the month", () => {
    // 10 days elapsed, $100 spent → ~$310 projected in a 31-day month.
    const now = new Date("2026-07-10T00:00:00.000Z");
    const txns = [
      tx({ type: "income", amountCents: 500000, categoryId: "salary", occurredAt: "2026-07-01T00:00:00.000Z" }),
      tx({ type: "expense", amountCents: 10000, categoryId: "groceries", occurredAt: "2026-07-05T00:00:00.000Z" }),
    ];
    const f = forecastMonthEnd(txns, now);
    expect(f.daysInMonth).toBe(31);
    expect(f.expenseSoFarCents).toBe(10000);
    expect(f.projectedExpenseCents).toBe(Math.round((10000 / 10) * 31));
    expect(f.projectedNetCents).toBe(500000 - f.projectedExpenseCents);
  });

  it("excludes transactions from other months", () => {
    const now = new Date("2026-07-10T00:00:00.000Z");
    const txns = [
      tx({ type: "expense", amountCents: 99999, categoryId: "housing", occurredAt: "2026-06-15T00:00:00.000Z" }),
    ];
    expect(forecastMonthEnd(txns, now).expenseSoFarCents).toBe(0);
  });
});

describe("buildSankey", () => {
  it("wires income → hub → expenses with a savings link", () => {
    const { nodes, links } = buildSankey([
      tx({ type: "income", amountCents: 10000, categoryId: "salary" }),
      tx({ type: "expense", amountCents: 6000, categoryId: "housing" }),
    ]);
    const hub = nodes.findIndex((n) => n.kind === "hub");
    const savings = nodes.find((n) => n.kind === "savings");
    expect(hub).toBeGreaterThanOrEqual(0);
    expect(savings).toBeDefined();
    // conservation: flow into hub equals flow out of hub
    const into = links.filter((l) => l.target === hub).reduce((a, l) => a + l.value, 0);
    const outOf = links.filter((l) => l.source === hub).reduce((a, l) => a + l.value, 0);
    expect(into).toBe(outOf);
  });

  it("models a deficit when spending exceeds income", () => {
    const { nodes } = buildSankey([
      tx({ type: "income", amountCents: 1000, categoryId: "salary" }),
      tx({ type: "expense", amountCents: 5000, categoryId: "dining" }),
    ]);
    expect(nodes.some((n) => n.name === "Deficit")).toBe(true);
  });

  it("returns an empty graph for an empty ledger", () => {
    expect(buildSankey([])).toEqual({ nodes: [], links: [] });
  });
});
