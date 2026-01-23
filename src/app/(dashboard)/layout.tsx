import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-semibold tracking-tight text-foreground">
              USDT Checker
            </Link>
            <Separator orientation="vertical" className="h-5 bg-border/60" />
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/history" className="font-medium text-foreground">
                History
              </Link>
              <Link href="/settings" className="font-medium text-foreground">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
