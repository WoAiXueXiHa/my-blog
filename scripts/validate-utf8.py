#!/usr/bin/env python3
"""Reject non-UTF-8 article sources with a useful location before publishing."""

from __future__ import annotations

import sys
from pathlib import Path


def article_paths(arguments: list[str]) -> list[Path]:
    if arguments:
        return [Path(argument) for argument in arguments]
    return sorted(Path("content/posts").glob("*/index.md"))


def main() -> int:
    failed = False
    for path in article_paths(sys.argv[1:]):
        data = path.read_bytes()
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as error:
            line = data.count(b"\n", 0, error.start) + 1
            line_start = data.rfind(b"\n", 0, error.start) + 1
            column = error.start - line_start + 1
            print(
                f"错误: {path} 不是有效 UTF-8（第 {line} 行，第 {column} 列，"
                f"字节 0x{data[error.start]:02x}）",
                file=sys.stderr,
            )
            failed = True

    if failed:
        print("请先在编辑器中以 UTF-8 重新保存文章；发布流程尚未修改文件。", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
