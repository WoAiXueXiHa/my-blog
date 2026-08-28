import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "smoke-test.sh"


class SmokeTestTests(unittest.TestCase):
    def run_smoke(self, actual_sha: str, expected_sha: str) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            fake_curl = tmp_path / "curl"
            fake_curl.write_text(
                """#!/usr/bin/env bash
set -euo pipefail
output=""
headers=""
url=""
while (($#)); do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    --dump-header) headers="$2"; shift 2 ;;
    --*) shift ;;
    *) url="$1"; shift ;;
  esac
done
printf 'Content-Security-Policy: default-src self\r\nX-Content-Type-Options: nosniff\r\n' > "$headers"
case "$url" in
  */index.json)
    printf '[{"title":"Test","permalink":"/posts/test/","type":"article","summary":"Summary","headings":["Heading"],"tags":["test"],"lastmod":"2026-01-01"}]' > "$output"
    ;;
  */__version.json)
    printf '{"sha":"%s"}' "$FAKE_DEPLOYMENT_SHA" > "$output"
    ;;
  *) printf '<html></html>' > "$output" ;;
esac
""",
                encoding="utf-8",
            )
            fake_curl.chmod(fake_curl.stat().st_mode | stat.S_IXUSR)
            env = os.environ.copy()
            env["PATH"] = f"{tmp_path}{os.pathsep}{env['PATH']}"
            env["FAKE_DEPLOYMENT_SHA"] = actual_sha
            env["EXPECTED_SHA"] = expected_sha
            return subprocess.run(
                [str(SCRIPT), "https://deployment.example", "/posts/test/"],
                cwd=ROOT,
                env=env,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

    def test_matching_deployment_sha_passes(self):
        result = self.run_smoke("abc123", "abc123")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_mismatched_deployment_sha_fails(self):
        result = self.run_smoke("old", "new")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("deployment SHA mismatch", result.stderr)


if __name__ == "__main__":
    unittest.main()
