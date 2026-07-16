import { formatMoney, type Summary } from "@repo/core";

export function CategoryBreakdown({ summary }: { summary: Summary }) {
  const expenseCats = summary.byCategory.filter(
    (c) => summary.expenseCents > 0 && c.totalCents > 0 && isExpense(c.categoryId),
  );

  if (expenseCats.length === 0) {
    return (
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold">Spending by category</h2>
        <p className="py-6 text-center text-sm text-muted">
          No expenses yet — add one to see the breakdown.
        </p>
      </div>
    );
  }

  const max = Math.max(...expenseCats.map((c) => c.totalCents));

  return (
    <div className="card">
      <h2 className="mb-4 text-sm font-semibold">Spending by category</h2>
      <ul className="flex flex-col gap-3">
        {expenseCats.map((c) => {
          const pct = Math.round((c.totalCents / summary.expenseCents) * 100);
          return (
            <li key={c.categoryId} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-muted">
                {c.icon} {c.label}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(4, (c.totalCents / max) * 100)}%`,
                    backgroundColor: c.color,
                  }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">
                {formatMoney(c.totalCents)}
              </span>
              <span className="w-8 shrink-0 text-right text-[11px] text-muted">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Expense categories are those the summary marks as expenses; we infer from the
// known income category ids to avoid importing the full taxonomy here.
const INCOME_IDS = new Set([
  "salary",
  "freelance",
  "investment",
  "gift",
  "other-income",
]);
function isExpense(categoryId: string): boolean {
  return !INCOME_IDS.has(categoryId);
}
