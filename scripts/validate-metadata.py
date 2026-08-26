#!/usr/bin/env python3
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
seen: dict[tuple[str, int], Path] = {}
errors: list[str] = []
now = datetime.now(timezone.utc)

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

    for required in ("title", "date", "lastmod", "draft", "topic", "summary", "categories", "tags"):
        raw = value(required).strip('"\' []')
        if not raw:
            errors.append(f"{path}: {required} 不能为空")

    fence_count = len(re.findall(r"(?m)^```", text))
    if fence_count % 2:
        errors.append(f"{path}: Markdown 代码围栏数量不是偶数")

    for name in ("title", "summary"):
        raw = value(name)
        quoted = re.match(r"""^(['"])(.*)\1$""", raw)
        if quoted and quoted.group(2) != quoted.group(2).strip():
            errors.append(f"{path}: {name} 首尾不能包含空白字符")

    draft = value("draft").strip('"\'').lower()
    if draft and draft != "false":
        errors.append(f"{path}: draft 必须为 false 才能发布")

    for name in ("date", "lastmod"):
        raw = value(name).strip('"\'')
        if not raw:
            continue
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            errors.append(f"{path}: {name} 不是合法的 ISO 8601 时间: {raw}")
            continue
        if parsed.tzinfo is None:
            errors.append(f"{path}: {name} 必须包含时区: {raw}")
            continue
        if parsed.astimezone(timezone.utc) > now:
            errors.append(f"{path}: {name} 不能晚于当前时间: {raw}")

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
