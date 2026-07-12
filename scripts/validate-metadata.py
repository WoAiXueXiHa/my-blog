#!/usr/bin/env python3
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
seen: dict[tuple[str, int], Path] = {}
errors: list[str] = []

for path in sorted((root / "content/posts").glob("*/index.md")):
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---+", text, flags=re.S)
    if not match:
        errors.append(f"{path}: front matter 无效")
        continue
    front = match.group(1)
    def value(name: str) -> str:
        item = re.search(rf"(?m)^{name}:\s*(.*)$", front)
        return item.group(1).strip() if item else ""
    for required in ("title", "topic", "summary", "categories", "tags"):
        raw = value(required).strip('"\' []')
        if not raw:
            errors.append(f"{path}: {required} 不能为空")
    series = re.findall(r'["\']([^"\']+)["\']', value("series"))
    order = value("seriesOrder")
    if series:
        if not order.isdigit() or int(order) < 1:
            errors.append(f"{path}: 系列文章必须提供正整数 seriesOrder")
        else:
            key = (series[0], int(order))
            if key in seen:
                errors.append(f"{path}: 与 {seen[key]} 的系列顺序重复：{key}")
            seen[key] = path

if errors:
    print("\n".join(f"错误: {error}" for error in errors), file=sys.stderr)
    raise SystemExit(1)
