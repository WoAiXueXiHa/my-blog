#!/usr/bin/env bash
#
# 发布文章：更新日期、提交并推送到 GitHub
# 用法: ./scripts/publish.sh "commit message"
#
# Vercel 会自动检测 GitHub 更新并部署，无需额外操作。

set -euo pipefail

MSG="${1:-}"

if [ -z "$MSG" ]; then
    echo "用法: ./scripts/publish.sh \"commit message\""
    echo ""
    echo "示例: ./scripts/publish.sh \"add: Go 并发模型\""
    exit 1
fi

# 确保在项目根目录
cd "$(dirname "$0")/.."

NOW=$(date +%Y-%m-%dT%H:%M:%S+08:00)

# 更新所有被修改文章的最后修改时间
echo "▸ 检查文章 lastmod..."
for f in $(git diff --name-only -- 'content/posts/*.md' 2>/dev/null || true); do
    if [ -f "$f" ]; then
        # 更新 lastmod
        sed -i "s|^lastmod: .*|lastmod: ${NOW}|" "$f"
        echo "  已更新 lastmod: $f"
    fi
done

# 也对新增的文件更新 lastmod
for f in $(git diff --cached --name-only -- 'content/posts/*.md' 2>/dev/null || true); do
    if [ -f "$f" ]; then
        sed -i "s|^lastmod: .*|lastmod: ${NOW}|" "$f"
        echo "  已更新 lastmod: $f"
    fi
done

# 也检查未跟踪的新文章
for f in content/posts/*.md; do
    if [ -f "$f" ] && ! git ls-files --error-unmatch "$f" &>/dev/null; then
        sed -i "s|^lastmod: .*|lastmod: ${NOW}|" "$f"
        echo "  已更新 lastmod (新文件): $f"
    fi
done

echo ""
echo "▸ 提交并推送..."
git add .
git commit -m "$MSG"
git push

echo ""
echo "✓ 已推送。Vercel 将自动部署。"
