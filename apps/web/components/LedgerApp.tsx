"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  summarize,
  detectAnomalies,
  forecastMonthEnd,
  buildSankey,
  type Transaction,
} from "@repo/core";
import { AlertCircle, Wallet } from "lucide-react";
import { SummaryCards } from "./SummaryCards";
import { TransactionForm, type FormPrefill } from "./TransactionForm";
import { TransactionList } from "./TransactionList";
import { ForecastCard } from "./ForecastCard";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { SankeyChart } from "./SankeyChart";
import { QuickAdd } from "./QuickAdd";
import { useToast } from "./toast";
import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from "../lib/actions";
import type { LedgerData } from "../lib/data";
import type { RawTransactionInput } from "../lib/types";

export function LedgerApp({ initial }: { initial: LedgerData }) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  // An AI-parsed suggestion seeds the form; bumping the key remounts the form
  // so its initial state picks up the new prefill.
  const [prefill, setPrefill] = useState<FormPrefill | undefined>(undefined);
  const [prefillKey, setPrefillKey] = useState(0);

  function applyPrefill(next: FormPrefill) {
    setPrefill(next);
    setPrefillKey((k) => k + 1);
  }

  // Optimistic removal makes deletes feel instant; the base list is the server
  // truth that flows back in via revalidation.
  const [transactions, removeOptimistic] = useOptimistic(
    initial.transactions,
    (state: Transaction[], removedId: string) =>
      state.filter((t) => t.id !== removedId),
  );

  // All insights are derived on the client from the (optimistic) list using the
  // exact same pure functions the server uses — so the UI updates instantly.
  const summary = useMemo(() => summarize(transactions), [transactions]);
  const anomalies = useMemo(() => detectAnomalies(transactions), [transactions]);
  const forecast = useMemo(
    () => forecastMonthEnd(transactions, new Date()),
    [transactions],
  );
  const sankey = useMemo(() => buildSankey(transactions), [transactions]);

  async function handleCreate(input: RawTransactionInput) {
    const res = await createTransactionAction(input);
    if (res.ok) toast.success("Transaction added");
    else if (!res.fieldErrors) toast.error(res.error);
    return res;
  }

  async function handleEdit(id: string, input: RawTransactionInput) {
    const res = await updateTransactionAction(id, input);
    if (res.ok) toast.success("Transaction updated");
    else if (!res.fieldErrors) toast.error(res.error);
    return res;
  }

  function handleDelete(id: string) {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        removeOptimistic(id);
        const res = await deleteTransactionAction(id);
        if (res.ok) toast.success("Transaction deleted");
        else toast.error(res.error);
        resolve();
      });
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-[var(--primary-fg)]">
          <Wallet className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Smart Mini-Ledger</h1>
          <p className="text-xs text-muted">
            Track income &amp; expenses · powered by Claude + MongoDB Atlas
          </p>
        </div>
      </header>

      {initial.error ? (
        <div className="flex items-start gap-2 rounded-xl border border-expense/30 bg-expense/10 p-3 text-sm text-expense">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{initial.error}</span>
        </div>
      ) : null}

      <SummaryCards summary={summary} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <QuickAdd onParsed={applyPrefill} />
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold">Add a transaction</h2>
            <TransactionForm
              key={prefillKey}
              prefill={prefill}
              onSubmit={handleCreate}
            />
          </div>
          <ForecastCard forecast={forecast} anomalies={anomalies} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <SankeyChart data={sankey} />
          <CategoryBreakdown summary={summary} />
          <TransactionList
            transactions={transactions}
            anomalies={anomalies}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}
