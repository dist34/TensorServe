import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Cpu,
  Database,
  Gauge,
  History,
  Layers,
  Play,
  Square,
  Timer,
  Trash2,
  Zap,
} from "lucide-react";
import { Reveal } from "@/components/inferx/home-animations";
import { TensorServeStarfield } from "@/components/inferx/tensorserve-starfield";
import { useAuth } from "@/contexts/auth-context";
import { useModelInfo } from "@/lib/hooks/use-model-info";

/* -------------------------------------------------------------------------- */
/* Backend contract                                                           */
/* -------------------------------------------------------------------------- */

export interface BenchmarkRequestPayload {
  prompt: string;
  runs: number;
  max_new_tokens: number;
  temperature: number;
  do_sample: boolean;
  use_kv_cache: boolean;
}

export type ThroughputSample = {
  time: number;
  throughput: number;
};

export interface BenchmarkResult {
  id?: number;
  created_at?: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;

  average_input_tokens: number;
  average_output_tokens: number;

  average_ttft: number;
  average_generation_time: number;
  average_tokens_per_second: number;

  peak_ram_percent: number;
  peak_ram_used_mb: number;

  peak_gpu_utilization_percent: number;
  peak_gpu_memory_used_mb: number;
  peak_gpu_temperature_c: number;
  peak_gpu_power_usage_w: number;

  // NOTE: this must stay an array of {time, throughput} samples (never a
  // bare number[]) — the chart relies on each sample carrying its own
  // elapsed-time value so KV Cache ON and KV Cache OFF can each be plotted
  // on their own zero-based timeline instead of a shared/cumulative one.
  throughput_samples: ThroughputSample[];
  use_kv_cache?: boolean;
}

export interface BenchmarkRun {
  id: number;
  requests: number;
  concurrency: number;
  inputLen: number;
  outputLen: number;
  throughput: number;
  ttft: number;
  latency: number;
  kvCache: boolean;
}

interface BenchmarkConfig {
  runs: number;
  inputLen: number;
  outputLen: number;
  temperature: number;
}

type BenchmarkStatus =
  | "idle"
  | "running"
  | "complete"
  | "stopped"
  | "error";

interface BenchmarkEvent {
  type: "run_complete" | "run_error" | "benchmark_complete";
  id?: number;
  run?: number
  total?: number;
  total_runs?: number;
  input_tokens?: number;
  output_tokens?: number;
  ttft?: number;
  generation_time?: number;
  tokens_per_second?: number;
  error?: string;
  results?: Array<{
    run: number;
    total: number;
    input_tokens: number;
    output_tokens: number;
    ttft: number;
    generation_time: number;
    tokens_per_second: number;
  }>;
  peak_ram_percent?: number;
  peak_ram_used_mb?: number;
  peak_gpu_utilization_percent?: number;
  peak_gpu_memory_used_mb?: number;
  peak_gpu_temperature_c?: number;
  peak_gpu_power_usage_w?: number;
}

interface Results {
  throughput: number;
  avgTtft: number;
  avgLatency: number;

  inputTokens: number;
  outputTokens: number;

  successfulRuns: number;
  failedRuns: number;

  peakRamPercent: number;
  peakRamUsedMb: number;

  peakGpuUtilizationPercent: number;
  peakGpuMemoryUsedMb: number;
  peakGpuTemperatureC: number;
  peakGpuPowerUsageW: number;
}

const EMPTY_RESULTS: Results = {
  throughput: 0,
  avgTtft: 0,
  avgLatency: 0,

  inputTokens: 0,
  outputTokens: 0,

  successfulRuns: 0,
  failedRuns: 0,

  peakRamPercent: 0,
  peakRamUsedMb: 0,

  peakGpuUtilizationPercent: 0,
  peakGpuMemoryUsedMb: 0,
  peakGpuTemperatureC: 0,
  peakGpuPowerUsageW: 0,
};

/* -------------------------------------------------------------------------- */
/* Backend request                                                            */
/* -------------------------------------------------------------------------- */

const BENCHMARK_API_BASE_URL =
  (import.meta as ImportMeta & {
    env: {
      VITE_API_URL?: string;
      VITE_API_BASE_URL?: string;
    };
  }).env.VITE_API_URL ||
  (import.meta as ImportMeta & {
    env: {
      VITE_API_URL?: string;
      VITE_API_BASE_URL?: string;
    };
  }).env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

/* -------------------------------------------------------------------------- */
/* Prompt generation                                                          */
/* -------------------------------------------------------------------------- */

function buildPrompt(inputLen: number): string {
  const base =
    "Explain how KV cache improves large language model inference, focusing on efficient autoregressive decoding, attention reuse, and reduced redundant computation across long prompts and repeated generation steps.";

  const targetLength = Math.max(inputLen, 1);

  const repeatCount = Math.max(
    1,
    Math.ceil(targetLength / base.length),
  );

  return `${base} `
    .repeat(repeatCount)
    .slice(0, targetLength);
}

/* -------------------------------------------------------------------------- */
/* Payload                                                                    */
/* -------------------------------------------------------------------------- */

function throughputSamplesFromResults(
  results: Array<{
    generation_time: number;
    tokens_per_second: number;
  }>,
): ThroughputSample[] {
  let elapsedTime = 0;
  const samples: ThroughputSample[] = [];

  for (const result of results) {
    elapsedTime += result.generation_time;
    samples.push({
      time: elapsedTime,
      throughput: result.tokens_per_second,
    });
  }

  return samples;
}

function normalizeThroughputSamples(
  samples: unknown,
): ThroughputSample[] {
  if (!Array.isArray(samples)) {
    return [];
  }

  let elapsedTime = 0;
  const normalized: ThroughputSample[] = [];

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];

    if (typeof sample === "number" && Number.isFinite(sample)) {
      elapsedTime += 1;
      normalized.push({
        time: elapsedTime,
        throughput: sample,
      });
      continue;
    }

    if (
      sample &&
      typeof sample === "object" &&
      "throughput" in sample &&
      typeof (sample as ThroughputSample).throughput === "number"
    ) {
      const timed = sample as Partial<ThroughputSample>;
      normalized.push({
        time:
          typeof timed.time === "number" ? timed.time : index + 1,
        throughput: timed.throughput as number,
      });
    }
  }

  return normalized;
}

/**
 * Each KV-cache configuration (ON vs OFF) is its own independent benchmark
 * run with its own elapsed-time timeline starting at 0s. When we load past
 * results from history we must NOT flatten/concatenate multiple historical
 * runs of the same configuration together — doing so silently stitches
 * separate benchmarks into one fake cumulative timeline (this was the cause
 * of the inflated X-axis values like 230s/461s/691s). Instead we always
 * show the single most recent completed run for a given configuration, and
 * that run's samples already start at (or are normalized to start at) 0s.
 */
function mostRecentBenchmarkResult(
  results: BenchmarkResult[],
): BenchmarkResult | undefined {
  if (results.length === 0) {
    return undefined;
  }

  const sorted = [...results].sort((a, b) => {
    const aTime = a.created_at
      ? new Date(a.created_at).getTime()
      : (a.id ?? 0);
    const bTime = b.created_at
      ? new Date(b.created_at).getTime()
      : (b.id ?? 0);
    return bTime - aTime;
  });

  return sorted[0];
}

function buildPayload(
  config: BenchmarkConfig,
  useKvCache: boolean,
): BenchmarkRequestPayload {
  return {
    prompt: buildPrompt(config.inputLen),

    runs: config.runs,

    max_new_tokens: config.outputLen,

    temperature: config.temperature,

    do_sample: true,

    use_kv_cache: useKvCache,
  };
}

/* -------------------------------------------------------------------------- */
/* Response validation                                                        */
/* -------------------------------------------------------------------------- */

function isBenchmarkResult(
  value: unknown,
): value is BenchmarkResult {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.total_runs === "number" &&
    typeof data.successful_runs === "number" &&
    typeof data.failed_runs === "number" &&
    typeof data.average_input_tokens === "number" &&
    typeof data.average_output_tokens === "number" &&
    typeof data.average_ttft === "number" &&
    typeof data.average_generation_time === "number" &&
    typeof data.average_tokens_per_second === "number" &&
    typeof data.peak_ram_percent === "number" &&
    typeof data.peak_ram_used_mb === "number" &&
    typeof data.peak_gpu_utilization_percent ===
      "number" &&
    typeof data.peak_gpu_memory_used_mb ===
      "number" &&
    typeof data.peak_gpu_temperature_c ===
      "number" &&
    typeof data.peak_gpu_power_usage_w ===
      "number" &&
    Array.isArray(data.throughput_samples)
  );
}

/* -------------------------------------------------------------------------- */
/* Benchmark API                                                              */
/* -------------------------------------------------------------------------- */

async function runBenchmark(
  payload: BenchmarkRequestPayload,
  signal: AbortSignal,
  onProgress: (event: BenchmarkEvent) => void,
  token: string | null,
): Promise<BenchmarkResult> {
  const response = await fetch(
    `${BENCHMARK_API_BASE_URL}/benchmark/`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },

      body: JSON.stringify(payload),

      signal,
    },
  );

  if (!response.ok) {
    let message = `Backend returned ${response.status} ${response.statusText}`;

    try {
      const errorData = await response.json();

      if (
        typeof errorData === "object" &&
        errorData !== null &&
        "detail" in errorData
      ) {
        message = String(
          (errorData as { detail: unknown }).detail,
        );
      }
    } catch {
      // Keep the original HTTP error.
    }

    throw new Error(message);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let finalResult: BenchmarkResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        try {
          const event: BenchmarkEvent = JSON.parse(line);
          onProgress(event);

          if (event.type === "benchmark_complete" && event.results) {
            const successful_runs = event.results.length;
            const failed_runs = (event.total_runs || payload.runs) - successful_runs;

            finalResult = {
              id: event.id,
              total_runs: payload.runs,
              successful_runs,
              failed_runs,

              average_input_tokens:
                successful_runs > 0
                  ? event.results.reduce((sum, r) => sum + r.input_tokens, 0) / successful_runs
                  : 0,

              average_output_tokens:
                successful_runs > 0
                  ? event.results.reduce((sum, r) => sum + r.output_tokens, 0) / successful_runs
                  : 0,

              average_ttft:
                successful_runs > 0
                  ? event.results.reduce((sum, r) => sum + r.ttft, 0) / successful_runs
                  : 0,

              average_generation_time:
                successful_runs > 0
                  ? event.results.reduce((sum, r) => sum + r.generation_time, 0) / successful_runs
                  : 0,

              average_tokens_per_second:
                successful_runs > 0
                  ? event.results.reduce((sum, r) => sum + r.tokens_per_second, 0) / successful_runs
                  : 0,

              peak_ram_percent: event.peak_ram_percent || 0,
              peak_ram_used_mb: event.peak_ram_used_mb || 0,
              peak_gpu_utilization_percent: event.peak_gpu_utilization_percent || 0,
              peak_gpu_memory_used_mb: event.peak_gpu_memory_used_mb || 0,
              peak_gpu_temperature_c: event.peak_gpu_temperature_c || 0,
              peak_gpu_power_usage_w: event.peak_gpu_power_usage_w || 0,

              // This is a single benchmark's own results, so the elapsed
              // time here is correctly zero-based for THIS run only.
              throughput_samples: throughputSamplesFromResults(
                event.results,
              ),
              use_kv_cache: payload.use_kv_cache,
            };
          }
        } catch (parseError) {
          console.error("Failed to parse benchmark event:", parseError, line);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalResult) {
    throw new Error("Benchmark completed without final result");
  }

  return finalResult;
}
async function deleteBenchmarkResult(
  id: number,
  token: string | null,
): Promise<void> {
  const response = await fetch(
    `${BENCHMARK_API_BASE_URL}/benchmark/history/${id}`,
    {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete benchmark result ${id} (${response.status})`);
  }
}
/* -------------------------------------------------------------------------- */
/* Shared UI                                                                  */
/* -------------------------------------------------------------------------- */

function Panel({
  title,
  right,
  className = "",
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-border bg-card ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h2>

          {right}
        </div>
      )}

      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Number field                                                               */
/* -------------------------------------------------------------------------- */

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  disabled,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  suffix?: string;
  disabled?: boolean;
  step?: number;
}) {
  return (
    <label className="flex items-center justify-between py-2">
      <span className="text-xs text-foreground/90">
        {label}
      </span>

      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            const rawValue = event.target.value;

            const next = Number(rawValue);

            if (!Number.isNaN(next)) {
              onChange(
                Math.min(
                  max,
                  Math.max(min, next),
                ),
              );
            }
          }}
          className="w-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-right font-mono text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-ring disabled:opacity-50"
        />

        {suffix && (
          <span className="w-12 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Toggle                                                                     */
/* -------------------------------------------------------------------------- */

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between py-2 text-left disabled:opacity-50"
    >
      <span className="text-xs text-foreground/90">
        {label}
      </span>

      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked
            ? "bg-primary"
            : "bg-secondary"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked
              ? "translate-x-4"
              : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Metric                                                                     */
/* -------------------------------------------------------------------------- */

function Metric({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="min-w-[150px] flex-1 border-r border-border px-5 py-4 last:border-r-0">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" />

        <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="font-mono text-xl font-semibold tracking-tight text-foreground">
        {value}

        {unit && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Throughput chart                                                           */
/* -------------------------------------------------------------------------- */

function withChartOrigin(
  samples: ThroughputSample[],
): Array<ThroughputSample & { synthetic?: boolean }> {
  const ordered = [...samples].sort((a, b) => a.time - b.time);

  if (ordered.length === 0 || ordered[0].time <= 0) {
    return ordered;
  }

  return [
    {
      time: 0,
      throughput: ordered[0].throughput,
      synthetic: true,
    },
    ...ordered,
  ];
}

function ThroughputChart({
  kvCacheOnSamples,
  kvCacheOffSamples,
}: {
  kvCacheOnSamples: ThroughputSample[];
  kvCacheOffSamples: ThroughputSample[];
}) {
  // Each series is normalized to its own zero-based origin independently
  // (via withChartOrigin) — KV Cache ON and KV Cache OFF are two separate
  // benchmark runs, so neither series' elapsed time is offset by the
  // other's duration.
  const onSeries = withChartOrigin(kvCacheOnSamples);
  const offSeries = withChartOrigin(kvCacheOffSamples);

  const allSamples = [
    ...onSeries,
    ...offSeries,
  ];

  if (allSamples.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto mb-3 h-6 w-6 text-muted-foreground/30" />

          <p className="font-mono text-xs text-muted-foreground">
            Run a benchmark to see throughput over time.
          </p>
        </div>
      </div>
    );
  }

  const width = 900;
  const height = 280;

  const paddingLeft = 44;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Y-axis auto-scales to the highest measured throughput across both
  // series so the ON vs OFF gap stays clearly visible.
  const maxThroughput = Math.max(
    ...allSamples.map((sample) => sample.throughput),
    1,
  );

  // X-axis scales to the longer of the two independent timelines. Both
  // series still start at their own 0s origin — this only sets how far
  // the axis extends.
  const maxTime = Math.max(
    ...allSamples.map((sample) => sample.time),
    1,
  );

  const chartMax = maxThroughput * 1.15;

  const createPoints = (samples: Array<ThroughputSample & { synthetic?: boolean }>) => {
    return samples.map((sample) => {
      const x =
        paddingLeft +
        (sample.time / maxTime) * chartWidth;

      const y =
        paddingTop +
        chartHeight -
        (sample.throughput / chartMax) * chartHeight;

      return {
        x,
        y,
        time: sample.time,
        throughput: sample.throughput,
        synthetic: Boolean(sample.synthetic),
      };
    });
  };

  const onPoints = createPoints(onSeries);
  const offPoints = createPoints(offSeries);

  const createPath = (
    points: Array<{
      x: number;
      y: number;
    }>,
  ) => {
    if (points.length === 0) {
      return "";
    }

    return points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(
            2,
          )} ${point.y.toFixed(2)}`,
      )
      .join(" ");
  };

  const onPath = createPath(onPoints);
  const offPath = createPath(offPoints);

  const yTicks = 5;
  const xTicks = 5;

  return (
    <div className="p-4">
      <div className="flex items-stretch gap-1">
        <div className="flex w-6 shrink-0 items-center justify-center">
          <span className="rotate-180 font-mono text-[10px] text-muted-foreground [writing-mode:vertical-rl]">
            Throughput (tok/s)
          </span>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {Array.from({ length: yTicks + 1 }).map(
            (_, index) => {
              const ratio = index / yTicks;

              const y =
                paddingTop +
                chartHeight -
                ratio * chartHeight;

              const value = chartMax * ratio;

              return (
                <g key={`y-${index}`}>
                  <line
                    x1={paddingLeft}
                    x2={width - paddingRight}
                    y1={y}
                    y2={y}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    opacity="0.6"
                  />

                  <text
                    x={paddingLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-muted-foreground"
                    fontSize="11"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {value.toFixed(0)}
                  </text>
                </g>
              );
            },
          )}

          {Array.from({ length: xTicks + 1 }).map(
            (_, index) => {
              const ratio = index / xTicks;

              const x =
                paddingLeft +
                ratio * chartWidth;

              const value = maxTime * ratio;

              return (
                <g key={`x-${index}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={paddingTop}
                    y2={paddingTop + chartHeight}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    opacity="0.35"
                  />

                  <text
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-muted-foreground"
                    fontSize="11"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {value.toFixed(1)}s
                  </text>
                </g>
              );
            },
          )}

          <line
            x1={paddingLeft}
            x2={paddingLeft}
            y1={paddingTop}
            y2={paddingTop + chartHeight}
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          <line
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={paddingTop + chartHeight}
            y2={paddingTop + chartHeight}
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          {onPoints.length > 1 && (
            <path
              d={onPath}
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {onPoints
            .filter((point) => !point.synthetic)
            .map((point, index) => (
            <circle
              key={`on-${index}`}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="var(--color-success)"
            >
              <title>
                {`KV Cache ON\nTime: ${point.time.toFixed(
                  2,
                )}s\nThroughput: ${point.throughput.toFixed(
                  2,
                )} tok/s`}
              </title>
            </circle>
          ))}

          {offPoints.length > 1 && (
            <path
              d={offPath}
              fill="none"
              stroke="var(--color-destructive)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {offPoints
            .filter((point) => !point.synthetic)
            .map((point, index) => (
            <circle
              key={`off-${index}`}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="var(--color-destructive)"
            >
              <title>
                {`KV Cache OFF\nTime: ${point.time.toFixed(
                  2,
                )}s\nThroughput: ${point.throughput.toFixed(
                  2,
                )} tok/s`}
              </title>
            </circle>
          ))}
        </svg>
      </div>

      <p className="mt-1 text-center font-mono text-[10px] text-muted-foreground">
        Time (seconds)
      </p>

      <div className="mt-2 flex items-center justify-center gap-6">
        {kvCacheOnSamples.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />

            <span className="font-mono text-[10px] text-muted-foreground">
              KV Cache ON
            </span>
          </div>
        )}

        {kvCacheOffSamples.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive" />

            <span className="font-mono text-[10px] text-muted-foreground">
              KV Cache OFF
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
        Peak {maxThroughput.toFixed(1)} tok/s
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function BenchmarkLabContent() {
  const { token } = useAuth();
  const { modelName, device: engineDevice } = useModelInfo();
  const [config, setConfig] =
    useState<BenchmarkConfig>({
      runs: 5,
      inputLen: 128,
      outputLen: 256,
      temperature: 0.7,
    });

  const [useKvCache, setUseKvCache] =
    useState(true);

  const [status, setStatus] =
    useState<BenchmarkStatus>("idle");

  const [results, setResults] =
    useState<Results>(EMPTY_RESULTS);

  const [hasResults, setHasResults] =
    useState(false);

  const [samples, setSamples] =
    useState<ThroughputSample[]>([]);

  // Each of these holds ONLY the samples for the single most recent
  // benchmark run of that KV-cache configuration. They are never merged
  // across multiple historical runs or across the ON/OFF configurations —
  // each is its own independent, zero-based elapsed-time timeline.
  const [kvCacheOnSamples, setKvCacheOnSamples] =
    useState<ThroughputSample[]>([]);

  const [kvCacheOffSamples, setKvCacheOffSamples] =
    useState<ThroughputSample[]>([]);

  const [runs, setRuns] =
    useState<BenchmarkRun[]>([]);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const abortRef =
    useRef<AbortController | null>(null);

  const fallbackIdRef =
    useRef(-1);

  const [currentRun, setCurrentRun] =
    useState(0);

  const [totalRuns, setTotalRuns] =
    useState(0);

  useEffect(() => {
    if (!token) return;

    void fetch(`${BENCHMARK_API_BASE_URL}/benchmark/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((history: BenchmarkResult[]) => {
        const kvCacheOnRuns = history.filter(result => result.use_kv_cache === true);
        const kvCacheOffRuns = history.filter(result => result.use_kv_cache === false);

        setRuns(history.map((result) => ({
          id: result.id ?? 0,
          requests: result.total_runs,
          concurrency: 1,
          inputLen: result.average_input_tokens,
          outputLen: result.average_output_tokens,
          throughput: result.average_tokens_per_second,
          ttft: result.average_ttft,
          latency: result.average_generation_time,
          kvCache: result.use_kv_cache ?? true,
        })));

        // Use only the most recent run for each configuration. KV Cache ON
        // and KV Cache OFF are separate benchmarks, each with its own
        // elapsed-time timeline starting at 0s — concatenating every past
        // run of a configuration together would fake a single cumulative
        // timeline that never actually happened (this was the source of
        // the inflated X-axis values like 230s/461s/691s).
        const latestOnRun = mostRecentBenchmarkResult(kvCacheOnRuns);
        const latestOffRun = mostRecentBenchmarkResult(kvCacheOffRuns);

        setKvCacheOnSamples(
          normalizeThroughputSamples(latestOnRun?.throughput_samples ?? []),
        );
        setKvCacheOffSamples(
          normalizeThroughputSamples(latestOffRun?.throughput_samples ?? []),
        );
      })
      .catch(() => undefined);
  }, [token]);

  /* ---------------------------------------------------------------------- */
  /* Configuration                                                          */
  /* ---------------------------------------------------------------------- */

  const setField = useCallback(
    <K extends keyof BenchmarkConfig>(
      key: K,
      value: BenchmarkConfig[K],
    ) => {
      setConfig((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  /* ---------------------------------------------------------------------- */
  /* Run benchmark                                                          */
  /* ---------------------------------------------------------------------- */

  const handleRun = useCallback(
    async () => {
      /*
       * Cancel any previous request.
       */
      abortRef.current?.abort();

      const controller =
        new AbortController();

      abortRef.current = controller;

      setStatus("running");

      setErrorMessage(null);

      setResults(EMPTY_RESULTS);

      setHasResults(false);

      setSamples([]);

      // A brand new run starts its OWN elapsed-time timeline at 0s. Only
      // the samples for the configuration being run right now are reset —
      // the other configuration's most recent series is left untouched so
      // both can still be compared once this run finishes.
      if (useKvCache) {
        setKvCacheOnSamples([]);
      } else {
        setKvCacheOffSamples([]);
      }

      setCurrentRun(0);
      setTotalRuns(config.runs);

      const payload = buildPayload(
        config,
        useKvCache,
      );

      try {
        const result =
          await runBenchmark(
            payload,
            controller.signal,
            (event) => {
              if (event.type === "run_complete" && event.run && event.total) {
                setCurrentRun(event.run);
                setTotalRuns(event.total);

                if (event.tokens_per_second !== undefined) {
                  const generationTime = event.generation_time ?? 0;

                  // `previous` here is scoped to THIS run only (it was
                  // cleared to [] above), so `lastTime` always starts at 0
                  // for a fresh benchmark and never inherits elapsed time
                  // from a prior run or from the other KV-cache mode.
                  const appendSample = (
                    previous: ThroughputSample[],
                  ): ThroughputSample[] => {
                    const lastTime =
                      previous.length > 0
                        ? previous[previous.length - 1].time
                        : 0;

                    return [
                      ...previous,
                      {
                        time: lastTime + generationTime,
                        throughput: event.tokens_per_second!,
                      },
                    ];
                  };

                  if (useKvCache) {
                    setKvCacheOnSamples(appendSample);
                  } else {
                    setKvCacheOffSamples(appendSample);
                  }

                  setSamples(appendSample);
                }
              } else if (event.type === "run_error") {
                console.error("Run error:", event.error);
              }
            },
            token,
          );

        if (controller.signal.aborted) {
          return;
        }

        /* -------------------------------------------------------------- */
        /* Results                                                        */
        /* -------------------------------------------------------------- */

        setResults({
          throughput:
            result.average_tokens_per_second,

          avgTtft:
            result.average_ttft,

          avgLatency:
            result.average_generation_time,

          inputTokens:
            result.average_input_tokens,

          outputTokens:
            result.average_output_tokens,

          successfulRuns:
            result.successful_runs,

          failedRuns:
            result.failed_runs,

          peakRamPercent:
            result.peak_ram_percent,

          peakRamUsedMb:
            result.peak_ram_used_mb,

          peakGpuUtilizationPercent:
            result.peak_gpu_utilization_percent,

          peakGpuMemoryUsedMb:
            result.peak_gpu_memory_used_mb,

          peakGpuTemperatureC:
            result.peak_gpu_temperature_c,

          peakGpuPowerUsageW:
            result.peak_gpu_power_usage_w,
        });

        setSamples(
          normalizeThroughputSamples(result.throughput_samples),
        );

        // Replace this configuration's displayed timeline with the
        // authoritative, backend-measured samples for the run that just
        // completed (rather than the incrementally-appended progress
        // samples) — this is still a single zero-based timeline for this
        // one benchmark.
        const finalSamples = normalizeThroughputSamples(
          result.throughput_samples,
        );

        if (useKvCache) {
          setKvCacheOnSamples(finalSamples);
        } else {
          setKvCacheOffSamples(finalSamples);
        }

        setHasResults(true);

        setStatus("complete");

        /* -------------------------------------------------------------- */
        /* History                                                        */
        /* -------------------------------------------------------------- */

        const run: BenchmarkRun = {
           id: result.id ?? fallbackIdRef.current--,

          requests:
            result.total_runs,

          concurrency: 1,

          inputLen:
            result.average_input_tokens,

          outputLen:
            result.average_output_tokens,

          throughput:
            result.average_tokens_per_second,

          ttft:
            result.average_ttft,

          latency:
            result.average_generation_time,

          kvCache: useKvCache,
        };

        setRuns((current) => [
          run,
          ...current,
        ]);
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException &&
            error.name ===
              "AbortError")
        ) {
          return;
        }

        setStatus("error");

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Benchmark request failed",
        );
      } finally {
        if (
          abortRef.current ===
          controller
        ) {
          abortRef.current = null;
        }
      }
    },
    [config, useKvCache],
  );

  /* ---------------------------------------------------------------------- */
  /* Cancel                                                                  */
  /* ---------------------------------------------------------------------- */

  const handleCancel =
    useCallback(() => {
      abortRef.current?.abort();

      abortRef.current = null;

      setStatus("stopped");

      setResults(
        EMPTY_RESULTS,
      );

      setHasResults(false);

      setSamples([]);

      setCurrentRun(0);
      setTotalRuns(0);
    }, []);

  const handleDeleteRun =
     useCallback((runId: number) => {
    const removedRun = runs.find((run) => run.id === runId);

    setRuns((current) =>
      current.filter((run) => run.id !== runId)
    );

    if (runId < 0) {
      return;
    }

    void deleteBenchmarkResult(runId, token).catch((error) => {
      console.error("Failed to delete run:", error);

      if (removedRun) {
        setRuns((current) => [removedRun, ...current]);
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete benchmark run",
      );
    });
  }, [runs, token]);

  const handleClearGroup =
  useCallback((kvCache: boolean) => {
    const toRemove = runs.filter((run) => run.kvCache === kvCache);

    setRuns((current) =>
      current.filter((run) => run.kvCache !== kvCache)
    );

    const deletable = toRemove.filter((run) => run.id >= 0);

    void Promise.allSettled(
      deletable.map((run) => deleteBenchmarkResult(run.id, token)),
    ).then((outcomes) => {
      const failed = outcomes
        .map((outcome, index) => ({ outcome, run: deletable[index] }))
        .filter(({ outcome }) => outcome.status === "rejected");

      if (failed.length > 0) {
        setRuns((current) => [
          ...failed.map(({ run }) => run),
          ...current,
        ]);

        setErrorMessage(
          `Failed to delete ${failed.length} of ${deletable.length} runs`,
        );
      }
    });
  }, [runs, token]);
  /* ---------------------------------------------------------------------- */
  /* Run / cancel button                                                    */
  /* ---------------------------------------------------------------------- */

  const handleRunClick =
    () => {
      if (
        status === "running"
      ) {
        handleCancel();
      } else {
        void handleRun();
      }
    };

  /* ---------------------------------------------------------------------- */
  /* Formatting                                                              */
  /* ---------------------------------------------------------------------- */

  const format = (
    value: number,
    digits: number,
  ) =>
    hasResults
      ? value.toFixed(digits)
      : "--";

  const progressLabel =
    status === "running"
      ? currentRun > 0
        ? `Run ${currentRun}/${totalRuns}`
        : `Starting run 1 of ${config.runs}`
      : status === "complete"
        ? "Benchmark complete"
        : status === "stopped"
          ? "Benchmark stopped"
          : status === "error"
            ? "Benchmark failed"
            : "Ready to benchmark";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <TensorServeStarfield />

      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}

      <Reveal>
        <header className="border-b border-border">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />

                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Performance / Evaluation
                </span>
              </div>

              <h1 className="text-[14.5px] font-semibold tracking-tight">
                Benchmark Lab
              </h1>

              <p className="text-[11.5px] text-muted-foreground">
                Test inference performance under controlled workloads.
              </p>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status === "error"
                      ? "bg-destructive"
                      : status === "running"
                        ? "animate-pulse bg-primary"
                        : status === "stopped"
                          ? "bg-muted-foreground"
                          : "bg-success"
                  }`}
                />

                {status === "running"
                  ? "Benchmark Running"
                  : status === "error"
                    ? "Backend Error"
                    : status === "stopped"
                      ? "Benchmark Stopped"
                      : "Engine Ready"}
              </div>
            </div>
          </div>
        </header>
      </Reveal>

      {/* ---------------------------------------------------------------- */}
      {/* Main                                                             */}
      {/* ---------------------------------------------------------------- */}

      <Reveal>
        <main className="relative z-[1] px-4 py-4">

          {/* ============================================================ */}
          {/* Configuration + Engine                                      */}
          {/* ============================================================ */}

          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">

            {/* ---------------------------------------------------------- */}
            {/* Configuration                                              */}
            {/* ---------------------------------------------------------- */}

            <Panel
              title="Benchmark Configuration"
              right={
                <span className="font-mono text-[10px] text-muted-foreground">
                  POST /benchmark/
                </span>
              }
            >
              <div className="grid gap-0 lg:grid-cols-2">

                {/* Model / runs */}
                <div className="border-b border-border p-5 lg:border-r">
                  <div className="mb-5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Loaded Model
                      </p>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        Backend
                      </span>
                    </div>

                    <div className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2 font-mono text-xs text-foreground">
                        <Layers className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{modelName}</span>
                      </span>

                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <NumberField
                      label="Runs"
                      value={config.runs}
                      onChange={(value) =>
                        setField(
                          "runs",
                          value,
                        )
                      }
                      min={1}
                      max={100}
                      disabled={
                        status ===
                        "running"
                      }
                    />

                    <NumberField
                      label="Temperature"
                      value={
                        config.temperature
                      }
                      onChange={(value) =>
                        setField(
                          "temperature",
                          value,
                        )
                      }
                      min={0}
                      max={2}
                      step={0.1}
                      disabled={
                        status ===
                        "running"
                      }
                    />
                  </div>
                </div>

                {/* Input / output / KV */}
                <div className="p-5">
                  <div className="space-y-1">
                    <NumberField
                      label="Input Length"
                      value={
                        config.inputLen
                      }
                      onChange={(value) =>
                        setField(
                          "inputLen",
                          value,
                        )
                      }
                      min={1}
                      max={32000}
                      suffix="tokens"
                      disabled={
                        status ===
                        "running"
                      }
                    />

                    <NumberField
                      label="Output Length"
                      value={
                        config.outputLen
                      }
                      onChange={(value) =>
                        setField(
                          "outputLen",
                          value,
                        )
                      }
                      min={1}
                      max={32000}
                      suffix="tokens"
                      disabled={
                        status ===
                        "running"
                      }
                    />

                    <div className="mt-3 border-t border-border pt-3">
                      <Toggle
                        label="KV Cache"
                        checked={
                          useKvCache
                        }
                        onChange={
                          setUseKvCache
                        }
                        disabled={
                          status ===
                          "running"
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Run button */}
              <div className="border-t border-border px-5 py-4">
                <button
                  type="button"
                  onClick={
                    handleRunClick
                  }
                  className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition ${
                    status ===
                    "running"
                      ? "bg-secondary text-foreground hover:bg-elevated"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {status ===
                  "running" ? (
                    <>
                      <Square className="h-3.5 w-3.5" />

                      Cancel Benchmark
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />

                      Run Benchmark
                    </>
                  )}
                </button>
              </div>
            </Panel>

            {/* ---------------------------------------------------------- */}
            {/* Engine                                                      */}
            {/* ---------------------------------------------------------- */}

            <Panel
              title="Current Engine"
              className="h-fit"
            >
              <div className="divide-y divide-border">

                <EngineRow
                  label="Model"
                  value={modelName}
                  icon={
                    <Layers className="h-3.5 w-3.5" />
                  }
                />

                <EngineRow
                  label="Device"
                  value={engineDevice === "cuda" ? "CUDA (GPU)" : engineDevice ? engineDevice.toUpperCase() : "Backend"}
                  icon={
                    <Cpu className="h-3.5 w-3.5" />
                  }
                />

                <EngineRow
                  label="Status"
                  value={
                    status ===
                    "running"
                      ? "Running"
                      : status ===
                          "error"
                        ? "Error"
                        : status ===
                            "stopped"
                          ? "Stopped"
                          : "Ready"
                  }
                  status={status}
                />

                <EngineRow
                  label="KV Cache"
                  value={
                    useKvCache
                      ? "Enabled"
                      : "Disabled"
                  }
                />

              </div>
            </Panel>
          </div>

          {/* ============================================================ */}
          {/* Progress                                                      */}
          {/* ============================================================ */}

          <Panel
            title="Benchmark Progress"
            className="mt-5"
          >
            <div className="p-5">

              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {progressLabel}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {status ===
                    "running"
                      ? currentRun > 0
                        ? `Executing run ${currentRun} of ${totalRuns}`
                        : `${config.runs} benchmark runs in progress`
                      : status ===
                          "complete"
                        ? `${config.runs} runs completed`
                        : `${config.runs} runs with a max output of ${config.outputLen} tokens`}
                  </p>
                </div>

                <span className="font-mono text-xs text-muted-foreground">
                  {status ===
                  "complete"
                    ? "100%"
                    : status ===
                        "running"
                      ? currentRun > 0 && totalRuns > 0
                        ? `${Math.round((currentRun / totalRuns) * 100)}%`
                        : "RUNNING"
                      : "--"}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                {status === "running" ? (
                  <div
                    className="h-full rounded-full transition-all duration-300 bg-primary"
                    style={{
                      width: currentRun > 0 && totalRuns > 0
                        ? `${(currentRun / totalRuns) * 100}%`
                        : "5%",
                      animation: currentRun === 0 ? "pulse 1.5s infinite" : undefined,
                    }}
                  />
                ) : (
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      status === "complete"
                        ? "w-full bg-success"
                        : "w-0"
                    }`}
                  />
                )}
              </div>

              {errorMessage && (
                <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
                  {errorMessage}
                </p>
              )}
            </div>
          </Panel>

          {/* ============================================================ */}
          {/* Results                                                       */}
          {/* ============================================================ */}

          <Panel
            title="Results"
            className="mt-5"
          >
            <div className="flex flex-wrap divide-y divide-border sm:divide-x sm:divide-y-0">

              <Metric
                icon={Gauge}
                label="Throughput"
                value={format(
                  results.throughput,
                  0,
                )}
                unit="tok/s"
              />

              <Metric
                icon={Timer}
                label="Avg TTFT"
                value={format(
                  results.avgTtft,
                  0,
                )}
                unit="ms"
              />

              <Metric
                icon={Activity}
                label="Generation Time"
                value={format(
                  results.avgLatency,
                  2,
                )}
                unit="sec"
              />

              <Metric
                icon={Database}
                label="Output Tokens"
                value={format(
                  results.outputTokens,
                  0,
                )}
                unit="avg"
              />
            </div>
          </Panel>

          {/* ============================================================ */}
          {/* Run Summary                                                  */}
          {/* ============================================================ */}

          <Panel
            title="Run Summary"
            className="mt-5"
          >
            <div className="flex flex-wrap divide-y divide-border sm:divide-x sm:divide-y-0">

              <Metric
                icon={Zap}
                label="Successful"
                value={
                  hasResults
                    ? String(
                        results.successfulRuns,
                      )
                    : "--"
                }
              />

              <Metric
                icon={Activity}
                label="Failed"
                value={
                  hasResults
                    ? String(
                        results.failedRuns,
                      )
                    : "--"
                }
              />

              <Metric
                icon={Database}
                label="Input Tokens"
                value={format(
                  results.inputTokens,
                  0,
                )}
                unit="avg"
              />

              <Metric
                icon={Database}
                label="Output Tokens"
                value={format(
                  results.outputTokens,
                  0,
                )}
                unit="avg"
              />
            </div>
          </Panel>

          {/* ============================================================ */}
          {/* System Metrics                                               */}
          {/* ============================================================ */}

          <Panel
            title="Peak System Metrics"
            className="mt-5"
          >
            <div className="flex flex-wrap divide-y divide-border sm:divide-x sm:divide-y-0">

              <Metric
                icon={Cpu}
                label="GPU Utilization"
                value={format(
                  results.peakGpuUtilizationPercent,
                  1,
                )}
                unit="%"
              />

              <Metric
                icon={Database}
                label="GPU Memory"
                value={format(
                  results.peakGpuMemoryUsedMb,
                  0,
                )}
                unit="MB"
              />

              <Metric
                icon={Activity}
                label="GPU Temperature"
                value={format(
                  results.peakGpuTemperatureC,
                  1,
                )}
                unit="°C"
              />

              <Metric
                icon={Zap}
                label="GPU Power"
                value={format(
                  results.peakGpuPowerUsageW,
                  1,
                )}
                unit="W"
              />

              <Metric
                icon={Database}
                label="RAM Usage"
                value={format(
                  results.peakRamPercent,
                  1,
                )}
                unit="%"
              />

              <Metric
                icon={Database}
                label="RAM Used"
                value={format(
                  results.peakRamUsedMb,
                  0,
                )}
                unit="MB"
              />
            </div>
          </Panel>

          {/* ============================================================ */}
          {/* Throughput                                                   */}
          {/* ============================================================ */}

          <Panel
            title="Throughput Over Time"
            className="mt-5"
            right={
              kvCacheOnSamples.length +
                kvCacheOffSamples.length >
              0 ? (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {kvCacheOnSamples.length +
                    kvCacheOffSamples.length}{" "}
                  samples
                </span>
              ) : null
            }
          >
            <ThroughputChart
              kvCacheOnSamples={kvCacheOnSamples}
              kvCacheOffSamples={kvCacheOffSamples}
            />
          </Panel>

          {/* ============================================================ */}
          {/* Runs                                                         */}
          {/* ============================================================ */}

          <Panel
            title="Benchmark Runs"
            className="mt-5"
            right={
              <History className="h-3.5 w-3.5 text-muted-foreground" />
            }
          >
            {runs.length ===
            0 ? (
              <div className="flex min-h-36 items-center justify-center">
                <div className="text-center">
                  <History className="mx-auto mb-3 h-6 w-6 text-muted-foreground/30" />

                  <p className="font-mono text-xs text-muted-foreground">
                    No benchmark runs yet.
                  </p>

                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    Run a benchmark to create a result.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* KV Cache ON */}
                {runs.filter(run => run.kvCache).length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        <h3 className="text-xs font-semibold text-foreground">
                          KV Cache ON
                        </h3>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          ({runs.filter(run => run.kvCache).length} runs)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleClearGroup(true)}
                        className="text-[10px] text-muted-foreground transition hover:text-destructive"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] border-collapse">
                        <thead>
                          <tr className="border-b border-border text-left">
                            {[
                              "Run",
                              "Requests",
                              "Concurrency",
                              "Input",
                              "Output",
                              "Throughput",
                              "TTFT",
                              "Generation",
                              "",
                            ].map(
                              (heading) => (
                                <th
                                  key={heading}
                                  className="px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                                >
                                  {heading}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {runs.filter(run => run.kvCache).map((run) => (
                            <tr
                              key={run.id}
                              className="border-b border-border/60 last:border-0"
                            >
                              <td className="px-4 py-3 font-mono text-xs text-foreground">
                                #{String(run.id).padStart(3, "0")}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {run.requests}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {run.concurrency}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {Math.round(run.inputLen)}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {Math.round(run.outputLen)}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                                {run.throughput.toFixed(1)}{" "}
                                <span className="text-muted-foreground">
                                  tok/s
                                </span>
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {run.ttft.toFixed(0)} ms
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {run.latency.toFixed(2)} s
                              </td>

                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRun(run.id)}
                                  className="text-muted-foreground transition hover:text-destructive"
                                  title="Delete run"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* KV Cache OFF */}
                {runs.filter(run => !run.kvCache).length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                        <h3 className="text-xs font-semibold text-foreground">
                          KV Cache OFF
                        </h3>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          ({runs.filter(run => !run.kvCache).length} runs)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleClearGroup(false)}
                        className="text-[10px] text-muted-foreground transition hover:text-destructive"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] border-collapse">
                        <thead>
                          <tr className="border-b border-border text-left">
                            {[
                              "Run",
                              "Requests",
                              "Concurrency",
                              "Input",
                              "Output",
                              "Throughput",
                              "TTFT",
                              "Generation",
                              "",
                            ].map(
                              (heading) => (
                                <th
                                  key={heading}
                                  className="px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                                >
                                  {heading}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {runs.filter(run => !run.kvCache).map((run) => (
                            <tr
                              key={run.id}
                              className="border-b border-border/60 last:border-0"
                            >
                              <td className="px-4 py-3 font-mono text-xs text-foreground">
                                #{String(run.id).padStart(3, "0")}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {run.requests}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {run.concurrency}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {Math.round(run.inputLen)}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {Math.round(run.outputLen)}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                                {run.throughput.toFixed(1)}{" "}
                                <span className="text-muted-foreground">
                                  tok/s
                                </span>
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {run.ttft.toFixed(0)} ms
                              </td>

                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {run.latency.toFixed(2)} s
                              </td>

                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRun(run.id)}
                                  className="text-muted-foreground transition hover:text-destructive"
                                  title="Delete run"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </main>
      </Reveal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Engine row                                                                 */
/* -------------------------------------------------------------------------- */

function EngineRow({
  label,
  value,
  icon,
  status,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  status?: BenchmarkStatus;
}) {
  const statusClass =
    status === "error"
      ? "text-destructive"
      : status === "running"
        ? "text-primary"
        : status === "stopped"
          ? "text-muted-foreground"
          : "text-success";

  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-xs text-muted-foreground">
        {label}
      </span>

      <span
        className={`flex items-center gap-2 font-mono text-xs ${
          status
            ? statusClass
            : "text-foreground/90"
        }`}
      >
        {status && (
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "error"
                ? "bg-destructive"
                : status ===
                    "running"
                  ? "animate-pulse bg-primary"
                  : status ===
                      "stopped"
                    ? "bg-muted-foreground"
                    : "bg-success"
            }`}
          />
        )}

        {icon && (
          <span className="text-muted-foreground">
            {icon}
          </span>
        )}

        {value}
      </span>
    </div>
  );
}