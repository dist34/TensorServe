/**
 * Mock data layer for the InferX dashboard.
 *
 * Every export here is shaped to match a future FastAPI response, so swapping
 * in real data means replacing these functions with fetch/react-query calls
 * while keeping the same types.
 */

export type TimeRange = "1m" | "5m" | "15m" | "1h";

export interface SeriesPoint {
  t: string;
  value: number;
}

export interface MetricSummary {
  id: string;
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
}

export interface EngineHealth {
  status: "healthy" | "degraded" | "down";
  batchSize: number;
  requestsPerSec: number;
  uptime: string;
}

export interface KvCache {
  utilization: number;
  allocatedBlocks: number;
  freeBlocks: number;
  totalBlocks: number;
}

export interface LatencyBreakdown {
  ttftMs: number;
  tpotMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export type RequestState = "queued" | "prefill" | "decoding" | "complete";

export interface InferenceRequest {
  id: string;
  state: RequestState;
  promptTokens: number;
  generatedTokens: number;
  batch: number;
  ttftMs: number | null;
  latencyMs: number | null;
}

export const metrics: MetricSummary[] = [];

export const engineHealth: EngineHealth = {
  status: "healthy",
  batchSize: 0,
  requestsPerSec: 0,
  uptime: "00:00:00",
};

export const kvCache: KvCache = {
  utilization: 0,
  allocatedBlocks: 0,
  freeBlocks: 0,
  totalBlocks: 0,
};

export const latency: LatencyBreakdown = {
  ttftMs: 0,
  tpotMs: 0,
  p50Ms: 0,
  p95Ms: 0,
  p99Ms: 0,
};

export const liveRequests: InferenceRequest[] = [];

const RANGE_POINTS: Record<TimeRange, number> = { "1m": 30, "5m": 40, "15m": 48, "1h": 60 };
const RANGE_STEP_SEC: Record<TimeRange, number> = { "1m": 2, "5m": 8, "15m": 19, "1h": 60 };

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function buildSeries(range: TimeRange, base: number, amplitude: number, seed: number): SeriesPoint[] {
  const count = RANGE_POINTS[range];
  const step = RANGE_STEP_SEC[range];
  const rand = seeded(seed);
  const out: SeriesPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const secondsAgo = i * step;
    const d = new Date(Date.UTC(2026, 0, 1, 12, 0, 0) - secondsAgo * 1000);
    const wave = Math.sin((count - i) / 4) * amplitude * 0.45;
    const noise = (rand() - 0.5) * amplitude;
    out.push({
      t: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`,
      value: Math.round((base + wave + noise) * 10) / 10,
    });
  }
  return out;
}

export function getThroughputSeries(_range: TimeRange): SeriesPoint[] {
  return [];
}

export function getGpuSeries(_range: TimeRange): SeriesPoint[] {
  return [];
}
