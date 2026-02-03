export type SameOriginCheck =
  | { ok: true }
  | { ok: false; error: "Missing Origin." | "Invalid Origin." | "Missing Host." | "Cross-origin request blocked." };

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

export function validateSameOrigin(request: Request): SameOriginCheck {
  const origin = firstHeaderValue(request.headers.get("origin"));
  if (!origin) return { ok: false, error: "Missing Origin." };

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return { ok: false, error: "Invalid Origin." };
  }

  const host = firstHeaderValue(request.headers.get("x-forwarded-host")) ?? firstHeaderValue(request.headers.get("host"));
  if (!host) return { ok: false, error: "Missing Host." };

  if (originUrl.host.toLowerCase() !== host.toLowerCase()) {
    return { ok: false, error: "Cross-origin request blocked." };
  }

  return { ok: true };
}

export function safeExternalHref(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}

