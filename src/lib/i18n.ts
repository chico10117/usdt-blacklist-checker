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
  title: "TRON Address Risk Checker",
  subtitle: "Check blacklist status, OFAC sanctions, and transaction risk for any TRON address. No keys. No tracking.",
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

