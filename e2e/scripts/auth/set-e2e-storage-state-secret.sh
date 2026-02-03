#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-}"
SECRET_NAME="${2:-E2E_STORAGE_STATE_B64}"
STATE_PATH="${3:-.auth/storageState.json}"

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo> [secret-name] [storageState-path]" >&2
  echo "Example: $0 chico10117/usdt-blacklist-checker" >&2
  exit 1
fi

if [[ ! -f "$STATE_PATH" ]]; then
  echo "storageState file not found: $STATE_PATH" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) not found. Install from https://cli.github.com/" >&2
  exit 1
fi

B64="$(node scripts/auth/encode-storage-state.js "$STATE_PATH")"

# Uses gh's built-in secret helper (recommended)
echo "$B64" | gh secret set "$SECRET_NAME" --repo "$REPO" --body -

echo "✅ Updated secret $SECRET_NAME on $REPO" >&2
