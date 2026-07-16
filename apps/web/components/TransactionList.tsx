"use client";

import { useMemo, useState } from "react";
import {
  formatMoney,
  getCategory,
  type Anomaly,
  type Transaction,
  type TransactionType,
} from "@repo/core";
import { AlertTriangle, Pencil, Search, Trash2 } from "lucide-react";
import { TransactionForm } from "./TransactionForm";
import type { ActionResult, RawTransactionInput } from "../lib/types";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

type TypeFilter = "all" | TransactionType;

export function TransactionList({
  transactions,
  anomalies,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[];
  anomalies: Anomaly[];
  onEdit: (id: string, input: RawTransactionInput) => Promise<ActionResult<Transaction>>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const anomalyById = useMemo(
    () => new Map(anomalies.map((a) => [a.transactionId, a])),
    [anomalies],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (q) {
        const cat = getCategory(t.categoryId)?.label.toLowerCase() ?? "";
        if (!t.description.toLowerCase().includes(q) && !cat.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, typeFilter, query]);

  return (
    <div className="card">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold">
          Transactions{" "}
          <span className="font-normal text-muted">({filtered.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-surface-2 p-0.5">
            {(["all", "income", "expense"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                  typeFilter === f
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="input py-1.5 pl-8 text-xs sm:w-44"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No transactions match your filters.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((t) => {
            const cat = getCategory(t.categoryId);
            const anomaly = anomalyById.get(t.id);
            const isEditing = editingId === t.id;

            if (isEditing) {
              return (
                <li key={t.id} className="py-4">
                  <TransactionForm
                    initial={t}
                    submitLabel="Save changes"
                    onDone={() => setEditingId(null)}
                    onSubmit={(input) => onEdit(t.id, input)}
                  />
                </li>
              );
            }

            return (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full text-base"
                  style={{ backgroundColor: `${cat?.color ?? "#94a3b8"}1a` }}
                  aria-hidden
                >
                  {cat?.icon ?? "•"}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {t.description || cat?.label || t.categoryId}
                    </p>
                    {anomaly ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                        title={anomaly.message}
                      >
                        <AlertTriangle className="size-3" />
                        {anomaly.message}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted">
                    {cat?.label} · {dateFmt.format(new Date(t.occurredAt))}
                  </p>
                </div>

                <span
                  className="shrink-0 text-sm font-semibold tabular-nums"
                  style={{ color: t.type === "income" ? "var(--income)" : "var(--expense)" }}
                >
                  {t.type === "income" ? "+" : "−"}
                  {formatMoney(t.amountCents)}
                </span>

                {confirmId === t.id ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={async () => {
                        setConfirmId(null);
                        await onDelete(t.id);
                      }}
                      className="rounded-md bg-expense px-2 py-1 text-xs font-medium text-white"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="rounded-md px-2 py-1 text-xs text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setEditingId(t.id)}
                      className="rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => setConfirmId(t.id)}
                      className="rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-expense"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
