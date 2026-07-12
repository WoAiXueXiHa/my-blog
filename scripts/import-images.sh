#!/usr/bin/env bash
set -euo pipefail

FILE="${1:-}"
[[ -f "$FILE" ]] || { echo "文章不存在: $FILE" >&2; exit 1; }
DIR=$(dirname "$FILE")
PREFIX='https://gitee.com/binary-whispers/pic/raw/master/'

mapfile -t urls < <(grep -oE 'https://gitee.com/binary-whispers/pic/raw/master/[^ )]+' "$FILE" | sort -u || true)
for url in "${urls[@]}"; do
  clean_url=${url%%\?*}
  name=$(basename "$clean_url")
  target="$DIR/$name"
  if [[ ! -f "$target" ]]; then
    echo "下载图片: $name"
    curl --fail --location --silent --show-error "$url" --output "$target"
  fi
  sed -i "s#${url}#${name}#g" "$FILE"
done

if (( ${#urls[@]} > 0 )); then
  echo "已将 ${#urls[@]} 张外部图片迁移到 $DIR"
fi
