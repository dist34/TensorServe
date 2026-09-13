import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Square,
  Copy,
  Check,
  Info,
  Layers,
  Timer,
  Gauge,
  Activity,
  ChevronRight,
  Circle,
  CircleDot,
  CheckCircle2,
} from "lucide-react";
import { useModelInfo } from "@/lib/hooks/use-model-info";

/* -------------------------------------------------------------------------- */
/* Backend contracts                                                          */
/* -------------------------------------------------------------------------- */

interface GenerateRequest {
  prompt: string;
  max_new_tokens: number;
  temperature: number;
  do_sample: boolean;
  use_kv_cache: boolean;
}

interface GenerateResponse {
  response: string;
  input_tokens: number;
  output_tokens: number;
  generation_time: number;
  tokens_per_second: number;
  ttft?: number;
}

interface StreamTokenEvent {
  type: "token";
  text: string;
}

interface StreamCompleteEvent {
  type: "complete";
  input_tokens: number;
  output_tokens: number;
  generation_time: number;
  tokens_per_second: number;
  ttft?: number;
}

type StreamEvent = StreamTokenEvent | StreamCompleteEvent;

type Status =
  | "idle"
  | "generating"
  | "complete"
  | "stopped"
  | "error";

interface Metrics {
  ttft: number;
  throughput: number;
  tpot: number;
  latency: number;
  inputTokens: number;
  outputTokens: number;
}

const EMPTY_METRICS: Metrics = {
  ttft: 0,
  throughput: 0,
  tpot: 0,
  latency: 0,
  inputTokens: 0,
  outputTokens: 0,
};

const PIPELINE_STAGES = [
  "Queued",
  "Prefill",
  "Decode",
  "Complete",
] as const;

const API_URL =
  (import.meta as ImportMeta & {
    env: { VITE_API_URL?: string };
  }).env.VITE_API_URL ||
  "http://127.0.0.1:8000";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clamp(
  value: number,
  min: number,
  max: number,
) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function estimateTokens(text: string) {
  return Math.max(
    0,
    Math.round(text.trim().length / 4),
  );
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

function Panel({
  title,
  right,
  className = "",
  bodyClassName = "",
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-border bg-card ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {title}
          </h2>

          {right}
        </div>
      )}

      <div className={bodyClassName}>
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Field label                                                                */
/* -------------------------------------------------------------------------- */

function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative flex items-center gap-1">
      <span className="text-[12px] text-foreground/90">
        {label}
      </span>

      {hint && (
        <span
          className="text-muted-foreground/70"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        >
          <Info className="h-3 w-3" />

          {show && (
            <span className="absolute left-0 top-5 z-20 w-52 rounded-md border border-border bg-popover p-2 text-[11px] leading-snug text-popover-foreground/80 shadow-lg">
              {hint}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Temperature                                                               */
/* -------------------------------------------------------------------------- */

function SliderField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1.5 flex items-center justify-between">
        <FieldLabel label={label} hint={hint} />

        <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-primary">
          {value.toFixed(2)}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(
            clamp(
              Number(event.target.value),
              min,
              max,
            ),
          )
        }
        className="h-[3px] w-full cursor-pointer accent-primary"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Number field                                                               */
/* -------------------------------------------------------------------------- */

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <FieldLabel label={label} hint={hint} />

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);

          if (Number.isNaN(next)) return;

          onChange(
            clamp(
              Math.round(next),
              min,
              max ?? Number.MAX_SAFE_INTEGER,
            ),
          );
        }}
        className="w-[76px] rounded-md border border-border bg-background px-2 py-1 text-right font-mono text-[12px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toggle                                                                     */
/* -------------------------------------------------------------------------- */

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <FieldLabel label={label} hint={hint} />

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[17px] w-[30px] shrink-0 overflow-hidden rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-secondary"
        }`}
      >
        <span
          className={`absolute left-[2px] top-[2px] h-[13px] w-[13px] rounded-full bg-primary-foreground transition-transform ${
            checked ? "translate-x-[15px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                    */
/* -------------------------------------------------------------------------- */

function MetricBlock({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ComponentType<{
    className?: string;
    strokeWidth?: string | number;
  }>;
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5">
      <Icon
        className="h-3.5 w-3.5 shrink-0 text-primary"
        strokeWidth={1.75}
      />

      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </span>

        <span className="tabular text-[13px] text-foreground">
          {value}

          {unit && (
            <span className="ml-0.5 text-muted-foreground">
              {unit}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pipeline                                                                   */
/* -------------------------------------------------------------------------- */

function PipelineStep({
  label,
  status,
  isLast,
}: {
  label: string;
  status: "done" | "active" | "pending";
  isLast: boolean;
}) {
  const Icon =
    status === "done"
      ? CheckCircle2
      : status === "active"
        ? CircleDot
        : Circle;

  const color =
    status === "done"
      ? "text-success"
      : status === "active"
        ? "text-primary"
        : "text-muted-foreground/60";

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        <Icon
          className={`h-3.5 w-3.5 ${color} ${
            status === "active"
              ? "animate-pulse"
              : ""
          }`}
          strokeWidth={2}
        />

        <span
          className={`text-[12px] ${
            status === "pending"
              ? "text-muted-foreground/60"
              : "text-foreground/90"
          }`}
        >
          {label}
        </span>
      </div>

      {!isLast && (
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Playground                                                                 */
/* -------------------------------------------------------------------------- */

export default function PlaygroundContent() {
  const { modelName } = useModelInfo();
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");

  const [status, setStatus] =
    useState<Status>("idle");

  const [stageIndex, setStageIndex] =
    useState(-1);

  const [copied, setCopied] =
    useState(false);

  const [temperature, setTemperature] =
    useState(0.7);

  const [maxTokens, setMaxTokens] =
    useState(256);

  const [doSample, setDoSample] =
    useState(true);

  const [useKvCache, setUseKvCache] =
    useState(true);

  const [streaming, setStreaming] =
    useState(true);

  const [metrics, setMetrics] =
    useState<Metrics>(EMPTY_METRICS);

  const [requestId, setRequestId] =
    useState<number | null>(null);

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const copiedTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputTokenEstimate =
    estimateTokens(prompt);

  /* ---------------------------------------------------------------------- */
  /* Cleanup                                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();

      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Backend generation                                                     */
  /* ---------------------------------------------------------------------- */

  const handleStart = useCallback(async () => {
    if (!prompt.trim()) return;

    abortControllerRef.current?.abort();

    const controller = new AbortController();

    abortControllerRef.current = controller;

    setOutput("");
    setStatus("generating");
    setStageIndex(0);
    setCopied(false);

    setMetrics({
      ...EMPTY_METRICS,
      inputTokens: inputTokenEstimate,
    });

    setRequestId(
      (current) => (current ?? 0) + 1,
    );

    const request: GenerateRequest = {
      prompt: prompt.trim(),
      max_new_tokens: maxTokens,
      temperature,
      do_sample: doSample,
      use_kv_cache: useKvCache,
    };

    const startTime =
      performance.now();

    try {
      const endpoint = streaming
        ? `${API_URL}/generate/stream`
        : `${API_URL}/generate/`;

      const response = await fetch(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(
          `Generation failed (${response.status})`,
        );
      }

      /* -------------------------------------------------------------- */
      /* Streaming                                                       */
      /* -------------------------------------------------------------- */

      if (streaming) {
        if (!response.body) {
          throw new Error(
            "Streaming response body is unavailable.",
          );
        }

        setStageIndex(1);

        const reader =
          response.body.getReader();

        const decoder =
          new TextDecoder();

        let buffer = "";
        let outputText = "";

        setStageIndex(2);

        while (true) {
          const { value, done } =
            await reader.read();

          if (done) break;

          buffer += decoder.decode(
            value,
            { stream: true },
          );

          const lines =
            buffer.split("\n");

          buffer =
            lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;

            let event: StreamEvent;

            try {
              event =
                JSON.parse(line);
            } catch {
              continue;
            }

            if (
              event.type ===
              "token"
            ) {
              outputText += event.text;

              setOutput(outputText);

              const elapsed =
                (performance.now() -
                  startTime) /
                1000;

              setMetrics((current) => ({
                ...current,
                latency: elapsed,
              }));
            }

            if (
              event.type ===
              "complete"
            ) {
              setStageIndex(3);

              const outputTokens =
                event.output_tokens;

              const generationTime =
                event.generation_time;

              setMetrics({
                ttft:
                  event.ttft ?? 0,
                throughput:
                  event.tokens_per_second,
                tpot:
                  outputTokens > 0
                    ? (generationTime *
                        1000) /
                      outputTokens
                    : 0,
                latency:
                  generationTime,
                inputTokens:
                  event.input_tokens,
                outputTokens,
              });

              setStatus("complete");
            }
          }
        }

        setStageIndex(3);
        setStatus((current) =>
          current === "generating"
            ? "complete"
            : current,
        );

        return;
      }

      /* -------------------------------------------------------------- */
      /* Non-streaming                                                   */
      /* -------------------------------------------------------------- */

      setStageIndex(1);

      const data =
        (await response.json()) as GenerateResponse;

      setStageIndex(2);

      setOutput(data.response);

      setStageIndex(3);

      setMetrics({
        ttft: data.ttft ?? 0,
        throughput:
          data.tokens_per_second,
        tpot:
          data.output_tokens > 0
            ? (data.generation_time *
                1000) /
              data.output_tokens
            : 0,
        latency:
          data.generation_time,
        inputTokens:
          data.input_tokens,
        outputTokens:
          data.output_tokens,
      });

      setStatus("complete");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error(error);

      setStatus("error");
    }
  }, [
    prompt,
    maxTokens,
    temperature,
    doSample,
    useKvCache,
    streaming,
    inputTokenEstimate,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Stop                                                                   */
  /* ---------------------------------------------------------------------- */

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    setStatus("stopped");
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Generate / Stop                                                       */
  /* ---------------------------------------------------------------------- */

  const handleGenerateClick = () => {
    if (status === "generating") {
      handleStop();
    } else {
      handleStart();
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Clear                                                                   */
  /* ---------------------------------------------------------------------- */

  const handleClearSession = () => {
    abortControllerRef.current?.abort();

    abortControllerRef.current = null;

    setPrompt("");
    setOutput("");
    setStatus("idle");
    setStageIndex(-1);
    setMetrics(EMPTY_METRICS);
    setRequestId(null);
    setCopied(false);
  };

  /* ---------------------------------------------------------------------- */
  /* Copy                                                                    */
  /* ---------------------------------------------------------------------- */

  const handleCopy = async () => {
    if (!output) return;

    try {
      await navigator.clipboard.writeText(
        output,
      );

      setCopied(true);

      if (copiedTimeoutRef.current) {
        clearTimeout(
          copiedTimeoutRef.current,
        );
      }

      copiedTimeoutRef.current =
        setTimeout(() => {
          setCopied(false);
        }, 1400);
    } catch {
      // Clipboard failure is non-fatal.
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Pipeline status                                                        */
  /* ---------------------------------------------------------------------- */

  const stageStatus = (
    index: number,
  ): "done" | "active" | "pending" => {
    if (stageIndex === -1) {
      return "pending";
    }

    if (index < stageIndex) {
      return "done";
    }

    if (index === stageIndex) {
      if (
        status === "complete" &&
        index === 3
      ) {
        return "done";
      }

      return "active";
    }

    return "pending";
  };

  const statusConfig = {
    idle: {
      label: "Idle",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },

    generating: {
      label: "Generating",
      text: "text-primary",
      dot: "bg-primary",
    },

    complete: {
      label: "Complete",
      text: "text-success",
      dot: "bg-success",
    },

    stopped: {
      label: "Stopped",
      text: "text-warning",
      dot: "bg-warning",
    },

    error: {
      label: "Error",
      text: "text-destructive",
      dot: "bg-destructive",
    },
  }[status];

  /* ---------------------------------------------------------------------- */
  /* UI                                                                      */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <style>{`
        @keyframes blink-caret {
          0%, 45% { opacity: 1; }
          50%, 95% { opacity: 0; }
          100% { opacity: 1; }
        }

        .blink-caret {
          animation: blink-caret 1s steps(1) infinite;
        }

        .inferx-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .inferx-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 4px;
        }

        .inferx-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>

      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}

      <header className="flex min-h-[56px] items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />

            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Playground / Inference
            </span>
          </div>

          <h1 className="text-[15px] font-semibold tracking-tight">
            Playground
          </h1>

          <p className="text-[11px] text-muted-foreground">
            Test model generation and inference performance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 font-mono text-[11px]">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>{modelName}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live
          </div>

          <button
            type="button"
            onClick={handleClearSession}
            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-[11px] transition-colors hover:border-border-strong"
          >
            Clear Session
          </button>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Main                                                              */}
      {/* ---------------------------------------------------------------- */}

      <main className="p-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[7fr_3fr]">

          {/* ============================================================ */}
          {/* LEFT 70%                                                      */}
          {/* ============================================================ */}

          <div className="flex min-w-0 flex-col gap-4">

            {/* Prompt */}
            <Panel
              title="Prompt"
              bodyClassName="p-3.5"
            >
              <textarea
                value={prompt}
                onChange={(event) =>
                  setPrompt(
                    event.target.value,
                  )
                }
                rows={5}
                className="inferx-scrollbar w-full resize-none rounded-md border border-border bg-background p-3 font-mono text-[12.5px] leading-relaxed outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-ring"
              />

              <div className="mt-2.5 flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Input Tokens:{" "}
                  {inputTokenEstimate}
                </span>

                <button
                  type="button"
                  onClick={
                    handleGenerateClick
                  }
                  disabled={
                    status !==
                      "generating" &&
                    !prompt.trim()
                  }
                  className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    status ===
                    "generating"
                      ? "bg-secondary hover:bg-elevated"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {status ===
                  "generating" ? (
                    <>
                      <Square className="h-3 w-3" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </Panel>

            {/* Output */}
            <Panel
              title="Generated Output"
              right={
                <div className="flex items-center gap-3">
                  <span
                    className={`flex items-center gap-1.5 text-[11px] ${statusConfig.text}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot} ${
                        status ===
                        "generating"
                          ? "animate-pulse"
                          : ""
                      }`}
                    />

                    {statusConfig.label}
                  </span>

                  <span className="font-mono text-[11px] text-muted-foreground">
                    Output Tokens:{" "}
                    {metrics.outputTokens}
                  </span>

                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!output}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                    title="Copy output"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              }
            >
              <div className="inferx-scrollbar min-h-[220px] max-h-[420px] overflow-y-auto p-3.5">
                {status ===
                "error" ? (
                  <p className="font-mono text-[12px] text-destructive">
                    Generation failed. Check that the TensorServe backend is running.
                  </p>
                ) : output ? (
                  <p className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-foreground/85">
                    {output}

                    {status ===
                      "generating" && (
                      <span className="blink-caret ml-0.5 inline-block h-[13px] w-[7px] translate-y-[1px] bg-primary align-middle" />
                    )}
                  </p>
                ) : (
                  <p className="font-mono text-[12px] text-muted-foreground/70">
                    Output will stream here once generation starts.
                  </p>
                )}
              </div>
            </Panel>
          </div>

          {/* ============================================================ */}
          {/* RIGHT 30%                                                     */}
          {/* ============================================================ */}

          <Panel
            title="Generation Settings"
            className="h-fit"
            bodyClassName="p-3.5"
          >
            <SliderField
              label="Temperature"
              hint="Controls randomness during token sampling."
              value={temperature}
              onChange={setTemperature}
              min={0}
              max={2}
              step={0.01}
            />

            <NumberField
              label="Max Tokens"
              hint="Maximum number of new tokens generated by the backend."
              value={maxTokens}
              onChange={setMaxTokens}
              min={1}
              max={4096}
            />

            <div className="my-2 h-px bg-border" />

            <Toggle
              label="Sampling"
              hint="Maps directly to the backend do_sample generation option."
              checked={doSample}
              onChange={setDoSample}
            />

            <Toggle
              label="KV Cache"
              hint="Reuses previously computed attention key/value states during generation to reduce repeated computation."
              checked={useKvCache}
              onChange={setUseKvCache}
            />

            <Toggle
              label="Streaming"
              hint="Uses TensorServe POST /generate/stream when enabled."
              checked={streaming}
              onChange={setStreaming}
            />

            <div className="mt-3 border-t border-border pt-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Endpoint
              </p>

              <p className="mt-1 font-mono text-[11px] text-primary">
                {streaming
                  ? "POST /generate/stream"
                  : "POST /generate/"}
              </p>
            </div>
          </Panel>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Inference metrics                                                 */}
        {/* ---------------------------------------------------------------- */}

        <Panel
          title="Inference Metrics"
          className="mt-4"
          bodyClassName="flex flex-wrap divide-x divide-border"
        >
          <MetricBlock
            icon={Timer}
            label="TTFT"
            value={metrics.ttft.toFixed(0)}
            unit="ms"
          />

          <MetricBlock
            icon={Gauge}
            label="Throughput"
            value={metrics.throughput.toFixed(1)}
            unit="tok/s"
          />

          <MetricBlock
            icon={Activity}
            label="TPOT"
            value={metrics.tpot.toFixed(1)}
            unit="ms"
          />

          <MetricBlock
            icon={Timer}
            label="Total Latency"
            value={metrics.latency.toFixed(2)}
            unit="s"
          />

          <MetricBlock
            icon={Layers}
            label="Input Tokens"
            value={metrics.inputTokens}
          />

          <MetricBlock
            icon={Layers}
            label="Output Tokens"
            value={metrics.outputTokens}
          />

          <MetricBlock
            icon={Activity}
            label="Request"
            value={
              requestId
                ? `#${requestId}`
                : "—"
            }
          />
        </Panel>

        {/* ---------------------------------------------------------------- */}
        {/* Request pipeline                                                  */}
        {/* ---------------------------------------------------------------- */}

        <Panel
          title="Request Pipeline"
          className="mt-4"
          bodyClassName="p-3.5"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            {PIPELINE_STAGES.map(
              (stage, index) => (
                <PipelineStep
                  key={stage}
                  label={stage}
                  status={stageStatus(
                    index,
                  )}
                  isLast={
                    index ===
                    PIPELINE_STAGES.length -
                      1
                  }
                />
              ),
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
            <span>
              Request{" "}
              <span className="text-foreground/90">
                {requestId
                  ? `#${requestId}`
                  : "—"}
              </span>
            </span>

            <span>
              Endpoint{" "}
              <span className="text-foreground/90">
                {streaming
                  ? "/generate/stream"
                  : "/generate/"}
              </span>
            </span>

            <span>
              Mode{" "}
              <span className="text-foreground/90">
                {streaming
                  ? "Streaming"
                  : "Complete"}
              </span>
            </span>
          </div>
        </Panel>
      </main>
    </div>
  );
}