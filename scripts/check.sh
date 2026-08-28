#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for command in hugo node npm python3; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "缺少检查所需命令: $command" >&2
    exit 1
  }
done

[[ -x node_modules/.bin/playwright ]] || {
  echo '缺少 Playwright 依赖，请先运行 npm ci。' >&2
  exit 1
}

./scripts/validate.sh
npm run test:unit
npm run test:browser
git diff --check
git diff --cached --check
echo '完整质量检查通过。'
