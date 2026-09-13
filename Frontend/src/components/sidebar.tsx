import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PlayCircle,
  Gauge,
  LineChart,
  BookText,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

/* -------------------------------------------------------------------------- */
/* Nav config                                                                 */
/* -------------------------------------------------------------------------- */

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { path: "/playground", label: "Playground", icon: PlayCircle },
  { path: "/benchmark-lab", label: "Benchmarks", icon: Gauge },
];

const bottomItems = [
  { path: "/docs", label: "API Documentation", icon: BookText },
  { path: "/settings", label: "Settings", icon: Settings },
];

/* -------------------------------------------------------------------------- */
/* Nav link                                                                   */
/* -------------------------------------------------------------------------- */

function NavLink({
  path,
  label,
  icon: Icon,
  exact,
  onClick,
}: {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={path}
      activeOptions={{ exact: !!exact }}
      onClick={onClick}
      className="
        group relative flex items-center gap-2.5
        rounded-lg px-3 py-2.5
        text-xs font-medium
        text-muted-foreground
        transition-colors duration-150
        hover:bg-elevated hover:text-foreground
        data-[status=active]:bg-primary/10
        data-[status=active]:text-foreground
      "
    >
      {/* active accent bar */}
      <span
        className="
          absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full
          bg-primary opacity-0
          transition-opacity duration-150
          group-data-[status=active]:opacity-100
        "
      />
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

export function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const close = () => setIsMobileOpen(false);

  return (
    <>
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open navigation"
        className="
          fixed left-4 top-4 z-[60]
          inline-flex items-center justify-center
          rounded-lg border border-border
          bg-card p-2
          text-foreground
          lg:hidden
        "
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-3 top-3 bottom-3 z-50
          w-[220px]
          overflow-hidden rounded-2xl
          border border-border
          bg-background
          shadow-[0_12px_40px_rgba(0,0,0,0.35)]
          transition-transform duration-200 ease-out
          ${isMobileOpen ? "translate-x-0" : "-translate-x-[120%]"}
          lg:!translate-x-0
        `}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Brand */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <rect x="1" y="7" width="2.4" height="7" rx="1" fill="currentColor" opacity="0.55" />
                  <rect x="5" y="4" width="2.4" height="10" rx="1" fill="currentColor" opacity="0.8" />
                  <rect x="9" y="1.5" width="2.4" height="12.5" rx="1" fill="currentColor" />
                  <rect x="13" y="5.5" width="2.4" height="8.5" rx="1" fill="currentColor" opacity="0.8" />
                </svg>
              </span>
              <span className="text-sm font-semibold tracking-tight text-foreground">
                TensorServe
              </span>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close navigation"
              className="text-muted-foreground lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-px bg-border" />

          {/* Main navigation */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-4">
            <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Platform
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink key={item.path} {...item} onClick={close} />
              ))}
            </nav>
          </div>

          {/* Bottom navigation */}
          <div className="shrink-0 border-t border-border px-2.5 py-4">
            <nav className="space-y-1">
              {bottomItems.map((item) => (
                <NavLink key={item.path} {...item} onClick={close} />
              ))}
            </nav>
          </div>
        </div>
      </aside>
    </>
  );
}