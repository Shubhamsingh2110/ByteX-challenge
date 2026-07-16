import { formatMoney, type Summary } from "@repo/core";
import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import type { ReactNode } from "react";

function StatCard({
  label,
  value,
  accent,
  icon,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  icon: ReactNode;
  hint?: string;
}) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span
          className="grid size-8 place-items-center rounded-full"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          {icon}
        </span>
      </div>
      <span className="text-2xl font-semibold tracking-tight" style={{ color: accent }}>
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function SummaryCards({ summary }: { summary: Summary }) {
  const net = summary.netCents;
  const netColor = net >= 0 ? "var(--income)" : "var(--expense)";
  const savingsPct = Math.round(summary.savingsRate * 100);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Income"
        value={formatMoney(summary.incomeCents)}
        accent="var(--income)"
        icon={<ArrowUpRight className="size-4" />}
      />
      <StatCard
        label="Expenses"
        value={formatMoney(summary.expenseCents)}
        accent="var(--expense)"
        icon={<ArrowDownRight className="size-4" />}
      />
      <StatCard
        label="Net Balance"
        value={formatMoney(net)}
        accent={netColor}
        icon={<Wallet className="size-4" />}
        hint={`${summary.transactionCount} transaction${summary.transactionCount === 1 ? "" : "s"}`}
      />
      <StatCard
        label="Savings Rate"
        value={`${savingsPct}%`}
        accent={savingsPct >= 0 ? "var(--primary)" : "var(--expense)"}
        icon={<PiggyBank className="size-4" />}
        hint={savingsPct >= 20 ? "Healthy 🎉" : savingsPct >= 0 ? "Room to improve" : "Overspending"}
      />
    </div>
  );
}
