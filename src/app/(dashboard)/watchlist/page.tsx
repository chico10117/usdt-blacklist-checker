import type { Metadata } from "next";

import { WatchlistClient } from "./watchlist-client";

export const metadata: Metadata = {
  title: "Watchlist",
};

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep track of addresses you want to re-check regularly.</p>
      </div>
      <WatchlistClient />
    </div>
  );
}
