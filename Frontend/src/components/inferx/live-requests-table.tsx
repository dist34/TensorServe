import { ListOrdered } from "lucide-react";
import { liveRequests, type RequestState } from "@/lib/inferx-data";

const stateStyles: Record<RequestState, string> = {
  queued: "border-muted-foreground/25 bg-muted text-muted-foreground",
  prefill: "border-warning/25 bg-warning/10 text-warning",
  decoding: "border-primary/30 bg-primary/12 text-primary",
  complete: "border-success/25 bg-success/10 text-success",
};

function StateBadge({ state }: { state: RequestState }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize " +
        stateStyles[state]
      }
    >
      <span className="size-1.5 rounded-full bg-current" />
      {state}
    </span>
  );
}

export function LiveRequestsTable() {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ListOrdered className="size-3.5 text-primary" />
          <h2 className="text-[13px] font-semibold tracking-tight">Live Inference Requests</h2>
        </div>
        <span className="tabular text-[11px] text-muted-foreground">
          {liveRequests.length} in flight
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Request ID</th>
              <th className="px-4 py-2 font-medium">State</th>
              <th className="px-4 py-2 text-right font-medium">Prompt Tokens</th>
              <th className="px-4 py-2 text-right font-medium">Generated Tokens</th>
              <th className="px-4 py-2 text-right font-medium">Batch</th>
              <th className="px-4 py-2 text-right font-medium">TTFT</th>
              <th className="px-4 py-2 text-right font-medium">Latency</th>
            </tr>
          </thead>
          <tbody>
            {liveRequests.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-elevated/50"
              >
                <td className="tabular px-4 py-2.5 text-foreground">{r.id}</td>
                <td className="px-4 py-2.5">
                  <StateBadge state={r.state} />
                </td>
                <td className="tabular px-4 py-2.5 text-right">{r.promptTokens.toLocaleString()}</td>
                <td className="tabular px-4 py-2.5 text-right">
                  {r.generatedTokens.toLocaleString()}
                </td>
                <td className="tabular px-4 py-2.5 text-right text-muted-foreground">{r.batch}</td>
                <td className="tabular px-4 py-2.5 text-right">
                  {r.ttftMs === null ? <span className="text-muted-foreground">—</span> : `${r.ttftMs} ms`}
                </td>
                <td className="tabular px-4 py-2.5 text-right">
                  {r.latencyMs === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    `${r.latencyMs} ms`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
