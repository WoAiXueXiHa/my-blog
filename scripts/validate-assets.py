#!/usr/bin/env python3
import sys
from pathlib import Path

from image_validation import validate_image


ROOT = Path(__file__).resolve().parents[1]
POSTS = ROOT / "content" / "posts"
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_ARTICLE_BYTES = 40 * 1024 * 1024
WARN_SITE_BYTES = 150 * 1024 * 1024
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def main() -> int:
    errors: list[str] = []
    site_bytes = 0
    for article_dir in sorted(path for path in POSTS.iterdir() if path.is_dir()):
        assets = [path for path in article_dir.iterdir() if path.is_file() and path.name != "index.md"]
        article_bytes = sum(path.stat().st_size for path in assets)
        site_bytes += article_bytes
        if article_bytes > MAX_ARTICLE_BYTES:
            errors.append(f"{article_dir.relative_to(ROOT)} 资源合计超过 40 MiB")
        for asset in assets:
            size = asset.stat().st_size
            if size > MAX_FILE_BYTES:
                errors.append(f"{asset.relative_to(ROOT)} 超过 8 MiB，请压缩后再发布")
            if asset.suffix.lower() in IMAGE_SUFFIXES:
                try:
                    validate_image(asset)
                except (OSError, ValueError) as error:
                    errors.append(f"{asset.relative_to(ROOT)} 不是有效图片: {error}")
    if site_bytes > WARN_SITE_BYTES:
        print(f"警告: 文章资源合计 {site_bytes / 1024 / 1024:.1f} MiB，超过 150 MiB 预算", file=sys.stderr)
    if errors:
        print("\n".join(f"错误: {error}" for error in errors), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
