import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/app-shell";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "USDT (TRON) Blacklist Checker",
    template: "%s · USDT (TRON) Blacklist Checker",
  },
  description:
    "Check whether a TRON address is blacklisted for USDT (TRC20) via TronScan and an on-chain contract read. No keys. No tracking.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://usdt.chikocorp.com"),
  openGraph: {
    title: "USDT (TRON) Blacklist Checker",
    description:
      "Check whether a TRON address is blacklisted for USDT (TRC20) via TronScan and an on-chain contract read. No keys. No tracking.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "USDT (TRON) Blacklist Checker",
    description:
      "Check whether a TRON address is blacklisted for USDT (TRC20) via TronScan and an on-chain contract read. No keys. No tracking.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const app = (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AppShell>{children}</AppShell>
      <Toaster />
    </ThemeProvider>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plexSans.variable} ${plexMono.variable} min-h-screen antialiased`}>
        {clerkEnabled ? <ClerkProvider>{app}</ClerkProvider> : app}
        <Analytics />
      </body>
    </html>
  );
}
