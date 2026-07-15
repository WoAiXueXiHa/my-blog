#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
MSG="${1:-}"
MODE="${2:-}"
[[ -n "$MSG" ]] || { echo '用法: ./scripts/publish.sh "文章标题" [--no-push]'; exit 1; }

mapfile -t changed < <({ git diff --name-only; git diff --cached --name-only; git ls-files --others --exclude-standard; } | sort -u)
(( ${#changed[@]} > 0 )) || { echo '没有需要发布的文章变更。'; exit 1; }
for file in "${changed[@]}"; do
  [[ "$file" == content/posts/* ]] || { echo "检测到非文章变更，已停止: $file"; exit 1; }
done

articles=()
for file in "${changed[@]}"; do
  [[ "$file" == */index.md && -f "$file" ]] && articles+=("$file")
done
(( ${#articles[@]} > 0 )) || { echo '没有检测到可发布的文章 index.md。'; exit 1; }
python3 ./scripts/validate-utf8.py "${articles[@]}"

NOW=$(date +%Y-%m-%dT%H:%M:%S+08:00)
for file in "${articles[@]}"; do
  ./scripts/import-images.sh "$file"
  ./scripts/generate-summary.py "$file"
  ./scripts/enrich-article.py "$file"
  sed -i "s|^lastmod: .*|lastmod: $NOW|" "$file"
  sed -i 's/^draft: true$/draft: false/' "$file"
done
./scripts/validate.sh
git add -- content/posts
git diff --cached --quiet && { echo '没有可提交的文章变更。'; exit 1; }
git commit -m "$MSG"
if [[ "$MODE" != "--no-push" ]]; then
  git push
  echo '文章已推送；Vercel 正在自动部署。线上健康检查将由 GitHub Actions 完成。'
else
  echo '文章已提交但未推送（--no-push）。'
fi
