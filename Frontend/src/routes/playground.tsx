import { createFileRoute } from "@tanstack/react-router";

import Playground from "@/components/inferx/playground";
import { Sidebar } from "@/components/sidebar";
import { ProtectedRoute } from "@/components/protected-route";

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
});

function PlaygroundPage() {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background">
        <Sidebar />

        <main className="min-w-0 flex-1 overflow-auto lg:ml-[248px]">
          <Playground />
        </main>
      </div>
    </ProtectedRoute>
  );
}