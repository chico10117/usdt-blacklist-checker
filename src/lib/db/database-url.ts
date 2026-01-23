export function normalizeDatabaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    // Continue; we may be dealing with an unescaped password containing reserved characters (e.g. "/").
  }

  const match = trimmed.match(/^(postgres(?:ql)?):\/\/(.*)$/);
  if (!match) return trimmed;

  const scheme = match[1];
  const rest = match[2];
  const atIndex = rest.indexOf("@");
  if (atIndex === -1) return trimmed;

  const userInfo = rest.slice(0, atIndex);
  const hostAndMore = rest.slice(atIndex + 1);
  const colonIndex = userInfo.indexOf(":");
  if (colonIndex === -1) return trimmed;

  const username = userInfo.slice(0, colonIndex);
  const password = userInfo.slice(colonIndex + 1);
  const normalized = `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostAndMore}`;

  try {
    new URL(normalized);
    return normalized;
  } catch {
    return trimmed;
  }
}

export function getDatabaseUrlFromEnv(): string | null {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.SUPABASE_DATABASE_URL ??
    process.env.SUPABASE_DB_URL ??
    null;

  return url ? normalizeDatabaseUrl(url) : null;
}
