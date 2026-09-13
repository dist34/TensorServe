import { Bell, Cpu } from "lucide-react";
import { AuthMenu } from "./auth-menu";
import { useModelInfo } from "@/lib/hooks/use-model-info";

export function DashboardHeader() {
  const { modelName } = useModelInfo();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="leading-tight">
          <h1 className="text-[17px] font-semibold tracking-tight">Overview</h1>
          <p className="text-[12px] text-muted-foreground">
            Real-time performance of your inference engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[12px] text-foreground">
            <Cpu className="size-3.5 text-primary" />
            <span className="tabular">{modelName}</span>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-md border border-success/25 bg-success/10 px-2 py-1.5 text-[11px] font-medium text-success">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            Live
          </span>

          <button
            type="button"
            className="relative rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
          </button>

          <div className="ml-2">
            <AuthMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
