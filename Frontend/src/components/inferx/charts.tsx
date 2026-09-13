import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getGpuSeries, getThroughputSeries, type TimeRange } from "@/lib/inferx-data";

const RANGES: TimeRange[] = ["1m", "5m", "15m", "1h"];

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border-strong bg-popover px-2.5 py-1.5 shadow-lg">
      <div className="tabular text-[11px] text-muted-foreground">{label}</div>
      <div className="tabular text-[13px] font-medium text-foreground">
        {payload[0]?.value} {unit}
      </div>
    </div>
  );
}

function TimeSeriesCard({
  title,
  subtitle,
  currentValue,
  unit,
  color,
  gradientId,
  data,
  domain,
  range,
  onRangeChange,
}: {
  title: string;
  subtitle: string;
  currentValue: string;
  unit: string;
  color: string;
  gradientId: string;
  data: Array<{ t: string; value: number }>;
  domain?: [number, number];
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Current</div>
            <div className="tabular text-[15px] font-semibold">
              {currentValue}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">{unit}</span>
            </div>
          </div>
          <div className="flex rounded-md border border-border bg-background p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange(r)}
                className={
                  "tabular rounded px-2 py-1 text-[11px] transition-colors " +
                  (r === range
                    ? "bg-elevated text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-1.5 py-3">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={domain ?? ["auto", "auto"]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)" }}
              content={<ChartTooltip unit={unit} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function ThroughputChart() {
  const [range, setRange] = useState<TimeRange>("5m");
  const data = useMemo(() => getThroughputSeries(range), [range]);
  return (
    <TimeSeriesCard
      title="Token Throughput"
      subtitle="Tokens generated per second"
      currentValue="142"
      unit="tok/s"
      color="var(--chart-1)"
      gradientId="throughputFill"
      data={data}
      range={range}
      onRangeChange={setRange}
    />
  );
}

export function GpuUtilizationChart() {
  const [range, setRange] = useState<TimeRange>("5m");
  const data = useMemo(() => getGpuSeries(range), [range]);
  return (
    <TimeSeriesCard
      title="GPU Utilization"
      subtitle="Device utilization over time"
      currentValue="87"
      unit="%"
      color="var(--chart-3)"
      gradientId="gpuFill"
      data={data}
      domain={[0, 100]}
      range={range}
      onRangeChange={setRange}
    />
  );
}
