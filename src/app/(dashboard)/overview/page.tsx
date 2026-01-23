import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Overview",
};

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quick links for running screenings and reviewing saved reports.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Run a screening</CardTitle>
            <CardDescription>Start a new TRON address check from the home page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Go to checker</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Review history</CardTitle>
            <CardDescription>View your most recent saved reports and details.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/history">Open history</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

