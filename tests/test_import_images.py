import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "import-images.sh"


class ImportImagesTests(unittest.TestCase):
    def test_gitee_images_are_downloaded_and_rewritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            article_dir = tmp_path / "content" / "posts" / "go-channel"
            article_dir.mkdir(parents=True)
            article = article_dir / "index.md"
            url = "https://gitee.com/binary-whispers/pic/raw/master///20260827205748455.png"
            article.write_text(
                f"![channel]({url})\n![same]({url}?raw=1)\n",
                encoding="utf-8",
            )

            bin_dir = tmp_path / "bin"
            bin_dir.mkdir()
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
printf 'png-bytes' > "$output"
""",
                encoding="utf-8",
            )
            fake_curl.chmod(fake_curl.stat().st_mode | stat.S_IXUSR)

            env = os.environ.copy()
            env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
            subprocess.run(
                [str(SCRIPT), str(article)],
                cwd=ROOT,
                env=env,
                check=True,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            self.assertEqual(
                article.read_text(encoding="utf-8"),
                "![channel](20260827205748455.png)\n"
                "![same](20260827205748455.png)\n",
            )
            self.assertEqual(
                (article_dir / "20260827205748455.png").read_text(encoding="utf-8"),
                "png-bytes",
            )


if __name__ == "__main__":
    unittest.main()
