"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { History, Home, LayoutDashboard, Settings, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Checker", icon: Home },
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Subtle gradient orb decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[40%] left-1/2 h-[80%] w-[80%] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/5 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 border-b border-border/60 bg-card/60 md:w-56 md:border-b-0 md:border-r lg:w-64">
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center">
                  <Image
                    src="/logo1.png"
                    alt="USDT Checker"
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-lg object-contain"
                    priority
                  />
                  <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-card bg-emerald-500" />
                </div>
                <div className="hidden sm:block md:hidden lg:block">
                  <div className="text-sm font-semibold tracking-tight text-foreground">USDT Checker</div>
                  <div className="text-[10px] text-muted-foreground">TRON Security</div>
                </div>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex flex-row gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-4">
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      active && "bg-muted/70 text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Spacer */}
            <div className="hidden flex-1 md:block" />

            {/* Auth section (mobile hidden, shown in header) */}
            <div className="hidden border-t border-border/60 px-4 py-3 md:block">
              {clerkEnabled && (
                <>
                  <SignedOut>
                    <SignInButton mode="modal">
                      <Button type="button" variant="outline" size="sm" className="w-full">
                        Sign in
                      </Button>
                    </SignInButton>
                  </SignedOut>
                  <SignedIn>
                    <div className="flex items-center gap-2">
                      <UserButton />
                      <span className="text-sm text-muted-foreground">Account</span>
                    </div>
                  </SignedIn>
                </>
              )}
              {!clerkEnabled && (
                <div className="text-xs text-muted-foreground">Auth disabled</div>
              )}
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/40 px-4 py-3 backdrop-blur-sm sm:px-6">
            <div className="text-sm font-medium text-muted-foreground md:hidden">
              {NAV_ITEMS.find((item) => isActivePath(pathname, item.href))?.label ?? ""}
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-2">
              {clerkEnabled && (
                <div className="md:hidden">
                  <SignedOut>
                    <SignInButton mode="modal">
                      <Button type="button" variant="outline" size="sm">
                        Sign in
                      </Button>
                    </SignInButton>
                  </SignedOut>
                  <SignedIn>
                    <UserButton />
                  </SignedIn>
                </div>
              )}
              <ThemeToggle />
            </div>
          </header>

          {/* Page content */}
          <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
