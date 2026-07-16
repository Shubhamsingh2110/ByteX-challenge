"use client";

import { useState } from "react";
import {
  expenseCategories,
  incomeCategories,
  type CategoryId,
  type Transaction,
  type TransactionType,
} from "@repo/core";
import { Loader2 } from "lucide-react";
import type { ActionResult, RawTransactionInput } from "../lib/types";

function todayInputValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toISOString().slice(0, 10);
}

export interface FormPrefill {
  type?: TransactionType;
  amount?: number;
  categoryId?: CategoryId;
  description?: string;
  occurredAt?: string;
}

export function TransactionForm({
  initial,
  prefill,
  onSubmit,
  onDone,
  submitLabel = "Add transaction",
}: {
  initial?: Transaction;
  prefill?: FormPrefill;
  onSubmit: (input: RawTransactionInput) => Promise<ActionResult<Transaction>>;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [type, setType] = useState<TransactionType>(
    initial?.type ?? prefill?.type ?? "expense",
  );
  const [categoryId, setCategoryId] = useState<CategoryId>(
    initial?.categoryId ?? prefill?.categoryId ?? "groceries",
  );
  const [amount, setAmount] = useState(
    initial
      ? (initial.amountCents / 100).toFixed(2)
      : prefill?.amount != null
        ? prefill.amount.toFixed(2)
        : "",
  );
  const [description, setDescription] = useState(
    initial?.description ?? prefill?.description ?? "",
  );
  const [date, setDate] = useState(
    todayInputValue(initial?.occurredAt ?? prefill?.occurredAt),
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  const categories = type === "income" ? incomeCategories : expenseCategories;

  function switchType(next: TransactionType) {
    setType(next);
    // Keep the selected category valid for the new type.
    const pool = next === "income" ? incomeCategories : expenseCategories;
    if (!pool.some((c) => c.id === categoryId)) {
      setCategoryId(pool[0]!.id as CategoryId);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setPending(true);
    try {
      const result = await onSubmit({
        type,
        amount,
        categoryId,
        description,
        occurredAt: new Date(date).toISOString(),
        idempotencyKey: initial ? undefined : crypto.randomUUID(),
      });
      if (result.ok) {
        if (!initial) {
          setAmount("");
          setDescription("");
        }
        onDone?.();
      } else {
        setErrors(result.fieldErrors ?? {});
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-2 p-1">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchType(t)}
            className={`rounded-md py-1.5 text-sm font-medium capitalize transition ${
              type === t
                ? t === "income"
                  ? "bg-surface text-income shadow-sm"
                  : "bg-surface text-expense shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
            aria-pressed={type === t}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="amount">
            Amount
          </label>
          <input
            id="amount"
            className="input"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(errors.amount)}
          />
          {errors.amount?.map((m) => (
            <p key={m} className="field-error">
              {m}
            </p>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            className="input"
            value={date}
            max={todayInputValue()}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(errors.occurredAt)}
          />
          {errors.occurredAt?.map((m) => (
            <p key={m} className="field-error">
              {m}
            </p>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="category">
          Category
        </label>
        <select
          id="category"
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value as CategoryId)}
          aria-invalid={Boolean(errors.categoryId)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.label}
            </option>
          ))}
        </select>
        {errors.categoryId?.map((m) => (
          <p key={m} className="field-error">
            {m}
          </p>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="description">
          Description <span className="text-muted/70">(optional)</span>
        </label>
        <input
          id="description"
          className="input"
          placeholder="e.g. Weekly grocery run"
          value={description}
          maxLength={200}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description?.map((m) => (
          <p key={m} className="field-error">
            {m}
          </p>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitLabel}
        </button>
        {initial ? (
          <button type="button" className="btn-ghost" onClick={onDone} disabled={pending}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
