#!/usr/bin/env python3
import sys
import zlib
from pathlib import Path


def validate_png(data: bytes) -> None:
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("PNG signature is missing")
    offset = 8
    chunks: list[bytes] = []
    saw_header = False
    saw_end = False
    while offset < len(data):
        if offset + 12 > len(data):
            raise ValueError("PNG chunk is truncated")
        length = int.from_bytes(data[offset : offset + 4], "big")
        kind = data[offset + 4 : offset + 8]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError("PNG chunk payload is truncated")
        payload = data[offset + 8 : offset + 8 + length]
        expected_crc = int.from_bytes(data[offset + 8 + length : end], "big")
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != expected_crc:
            raise ValueError(f"PNG {kind.decode('ascii', 'replace')} CRC is invalid")
        if not saw_header:
            if kind != b"IHDR" or length != 13:
                raise ValueError("PNG IHDR is invalid")
            width = int.from_bytes(payload[0:4], "big")
            height = int.from_bytes(payload[4:8], "big")
            if width < 1 or height < 1:
                raise ValueError("PNG dimensions are invalid")
            saw_header = True
        if kind == b"IDAT":
            chunks.append(payload)
        if kind == b"IEND":
            saw_end = True
            offset = end
            break
        offset = end
    if not saw_end or offset != len(data):
        raise ValueError("PNG IEND is missing or trailing data exists")
    if not chunks:
        raise ValueError("PNG image data is missing")
    try:
        zlib.decompress(b"".join(chunks))
    except zlib.error as error:
        raise ValueError(f"PNG image data cannot be decompressed: {error}") from error


def validate_image(path: Path, expected_name: str | None = None) -> None:
    data = path.read_bytes()
    if not data:
        raise ValueError("file is empty")
    suffix = Path(expected_name).suffix.lower() if expected_name else path.suffix.lower()
    if suffix == ".png":
        validate_png(data)
    elif suffix in {".jpg", ".jpeg"}:
        if not (data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9")):
            raise ValueError("JPEG markers are invalid")
    elif suffix == ".gif":
        if not (data.startswith((b"GIF87a", b"GIF89a")) and data.endswith(b";")):
            raise ValueError("GIF structure is invalid")
    elif suffix == ".webp":
        if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
            raise ValueError("WebP structure is invalid")
        if int.from_bytes(data[4:8], "little") + 8 != len(data):
            raise ValueError("WebP length is invalid")
    else:
        raise ValueError(f"unsupported image extension: {suffix or '(none)'}")


def main() -> int:
    if len(sys.argv) not in {2, 3}:
        print(f"usage: {Path(sys.argv[0]).name} IMAGE [EXPECTED_NAME]", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    try:
        validate_image(path, sys.argv[2] if len(sys.argv) == 3 else None)
    except (OSError, ValueError) as error:
        print(f"invalid image {path}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
