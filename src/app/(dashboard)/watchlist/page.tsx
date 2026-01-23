import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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

      <Alert>
        <AlertTitle>No watchlist items yet</AlertTitle>
        <AlertDescription>
          Run a screening from the checker, then come back here to manage watched addresses.
        </AlertDescription>
      </Alert>

      <Button asChild>
        <Link href="/">Go to checker</Link>
      </Button>
    </div>
  );
}

