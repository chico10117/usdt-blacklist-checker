export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

export type Messages = {
  title: string;
  subtitle: string;
  inputLabel: string;
  inputPlaceholder: string;
  checkCta: string;
  pasteCta: string;
  exampleCta: string;
  noKeysBadge: string;
  noTrackingBadge: string;
};

const en: Messages = {
  title: "USDT (TRON) Blacklist Checker",
  subtitle: "Check whether a TRON address is blacklisted by the USDT smart contract. No keys. No tracking.",
  inputLabel: "TRON address",
  inputPlaceholder: "Paste a TRON address (starts with T)…",
  checkCta: "Check",
  pasteCta: "Paste",
  exampleCta: "Example",
  noKeysBadge: "No keys required",
  noTrackingBadge: "We don’t store addresses",
};

export function getMessages(locale: Locale = "en"): Messages {
  switch (locale) {
    case "en":
    default:
      return en;
  }
}

