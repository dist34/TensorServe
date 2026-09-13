import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { MetricSummary } from "@/lib/inferx-data";

export function MetricCard({ metric, icon: Icon }: { metric: MetricSummary; icon: LucideIcon }) {
  const TrendIcon =
    metric.trend === "up" ? ArrowUpRight : metric.trend === "down" ? ArrowDownRight : Minus;

  return (
    <div className="rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-border-strong">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {metric.label}
        </span>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="tabular text-[22px] font-semibold leading-none">{metric.value}</span>
        {metric.unit ? (
          <span className="text-[12px] text-muted-foreground">{metric.unit}</span>
        ) : null}
      </div>
      {metric.delta ? (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <TrendIcon className="size-3" />
          <span className="tabular">{metric.delta}</span>
          <span>vs last 5m</span>
        </div>
      ) : null}
    </div>
  );
}
