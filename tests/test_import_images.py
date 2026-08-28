import os
import stat
import struct
import subprocess
import tempfile
import unittest
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "import-images.sh"


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))


def one_pixel_png() -> bytes:
    header = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    pixels = zlib.compress(b"\x00\xff\x00\x00")
    return b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header) + png_chunk(b"IDAT", pixels) + png_chunk(b"IEND", b"")


class ImportImagesTests(unittest.TestCase):
    PNG = one_pixel_png()

    def run_import(self, mode: str = "success", article_text: str | None = None, existing: bytes | None = None):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            article_dir = tmp_path / "content" / "posts" / "go-channel"
            article_dir.mkdir(parents=True)
            article = article_dir / "index.md"
            url = "https://gitee.com/binary-whispers/pic/raw/master///20260827205748455.png"
            article.write_text(article_text or f"![channel]({url})\n![same]({url}?raw=1)\n", encoding="utf-8")
            if existing is not None:
                (article_dir / "20260827205748455.png").write_bytes(existing)

            bin_dir = tmp_path / "bin"
            bin_dir.mkdir()
            source_image = tmp_path / "source.png"
            source_image.write_bytes(self.PNG)
            fake_curl = bin_dir / "curl"
            fake_curl.write_text(
                """#!/usr/bin/env bash
set -euo pipefail
output=""
while (($#)); do
  if [[ "$1" == "--output" ]]; then
    output="$2"
    shift 2
  else
    shift
  fi
done
[[ -n "$output" ]] || exit 2
case "$FAKE_CURL_MODE" in
  success) cp "$FAKE_IMAGE_SOURCE" "$output" ;;
  invalid) printf 'not-an-image' > "$output" ;;
  fail) printf 'partial' > "$output"; exit 22 ;;
esac
""",
                encoding="utf-8",
            )
            fake_curl.chmod(fake_curl.stat().st_mode | stat.S_IXUSR)

            env = os.environ.copy()
            env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
            env["FAKE_CURL_MODE"] = mode
            env["FAKE_IMAGE_SOURCE"] = str(source_image)
            result = subprocess.run(
                [str(SCRIPT), str(article)],
                cwd=ROOT,
                env=env,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            files = {path.name: path.read_bytes() for path in article_dir.iterdir() if path.is_file()}
            return result, article.read_text(encoding="utf-8"), files

    def test_gitee_images_are_downloaded_and_rewritten(self):
        result, article, files = self.run_import()
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertEqual(
            article,
            "![channel](20260827205748455.png)\n"
            "![same](20260827205748455.png)\n",
        )
        self.assertEqual(files["20260827205748455.png"], self.PNG)

    def test_download_failure_leaves_markdown_and_no_partial_file(self):
        result, article, files = self.run_import("fail")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("https://gitee.com/", article)
        self.assertFalse(any(name.endswith(".png") for name in files))
        self.assertFalse(any(".download." in name for name in files))

    def test_invalid_response_leaves_markdown_and_no_image(self):
        result, article, files = self.run_import("invalid")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("https://gitee.com/", article)
        self.assertFalse(any(name.endswith(".png") for name in files))
        self.assertFalse(any(".download." in name for name in files))

    def test_existing_partial_image_is_replaced_atomically(self):
        result, article, files = self.run_import(existing=b"partial")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("https://gitee.com/", article)
        self.assertEqual(files["20260827205748455.png"], self.PNG)

    def test_same_filename_from_different_urls_fails_before_download(self):
        article = (
            "![one](https://gitee.com/binary-whispers/pic/raw/master/a/same.png)\n"
            "![two](https://gitee.com/binary-whispers/pic/raw/master/b/same.png)\n"
        )
        result, text, files = self.run_import(article_text=article)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("多个图片地址使用了同一文件名", result.stderr)
        self.assertEqual(text, article)
        self.assertFalse(any(name.endswith(".png") for name in files))


if __name__ == "__main__":
    unittest.main()
