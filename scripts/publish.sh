#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
MSG="${1:-}"
MODE="${2:-}"
[[ -n "$MSG" ]] || { echo '用法: ./scripts/publish.sh "文章标题" [--no-push]'; exit 1; }

mapfile -t changed < <({ git diff --name-only; git ls-files --others --exclude-standard; } | sort -u)
(( ${#changed[@]} > 0 )) || { echo '没有需要发布的文章变更。'; exit 1; }
for file in "${changed[@]}"; do
  [[ "$file" == content/posts/* ]] || { echo "检测到非文章变更，已停止: $file"; exit 1; }
done

NOW=$(date +%Y-%m-%dT%H:%M:%S+08:00)
for file in "${changed[@]}"; do
  [[ "$file" == */index.md && -f "$file" ]] || continue
  sed -i "s|^lastmod: .*|lastmod: $NOW|" "$file"
  sed -i 's/^draft: true$/draft: false/' "$file"
done
./scripts/validate.sh
git add -- content/posts
git diff --cached --quiet && { echo '没有可提交的文章变更。'; exit 1; }
git commit -m "$MSG"
if [[ "$MODE" != "--no-push" ]]; then git push; fi
echo '文章已安全发布；Vercel 将自动完成部署。'
