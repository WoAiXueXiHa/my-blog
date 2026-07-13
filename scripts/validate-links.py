#!/usr/bin/env python3
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit
from html import unescape

root = Path(__file__).resolve().parents[1] / "public"
errors: list[str] = []
for page in root.rglob("*.html"):
    text = page.read_text(encoding="utf-8")
    ids = set(re.findall(r'\bid=["\']([^"\']+)', text))
    for attribute, href in re.findall(r'\b(href|src)=["\']([^"\']+)', text):
        href = unescape(href)
        parsed = urlsplit(href)
        if parsed.scheme or parsed.netloc or href.startswith("mailto:"):
            continue
        if href.startswith("#"):
            if parsed.fragment and parsed.fragment not in ids:
                errors.append(f"{page.relative_to(root)} -> missing fragment #{parsed.fragment}")
            continue
        path = parsed.path
        if not path:
            continue
        target = root / path.lstrip("/") if path.startswith("/") else page.parent / path
        candidates = (target, target / "index.html", target.with_suffix(".html"))
        existing = next((candidate for candidate in candidates if candidate.exists()), None)
        if not existing:
            errors.append(f"{page.relative_to(root)} -> {href}")
        elif attribute == "href" and parsed.fragment and existing.suffix == ".html":
            target_text = existing.read_text(encoding="utf-8")
            if not re.search(rf'\bid=["\']{re.escape(parsed.fragment)}["\']', target_text):
                errors.append(f"{page.relative_to(root)} -> {href} (missing fragment)")
if errors:
    print("失效内部链接:\n" + "\n".join(errors[:30]), file=sys.stderr)
    raise SystemExit(1)
