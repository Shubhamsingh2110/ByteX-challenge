import { formatMoney, type Anomaly, type Forecast } from "@repo/core";
import { CalendarClock, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

export function ForecastCard({
  forecast,
  anomalies,
}: {
  forecast: Forecast;
  anomalies: Anomaly[];
}) {
  const positive = forecast.projectedNetCents >= 0;
  const progress =
    forecast.daysInMonth > 0
      ? Math.min(100, Math.round((forecast.daysElapsed / forecast.daysInMonth) * 100))
      : 0;

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Month-end forecast</h2>
      </div>

      <div>
        <p className="text-xs text-muted">Projected net at month end</p>
        <p
          className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight"
          style={{ color: positive ? "var(--income)" : "var(--expense)" }}
        >
          {positive ? (
            <TrendingUp className="size-5" />
          ) : (
            <TrendingDown className="size-5" />
          )}
          {formatMoney(forecast.projectedNetCents)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Spent {formatMoney(forecast.expenseSoFarCents)} so far · projecting{" "}
          {formatMoney(forecast.projectedExpenseCents)} total
        </p>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>
            Day {forecast.daysElapsed} of {forecast.daysInMonth}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {anomalies.length > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5" />
            {anomalies.length} unusual {anomalies.length === 1 ? "expense" : "expenses"} detected
          </div>
          <p className="mt-1 text-xs text-muted">
            Top: {formatMoney(anomalies[0]!.amountCents)} — {anomalies[0]!.message}
          </p>
        </div>
      ) : null}
    </div>
  );
}
