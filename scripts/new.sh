#!/usr/bin/env bash
#
# 创建新文章
# 用法: ./scripts/new.sh "文章标题" [topic]
#
# 示例:
#   ./scripts/new.sh "Go 并发模型" golang
#   ./scripts/new.sh "Linux 网络调优" backend

set -euo pipefail

TITLE="${1:-}"
TOPIC="${2:-}"

if [ -z "$TITLE" ]; then
    echo "用法: ./scripts/new.sh \"文章标题\" [topic]"
    echo ""
    echo "可用的 topic: golang, backend, os, algorithms, data-structures,"
    echo "               networks, ai, reading, frontend, devops"
    exit 1
fi

# 生成 slug（中文直接用拼音首字母不太好，改用日期+手动slug的方式）
# 这里我们直接让用户输入英文 slug
read -r -p "文章英文 slug (如 go-concurrency): " SLUG

if [ -z "$SLUG" ]; then
    echo "slug 不能为空"
    exit 1
fi

FILE="content/posts/${SLUG}.md"

if [ -f "$FILE" ]; then
    echo "文件已存在: $FILE"
    exit 1
fi

NOW=$(date +%Y-%m-%dT%H:%M:%S+08:00)

# 创建文件
cat > "$FILE" << 'TEMPLATE_EOF'
---
title: "__TITLE__"
date: __NOW__
lastmod: __NOW__
draft: true
status: "evergreen"
topic: "__TOPIC__"
tags: []
categories: []
series: []
featured: false
related: []
summary: ""
---

<!-- 正文从这里开始 -->
TEMPLATE_EOF

# 替换占位符
sed -i "s|__TITLE__|${TITLE}|g" "$FILE"
sed -i "s|__NOW__|${NOW}|g" "$FILE"
sed -i "s|__TOPIC__|${TOPIC}|g" "$FILE"

echo "✓ 已创建: $FILE"
echo ""
echo "接下来："
echo "  1. 写文章内容"
echo "  2. 把 draft 改成 false（准备发布时）"
echo "  3. 运行 ./scripts/publish.sh 提交并推送"
echo ""

# 尝试打开编辑器
if [ -n "${EDITOR:-}" ]; then
    exec "$EDITOR" "$FILE"
elif command -v code &>/dev/null; then
    exec code "$FILE"
fi
