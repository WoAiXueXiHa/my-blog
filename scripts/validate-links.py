#!/usr/bin/env python3
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

root = Path(__file__).resolve().parents[1] / "public"
errors: list[str] = []
for page in root.rglob("*.html"):
    text = page.read_text(encoding="utf-8")
    for href in re.findall(r'href=["\']([^"\']+)', text):
        parsed = urlsplit(href)
        if parsed.scheme or parsed.netloc or href.startswith(("#", "mailto:")):
            continue
        path = parsed.path
        if not path:
            continue
        target = root / path.lstrip("/") if path.startswith("/") else page.parent / path
        candidates = (target, target / "index.html", target.with_suffix(".html"))
        if not any(candidate.exists() for candidate in candidates):
            errors.append(f"{page.relative_to(root)} -> {href}")
if errors:
    print("失效内部链接:\n" + "\n".join(errors[:30]), file=sys.stderr)
    raise SystemExit(1)
