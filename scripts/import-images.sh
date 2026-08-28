#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

(( $# > 0 )) || {
  echo '用法: ./scripts/import-images.sh content/posts/slug/index.md [...]' >&2
  exit 1
}

total=0
TEMP_FILE=""
cleanup() {
  [[ -z "$TEMP_FILE" ]] || rm -f -- "$TEMP_FILE"
}
trap cleanup EXIT INT TERM

for FILE in "$@"; do
  [[ -f "$FILE" ]] || { echo "文章不存在: $FILE" >&2; exit 1; }
  DIR=$(dirname "$FILE")

  mapfile -t urls < <(
    grep -oE 'https://gitee.com/binary-whispers/pic/raw/master/[^ )]+' "$FILE" \
      | awk '!seen[$0]++ { print length($0), $0 }' \
      | sort -rn \
      | cut -d' ' -f2- || true
  )
  unset target_sources
  declare -A target_sources=()
  for url in "${urls[@]}"; do
    clean_url=${url%%\?*}
    name=$(basename "$clean_url")
    [[ -n "$name" && "$name" == *.* ]] || {
      echo "无法从图片地址解析文件名: $url" >&2
      exit 1
    }
    target="$DIR/$name"
    if [[ -n "${target_sources[$target]+set}" && "${target_sources[$target]}" != "$clean_url" ]]; then
      echo "多个图片地址使用了同一文件名: $name" >&2
      exit 1
    fi
    target_sources[$target]="$clean_url"
  done

  for url in "${urls[@]}"; do
    clean_url=${url%%\?*}
    name=$(basename "$clean_url")
    target="$DIR/$name"
    valid=false
    if [[ -f "$target" ]] && python3 ./scripts/image_validation.py "$target"; then
      valid=true
    fi
    if [[ "$valid" != true ]]; then
      echo "下载图片: $FILE -> $name"
      TEMP_FILE=$(mktemp "$DIR/.${name}.download.XXXXXX")
      curl --fail --location --silent --show-error --retry 3 \
        --connect-timeout 10 --max-time 30 \
        "$url" --output "$TEMP_FILE"
      python3 ./scripts/image_validation.py "$TEMP_FILE" "$name"
      mv -- "$TEMP_FILE" "$target"
      TEMP_FILE=""
    fi
    python3 - "$FILE" "$url" "$name" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
url = sys.argv[2]
name = sys.argv[3]
text = path.read_text(encoding="utf-8")
path.write_text(text.replace(url, name), encoding="utf-8")
PY
    total=$((total+1))
  done

  if (( ${#urls[@]} > 0 )); then
    echo "已将 ${#urls[@]} 张外部图片迁移到 $DIR"
  fi
done

if (( total > 0 )); then
  echo "图片迁移完成，共处理 ${total} 个 Gitee 图片引用。"
fi
