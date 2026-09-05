#!/usr/bin/env python3
import sys
from functools import cache
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.references: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.add(unquote(values["id"]))
        for attribute in ("href", "src"):
            if values.get(attribute):
                self.references.append((attribute, values[attribute]))


@cache
def parse_page(page: Path) -> LinkParser:
    parser = LinkParser()
    parser.feed(page.read_text(encoding="utf-8"))
    return parser

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "public"
errors: list[str] = []
for page in root.rglob("*.html"):
    document = parse_page(page)
    for attribute, href in document.references:
        parsed = urlsplit(href)
        if parsed.scheme or parsed.netloc or href.startswith("mailto:"):
            continue
        if href.startswith("#"):
            if parsed.fragment and unquote(parsed.fragment) not in document.ids:
                errors.append(f"{page.relative_to(root)} -> missing fragment #{parsed.fragment}")
            continue
        path = parsed.path
        if not path:
            continue
        target = root / path.lstrip("/") if path.startswith("/") else page.parent / path
        candidates = (target / "index.html", target.with_suffix(".html")) if target.is_dir() else (target, target / "index.html", target.with_suffix(".html"))
        existing = next((candidate for candidate in candidates if candidate.is_file()), None)
        if not existing:
            errors.append(f"{page.relative_to(root)} -> {href}")
        elif attribute == "href" and parsed.fragment and existing.suffix == ".html":
            if unquote(parsed.fragment) not in parse_page(existing).ids:
                errors.append(f"{page.relative_to(root)} -> {href} (missing fragment)")
if errors:
    print("失效内部链接:\n" + "\n".join(errors[:30]), file=sys.stderr)
    raise SystemExit(1)
