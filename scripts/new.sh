#!/usr/bin/env bash
set -euo pipefail

TITLE="${1:-}"
TOPIC="${2:-}"
SLUG="${3:-}"
if [[ -z "$TITLE" || -z "$TOPIC" ]]; then
  echo '用法: ./scripts/new.sh "文章标题" topic [english-slug]'
  exit 1
fi
if [[ -z "$SLUG" ]]; then read -r -p '文章英文 slug（如 go-concurrency）: ' SLUG; fi
if [[ ! "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo 'slug 只能包含小写字母、数字和连字符。'
  exit 1
fi
DIR="content/posts/$SLUG"
[[ ! -e "$DIR" ]] || { echo "文章已存在: $DIR"; exit 1; }
mkdir -p "$DIR"
NOW=$(date +%Y-%m-%dT%H:%M:%S+08:00)
escape_sed(){ printf '%s' "$1" | sed 's/[&|]/\\&/g'; }
sed -e "s|__TITLE__|$(escape_sed "$TITLE")|g" \
    -e "s|__TOPIC__|$(escape_sed "$TOPIC")|g" \
    -e "s|__NOW__|$NOW|g" archetypes/posts.md > "$DIR/index.md"
echo "已创建 $DIR/index.md；发布时会自动生成摘要、分类和标签。"

FILE="$DIR/index.md"
if [[ -n "${EDITOR:-}" ]]; then "$EDITOR" "$FILE"
elif command -v nano >/dev/null 2>&1; then nano "$FILE"
elif command -v vim >/dev/null 2>&1; then vim "$FILE"
elif command -v vi >/dev/null 2>&1; then vi "$FILE"
else echo "未找到终端编辑器，请手动打开 $FILE"; exit 0
fi
echo
echo "文章已保存。确认内容后运行："
echo "  ./scripts/publish.sh \"add: $TITLE\""
