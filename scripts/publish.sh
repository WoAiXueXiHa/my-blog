#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
MSG="${1:-}"
MODE="${2:-}"
[[ -n "$MSG" ]] || { echo '用法: ./scripts/publish.sh "文章标题" [--no-push]'; exit 1; }
[[ -z "$MODE" || "$MODE" == "--no-push" ]] || { echo "不支持的参数: $MODE"; exit 1; }

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

BRANCH=$(git branch --show-current)
[[ -n "$BRANCH" ]] || { echo '当前处于 detached HEAD，无法自动发布。'; exit 1; }

if [[ "$MODE" != "--no-push" ]]; then
  command -v gh >/dev/null 2>&1 || { echo '缺少 GitHub CLI（gh），无法自动创建 PR。'; exit 1; }
  gh auth status >/dev/null 2>&1 || { echo 'GitHub CLI 尚未登录，请先运行 gh auth login。'; exit 1; }

  if [[ "$BRANCH" == "master" ]]; then
    SLUG=$(basename "$(dirname "${articles[0]}")")
    BRANCH="article/${SLUG}-$(date +%Y%m%d-%H%M%S)"
    git switch -c "$BRANCH"
    echo "已自动创建文章分支: $BRANCH"
  fi
fi

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
  if ! git push -u origin "$BRANCH"; then
    SSH_URL=$(gh repo view --json sshUrl --jq .sshUrl 2>/dev/null || true)
    [[ -n "$SSH_URL" ]] || { echo 'HTTPS 推送失败，且无法取得仓库 SSH 地址。'; exit 1; }
    echo 'HTTPS 推送失败，自动改用 SSH 重试。'
    git -c remote.origin.pushurl="$SSH_URL" push -u origin "$BRANCH"
  fi

  PR_URL=$(gh pr view "$BRANCH" --json url --jq .url 2>/dev/null || true)
  if [[ -z "$PR_URL" ]]; then
    PR_URL=$(gh pr create \
      --base master \
      --head "$BRANCH" \
      --title "$MSG" \
      --body $'文章由自动发布流程创建。\n\n通过 build-and-browser 后将自动 Squash 合并；合并后由 Vercel 部署，并由 production-smoke 验证线上结果。')
  fi

  gh pr merge "$PR_URL" --auto --squash --delete-branch
  echo "文章发布已进入全自动流程: $PR_URL"
  echo '无需手动点击 Merge；检查通过后会自动合并、部署并执行生产烟测。'
else
  echo '文章已提交但未推送（--no-push）。'
fi
