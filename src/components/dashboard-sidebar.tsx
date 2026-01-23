"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, LayoutDashboard, Settings, Star } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function DashboardSidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";

  return (
    <aside className={cn("w-full border-b border-border/60 bg-card/60 md:w-64 md:border-b-0 md:border-r", className)}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
            USDT Checker
          </Link>
        </div>
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
      </div>
    </aside>
  );
}

