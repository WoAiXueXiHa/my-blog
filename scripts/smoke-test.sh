#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://code-learn-build-evolve.vercel.app}"
BASE_URL="${BASE_URL%/}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for path in / /posts/ /posts/go-string/ /index.json; do
  curl --fail --silent --show-error --location --retry 3 --retry-delay 2 \
    --output "$tmp/body" --dump-header "$tmp/headers" "$BASE_URL$path"
  grep -qi '^content-security-policy:' "$tmp/headers" || { echo "缺少 CSP: $path" >&2; exit 1; }
  grep -qi '^x-content-type-options: nosniff' "$tmp/headers" || { echo "缺少 nosniff: $path" >&2; exit 1; }
done

python3 - "$tmp/body" <<'PY'
import json, sys
items = json.load(open(sys.argv[1], encoding="utf-8"))
assert items and all("content" not in item for item in items), "搜索索引不应包含正文"
PY

echo "线上健康检查通过: $BASE_URL"
