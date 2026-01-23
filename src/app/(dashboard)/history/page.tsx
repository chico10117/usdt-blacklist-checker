import type { Metadata } from "next";

import { HistoryClient } from "./history-client";

export const metadata: Metadata = {
  title: "History",
};

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Saved screening reports for your account (newest first).</p>
        </div>
      </div>
      <HistoryClient />
    </div>
  );
}

