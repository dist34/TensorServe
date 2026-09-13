import { createFileRoute } from "@tanstack/react-router";

import BenchmarkLab from "@/components/inferx/benchmark-lab";
import { Sidebar } from "@/components/sidebar";
import { ProtectedRoute } from "@/components/protected-route";

export const Route = createFileRoute(
  "/benchmark-lab",
)({
  component: BenchmarkLabPage,
});

function BenchmarkLabPage() {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background">
        <Sidebar />

        <main className="min-w-0 flex-1 overflow-auto lg:ml-[248px]">
          <BenchmarkLab />
        </main>
      </div>
    </ProtectedRoute>
  );
}