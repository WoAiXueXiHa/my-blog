#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[[ $# -le 1 ]] || {
  echo '用法: ./scripts/publish.sh [提交说明]'
  exit 1
}

BRANCH=$(git branch --show-current)
[[ "$BRANCH" == "master" ]] || {
  echo "只能从 master 直接发布，当前分支: ${BRANCH:-detached HEAD}"
  exit 1
}

git fetch origin master
git merge-base --is-ancestor origin/master HEAD || {
  echo '远端 master 有本地尚未包含的提交，请先同步后再发布。'
  exit 1
}

mapfile -t changed < <({
  git diff --name-only
  git diff --cached --name-only
  git ls-files --others --exclude-standard
} | sort -u)
(( ${#changed[@]} > 0 )) || {
  echo '没有需要发布的文章变更。'
  exit 1
}

articles=()
for file in "${changed[@]}"; do
  [[ "$file" == content/posts/* ]] || {
    echo "检测到非文章变更，已停止: $file"
    exit 1
  }
  article="content/posts/$(cut -d/ -f1 <<< "${file#content/posts/}")/index.md"
  [[ -f "$article" ]] && articles+=("$article")
done
deleted=$(git diff --name-only --diff-filter=D -- content/posts; git diff --cached --name-only --diff-filter=D -- content/posts)
[[ -z "$deleted" ]] || {
  echo "检测到文章或图片删除，已停止。请先核对：" >&2
  printf '%s\n' "$deleted" >&2
  exit 1
}
mapfile -t articles < <(printf '%s\n' "${articles[@]}" | sort -u)
(( ${#articles[@]} > 0 )) || {
  echo '没有检测到可发布的文章 index.md。'
  exit 1
}

python3 ./scripts/validate-utf8.py "${articles[@]}"
./scripts/import-images.sh "${articles[@]}"
for article in "${articles[@]}"; do
  python3 ./scripts/enrich-article.py "$article"
done
./scripts/validate.sh

git add -- content/posts
git diff --cached --quiet && {
  echo '没有可提交的文章变更。'
  exit 1
}

MSG="${1:-更新文章: $(printf '%s, ' "${articles[@]%/index.md}" | sed 's/, $//')}"
git commit -m "$MSG"
git push origin master
echo '文章已推送到 master；GitHub Actions 检查通过后才会部署到生产环境。'
