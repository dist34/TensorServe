import { Activity, Boxes, Clock, Gauge, Layers, Timer } from "lucide-react";
import { engineHealth, kvCache, latency } from "@/lib/inferx-data";

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Icon className="size-3.5 text-primary" />
        <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 text-[12px] last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "tabular text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

export function EngineHealthCard() {
  return (
    <Panel title="Engine Health" icon={Activity}>
      <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[12px]">
        <span className="text-muted-foreground">Status</span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-success/25 bg-success/10 px-2 py-0.5 text-[11px] font-medium capitalize text-success">
          <span className="size-1.5 rounded-full bg-success" />
          {engineHealth.status}
        </span>
      </div>
      <Row label="Batch Size" value={String(engineHealth.batchSize)} />
      <Row label="Requests/sec" value={engineHealth.requestsPerSec.toFixed(1)} />
      <Row label="Uptime" value={engineHealth.uptime} />
    </Panel>
  );
}

export function KvCacheCard() {
  return (
    <Panel title="KV Cache" icon={Layers}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Utilization
        </span>
        <span className="tabular text-[20px] font-semibold leading-none">
          {kvCache.utilization}
          <span className="ml-0.5 text-[12px] font-normal text-muted-foreground">%</span>
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${kvCache.utilization}%` }}
        />
      </div>
      <div className="mt-3">
        <Row label="Allocated Blocks" value={kvCache.allocatedBlocks.toLocaleString()} />
        <Row label="Free Blocks" value={kvCache.freeBlocks.toLocaleString()} />
        <Row label="Total Blocks" value={kvCache.totalBlocks.toLocaleString()} />
      </div>
    </Panel>
  );
}

export function LatencyCard() {
  const rows = [
    { label: "TTFT", value: `${latency.ttftMs} ms`, icon: Timer },
    { label: "TPOT", value: `${latency.tpotMs} ms`, icon: Clock },
    { label: "P50", value: `${latency.p50Ms} ms`, icon: Gauge },
    { label: "P95", value: `${latency.p95Ms} ms`, icon: Gauge },
    { label: "P99", value: `${latency.p99Ms} ms`, icon: Boxes },
  ];
  return (
    <Panel title="Latency" icon={Timer}>
      {rows.map((r) => (
        <Row key={r.label} label={r.label} value={r.value} />
      ))}
    </Panel>
  );
}
