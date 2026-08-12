#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://code-learn-build-evolve.vercel.app}"
BASE_URL="${BASE_URL%/}"
if (( $# > 0 )); then shift; fi
EXPECTED_PATHS=("$@")
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fetch_path() {
  local path="$1"
  local output="$2"
  local url="$BASE_URL$path"
  echo "Checking production URL: $url"
  if ! curl --fail --silent --show-error --location --retry 3 --retry-delay 2 \
    --connect-timeout 10 --max-time 30 \
    --output "$output" --dump-header "$tmp/headers" "$url"; then
    echo "Production request failed: $url" >&2
    exit 1
  fi
  grep -qi '^content-security-policy:' "$tmp/headers" || { echo "缺少 CSP: $path" >&2; exit 1; }
  grep -qi '^x-content-type-options: nosniff' "$tmp/headers" || { echo "缺少 nosniff: $path" >&2; exit 1; }
}

for path in / /posts/; do
  fetch_path "$path" "$tmp/body"
done
fetch_path /index.json "$tmp/index.json"

python3 - "$tmp/index.json" "${EXPECTED_PATHS[@]}" > "$tmp/article-paths" <<'PY'
import json, sys
items = json.load(open(sys.argv[1], encoding="utf-8"))
assert items and all("content" not in item for item in items), "搜索索引不应包含正文"
required = {"title", "permalink", "type", "summary", "headings", "tags", "lastmod"}
assert all(required <= set(item) for item in items), "search index fields are incomplete"
assert any(item.get("type") == "article" and item.get("headings") for item in items), "article heading index is empty"
permalinks = {
    item.get("permalink")
    for item in items
    if item.get("type") == "article" and item.get("permalink")
}
assert permalinks, "search index has no articles"
missing = [path for path in sys.argv[2:] if path not in permalinks]
assert not missing, f"new articles missing from search index: {missing}"
print("\n".join(sorted(permalinks)))
PY
mapfile -t ARTICLE_PATHS < "$tmp/article-paths"
for path in "${ARTICLE_PATHS[@]}"; do
  fetch_path "$path" "$tmp/body"
done


echo "线上健康检查通过: $BASE_URL"
