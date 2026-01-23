import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col md:flex-row">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-end border-b border-border/60 bg-card/40 px-4 py-3 backdrop-blur-sm sm:px-6">
            {clerkEnabled && <UserButton />}
            <ThemeToggle />
          </header>
          <main className="w-full min-w-0 flex-1 px-4 py-8 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
