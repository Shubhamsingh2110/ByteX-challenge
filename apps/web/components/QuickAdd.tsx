"use client";

import { useState } from "react";
import { Sparkles, Loader2, CornerDownLeft } from "lucide-react";
import { parseQuickAddAction } from "../lib/actions";
import { useToast } from "./toast";
import type { FormPrefill } from "./TransactionForm";

const EXAMPLES = ["chai 20", "salary 85000", "auto 120 yesterday"];

export function QuickAdd({ onParsed }: { onParsed: (prefill: FormPrefill) => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || pending) return;

    setPending(true);
    try {
      const res = await parseQuickAddAction(value);
      if (res.ok) {
        onParsed({
          type: res.data.type,
          amount: res.data.amount,
          categoryId: res.data.categoryId,
          description: res.data.description,
          occurredAt: res.data.occurredAt,
        });
        setText("");
        const pct = Math.round(res.data.confidence * 100);
        toast.success(`Parsed with ${pct}% confidence — review & save`);
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Quick add with AI</h2>
      </div>
      <form onSubmit={handleParse} className="relative">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          placeholder="Type it naturally… “groceries 1450 yesterday”"
          className="input pr-11"
          aria-label="Natural-language transaction"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md bg-primary text-[var(--primary-fg)] transition hover:brightness-110 disabled:opacity-40"
          aria-label="Parse"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CornerDownLeft className="size-4" />
          )}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            disabled={pending}
            className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted transition hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
