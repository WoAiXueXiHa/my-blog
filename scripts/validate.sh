#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

python3 ./scripts/validate-utf8.py

errors=0
fail(){ printf '错误: %s\n' "$1" >&2; errors=$((errors+1)); }
while IFS= read -r -d '' file; do
  title=$(awk -F: '/^title:/{sub(/^[[:space:]]+/,"",$2); gsub(/^"|"$/,"",$2); print $2; exit}' "$file")
  topic=$(awk -F: '/^topic:/{sub(/^[[:space:]]+/,"",$2); gsub(/^"|"$/,"",$2); print $2; exit}' "$file")
  [[ -n "$title" ]] || fail "$file 缺少 title"
  [[ -n "$topic" ]] || fail "$file 缺少 topic"
  body=$(sed '1,/^---$/d; 1,/^---$/d' "$file")
  if grep -qE '^#[[:space:]]+' <<<"$body"; then fail "$file 正文包含 H1，请从 ## 开始"; fi
  if grep -qE '!\[([[:space:]]*)\]\(' "$file"; then fail "$file 存在空图片说明 alt"; fi
  while IFS= read -r image; do
    [[ "$image" =~ ^https?:// ]] && { fail "$file 使用外部图片 $image"; continue; }
    [[ -f "$(dirname "$file")/$image" || -f "static/${image#/}" ]] || fail "$file 图片不存在: $image"
  done < <(grep -oE '!\[[^]]+\]\([^ )]+' "$file" | sed 's/^.*](//' || true)
  while IFS= read -r asset; do
    size=$(stat -c %s "$asset")
    (( size <= 8388608 )) || fail "$asset 超过 8 MiB，请压缩后再发布"
  done < <(find "$(dirname "$file")" -maxdepth 1 -type f ! -name index.md -print)
done < <(find content/posts -name index.md -print0)
(( errors == 0 )) || exit 1
./scripts/validate-metadata.py
hugo --gc --minify --cleanDestinationDir --printPathWarnings
./scripts/validate-links.py
echo '内容校验与 Hugo 构建通过。'
