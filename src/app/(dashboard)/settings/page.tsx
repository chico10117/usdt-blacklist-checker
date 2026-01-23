import type { Metadata } from "next";

import { SettingsClient } from "./settings-client";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Control privacy defaults for your account.</p>
      </div>
      <SettingsClient />
    </div>
  );
}

