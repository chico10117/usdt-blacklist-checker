import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster />
    </ThemeProvider>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        {clerkEnabled ? <ClerkProvider>{app}</ClerkProvider> : app}
        <Analytics />
      </body>
    </html>
  );
}
