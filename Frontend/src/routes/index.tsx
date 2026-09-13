import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { TensorServeOrb } from "@/components/inferx/tensorserve-orb";
import { TensorServeStarfield } from "@/components/inferx/tensorserve-starfield";
import {
  Reveal,
  StaggerGrid,
  StaggerItem,
  WordReveal,
} from "@/components/inferx/home-animations";
import { useAuth } from "@/contexts/auth-context";
import { AuthMenu } from "@/components/inferx/auth-menu";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "TensorServe — Measure. Optimize. Serve.",
      },
      {
        name: "description",
        content:
          "LLM inference, benchmarking and observability platform for understanding model performance.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleLaunchPlayground = () => {
    if (isAuthenticated) {
      navigate({ to: "/playground" });
    } else {
      navigate({ to: "/login" });
    }
  };

  return (
    <main className="ts-page">
      <header className="ts-nav">
        <Link to="/" className="ts-brand">
          <span className="flex h-[18px] w-[18px] shrink-0 items-end justify-center gap-[2px]" aria-hidden="true">
            <span className="block h-[8px] w-[3px] rounded-[1px] bg-[var(--ts-blue)] opacity-60" />
            <span className="block h-[15px] w-[3px] rounded-[1px] bg-[var(--ts-blue)] opacity-85" />
            <span className="block h-[11px] w-[3px] rounded-[1px] bg-[var(--ts-blue)]" />
          </span>
          <span>TensorServe</span>
        </Link>

        <nav className="ts-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#benchmarking">Benchmarking</a>
          <a href="#optimization">Optimization</a>
          <a href="#developers">Documentation</a>
        </nav>

        <div className="ts-nav-actions">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="ts-github">
            GitHub
            <ArrowUpRight size={12} />
          </a>
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="ts-nav-cta">
                Log in
              </Link>
              <button 
                onClick={() => navigate({ to: '/login', search: { mode: 'register' } })}
                className="ts-nav-cta ts-nav-cta-secondary"
              >
                Sign up
              </button>
            </>
          ) : (
            <AuthMenu variant="nav" />
          )}
        </div>
      </header>

      <section className="ts-hero">
        <TensorServeStarfield />

        <div className="ts-hero-copy">
          <div className="ts-eyebrow">
            <span className="ts-live-dot" />
            LLM INFRASTRUCTURE
            <span className="ts-eyebrow-divider">/</span>
            PERFORMANCE
          </div>

          <h1>
            Measure.
            <br />
            Optimize.
            <br />
            <em>Serve.</em>
          </h1>

          <p className="ts-hero-subtitle">
            An inference platform built to understand how your LLM actually performs.
          </p>
          <p className="ts-hero-description">
            Run, benchmark and monitor LLM inference — from token latency and throughput to GPU memory and system utilization.
          </p>

          <div className="ts-hero-actions">
            <button
              type="button"
              onClick={handleLaunchPlayground}
              className="ts-button ts-button-primary"
            >
              Launch Playground
              <ArrowUpRight size={14} />
            </button>
            <a href="#benchmarking" className="ts-button ts-button-secondary">
              Explore Benchmarks
              <ArrowDown size={14} />
            </a>
          </div>

          <div className="ts-engine-status">
            <span className="ts-status-indicator" />
            <div>
              <span>TensorServe Engine</span>
              <small>Inference Ready</small>
            </div>
          </div>
        </div>

        <TensorServeOrb />
      </section>

      <section id="platform" className="ts-intro">
        <Reveal>
          <div className="ts-section-label">01 / THE PLATFORM</div>
        </Reveal>
        <div className="ts-intro-grid">
          <div>
            <WordReveal className="ts-intro-heading">
              Your model generates tokens.
            </WordReveal>
            <WordReveal className="ts-intro-heading ts-heading-muted">
              TensorServe tells you how.
            </WordReveal>
          </div>
          <div>
            <Reveal>
              <p>Running an LLM is only the beginning. Understanding how efficiently it runs requires visibility into latency, throughput, memory usage and hardware utilization.</p>
            </Reveal>
            <Reveal>
              <p>TensorServe combines inference, benchmarking and hardware observability into a single platform.</p>
            </Reveal>
          </div>
        </div>
        <div className="ts-three-pillars">
          <article><span>01</span><h3>INFERENCE</h3><p>Run and stream responses from transformer-based language models.</p></article>
          <article><span>02</span><h3>BENCHMARKING</h3><p>Measure latency, throughput and token performance across repeated runs.</p></article>
          <article><span>03</span><h3>OBSERVABILITY</h3><p>Understand how inference affects CPU, RAM, GPU utilization and VRAM.</p></article>
        </div>
      </section>

      <section id="features" className="ts-section">
        <Reveal>
          <div className="ts-section-label">02 / CAPABILITIES</div>
        </Reveal>
        <div className="ts-section-heading">
          <WordReveal className="ts-section-heading-title">
            Everything you need to evaluate inference.
          </WordReveal>
          <Reveal>
            <p>One environment for running models, measuring performance and understanding the hardware underneath.</p>
          </Reveal>
        </div>
        <StaggerGrid className="ts-feature-grid">
          {[
            ["01", "LLM INFERENCE", "Run transformer models through a dedicated inference engine."],
            ["02", "TOKEN STREAMING", "Stream generated output token-by-token."],
            ["03", "PERFORMANCE", "Measure TTFT, generation latency and tokens/sec."],
            ["04", "HARDWARE", "Monitor GPU, VRAM, RAM, temperature and power."],
            ["05", "BENCHMARKING", "Run repeatable inference workloads and compare performance."],
            ["06", "REQUEST CONTROL", "Manage concurrent inference requests through the request architecture."],
          ].map(([number, title, description]) => (
            <StaggerItem className="ts-feature-card" key={number}>
              <div className="ts-card-number">{number}</div>
              <div className="ts-card-arrow"><ArrowUpRight size={14} /></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>

      <section id="how-it-works" className="ts-section ts-process-section">
        <Reveal>
          <div className="ts-section-label">03 / ARCHITECTURE</div>
        </Reveal>
        <div className="ts-section-heading">
          <WordReveal className="ts-section-heading-title">
            From prompt to measurable inference.
          </WordReveal>
        </div>
        <StaggerGrid className="ts-pipeline">
          {[
            ["01", "USER", "Your prompt enters the system."],
            ["02", "API", "The inference request is received."],
            ["03", "REQUEST MANAGER", "Requests are coordinated."],
            ["04", "INFERENCE ENGINE", "The model generates tokens."],
            ["05", "STREAM", "Generated tokens are returned."],
            ["06", "METRICS", "Performance is measured."],
          ].map(([number, title, description], index) => (
            <StaggerItem className="ts-pipeline-item" key={title}>
              <span className="ts-pipeline-number">{number}</span>
              <div className="ts-pipeline-node"><span className="ts-node-dot" /><h3>{title}</h3><p>{description}</p></div>
              {index !== 5 && <span className="ts-pipeline-line" />}
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>

      <section id="benchmarking" className="ts-benchmark">
        <div className="ts-benchmark-copy">
          <Reveal>
            <div className="ts-section-label">04 / BENCHMARKING</div>
          </Reveal>
          <WordReveal className="ts-section-heading-title">
            Don't just run a model. Benchmark it.
          </WordReveal>
          <Reveal>
            <p>Run repeatable inference workloads and measure how your model performs under real hardware constraints.</p>
          </Reveal>
          <Reveal>
            <Link to="/benchmark-lab" className="ts-button ts-button-primary">Explore Benchmarking<ArrowUpRight size={14} /></Link>
          </Reveal>
        </div>
        <div className="ts-benchmark-visual">
          <div className="ts-chart-header"><span>PERFORMANCE SIGNAL</span><span>REPEATABLE RUNS</span></div>
          <div className="ts-chart">
            <div className="ts-chart-grid" />
            <motion.svg
              viewBox="0 0 600 260"
              preserveAspectRatio="none"
              className="ts-chart-line"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            >
              <motion.path
                d="M0 210 C70 205 80 170 140 175 S210 120 270 140 S330 90 390 110 S470 65 520 80 S560 35 600 45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, amount: 0.4 }}
              />
            </motion.svg>
            <div className="ts-chart-label ts-chart-label-a">TTFT</div>
            <div className="ts-chart-label ts-chart-label-b">TOKENS / SEC</div>
            <div className="ts-chart-label ts-chart-label-c">VRAM</div>
          </div>
          <div className="ts-metric-strip"><span>TTFT</span><span>GENERATION TIME</span><span>TOKENS / SEC</span><span>VRAM</span><span>GPU UTILIZATION</span></div>
        </div>
      </section>

      <section id="optimization" className="ts-section">
        <Reveal>
          <div className="ts-section-label">05 / OPTIMIZATION</div>
        </Reveal>
        <div className="ts-optimization-grid">
          <Reveal>
            <div><WordReveal className="ts-section-heading-title">Built for inference optimization.</WordReveal><p>Measure the impact of changes to your inference stack instead of optimizing blindly.</p></div>
          </Reveal>
          <StaggerGrid className="ts-optimization-flow">
            {["BASELINE", "MEASURE", "OPTIMIZE", "BENCHMARK AGAIN"].map((step, index) => (
              <StaggerItem className="ts-opt-step" key={step}><span>0{index + 1}</span><strong>{step}</strong>{index !== 3 && <i>→</i>}</StaggerItem>
            ))}
          </StaggerGrid>
        </div>
        <div className="ts-optimization-tags"><span>KV CACHING</span><span>QUANTIZATION</span><span>BATCHING</span><span>MODEL SELECTION</span><span>HARDWARE-AWARE</span></div>
      </section>

      <section id="developers" className="ts-developer">
        <Reveal>
          <div className="ts-section-label">06 / DEVELOPER FIRST</div>
        </Reveal>
        <div className="ts-developer-grid">
          <Reveal className="ts-developer-copy">
            <div><WordReveal className="ts-section-heading-title">An inference engine you can integrate.</WordReveal><p>TensorServe is designed around an API-driven inference architecture, making performance evaluation part of the development workflow.</p></div>
          </Reveal>
          <Reveal className="ts-code-card">
            <div className="ts-code-top"><span>POST</span><strong>/generate/</strong></div>
            <pre>{`{
  "prompt": "Explain transformers",
  "max_new_tokens": 100,
  "temperature": 0.7
}`}</pre>
            <div className="ts-code-endpoints"><span>POST /benchmark/</span><span>GET /metrics/</span></div>
          </Reveal>
        </div>
      </section>

      <section id="built-for" className="ts-section ts-audience">
        <Reveal>
          <div className="ts-section-label">07 / BUILT FOR</div>
        </Reveal>
        <div className="ts-section-heading"><h2>For people who care<br />how models perform.</h2></div>
        <StaggerGrid className="ts-audience-grid">
          {[
            ["ML ENGINEERS", "Evaluate model inference performance and optimization strategies."],
            ["AI DEVELOPERS", "Integrate LLM inference through an API-driven architecture."],
            ["RESEARCHERS", "Experiment with model configurations, caching and hardware performance."],
          ].map(([title, text], index) => (
            <StaggerItem className="ts-audience-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></StaggerItem>
          ))}
        </StaggerGrid>
      </section>

      <section id="start" className="ts-final">
        <div className="ts-final-orb" />
        <Reveal>
          <div className="ts-section-label">08 / TENSORSERVE</div>
        </Reveal>
        <WordReveal className="ts-final-heading">Understand Your Inference.</WordReveal>
        <Reveal>
          <p>Run your model. Measure its performance. Optimize what matters.</p>
        </Reveal>
        <Reveal>
          <div className="ts-hero-actions">
            <button
              type="button"
              onClick={handleLaunchPlayground}
              className="ts-button ts-button-primary"
            >
              Launch Playground
              <ArrowUpRight size={14} />
            </button>
            <button
              onClick={() => navigate({ to: '/login', search: { mode: 'register' } })}
              className="ts-button ts-button-secondary"
            >
              Sign up
              <ArrowUpRight size={14} />
            </button>
          </div>
        </Reveal>
      </section>

      <footer className="ts-footer">
        <div>
          <Link to="/" className="ts-brand"><span className="flex h-[18px] w-[18px] shrink-0 items-end justify-center gap-[2px]" aria-hidden="true"><span className="block h-[8px] w-[3px] rounded-[1px] bg-[var(--ts-blue)] opacity-60" /><span className="block h-[15px] w-[3px] rounded-[1px] bg-[var(--ts-blue)] opacity-85" /><span className="block h-[11px] w-[3px] rounded-[1px] bg-[var(--ts-blue)]" /></span><span>TensorServe</span></Link>
          <p>LLM inference, benchmarking and observability.</p>
        </div>
        <div className="ts-footer-links">
          <a href="#features">Features</a>
          <a href="#benchmarking">Benchmarking</a>
          <a href="#optimization">Optimization</a>
          <a href="#developers">Documentation</a>
          <a href="https://github.com">GitHub</a>
        </div>
      </footer>
    </main>
  );
}
