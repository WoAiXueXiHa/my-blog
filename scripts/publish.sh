#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-}"
[[ -n "$MSG" && $# -eq 1 ]] || {
  echo '用法: ./scripts/publish.sh "add: 文章标题"'
  exit 1
}

BRANCH=$(git branch --show-current)
[[ "$BRANCH" == "master" ]] || {
  echo "只能从 master 直接发布，当前分支: ${BRANCH:-detached HEAD}"
  exit 1
}

git fetch origin master
LOCAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse origin/master)
[[ "$LOCAL_HEAD" == "$REMOTE_HEAD" ]] || {
  echo '本地 master 与 origin/master 不一致，请先同步后再发布。'
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
  [[ "$file" == */index.md && -f "$file" ]] && articles+=("$file")
done
(( ${#articles[@]} > 0 )) || {
  echo '没有检测到可发布的文章 index.md。'
  exit 1
}

python3 ./scripts/validate-utf8.py "${articles[@]}"
./scripts/validate.sh

git add -- content/posts
git diff --cached --quiet && {
  echo '没有可提交的文章变更。'
  exit 1
}

git commit -m "$MSG"
git push origin master
echo '文章已推送到 master；GitHub Actions 检查通过后才会部署到生产环境。'
