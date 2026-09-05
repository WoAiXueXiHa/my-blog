import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "validate-links.py"


class LinkValidationTests(unittest.TestCase):
    def run_validator(self, pages: dict[str, str]):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative, content in pages.items():
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
            return subprocess.run(
                ["python3", str(SCRIPT), str(root)],
                capture_output=True,
                text=True,
            )

    def test_accepts_unquoted_directory_link_with_existing_fragment(self):
        result = self.run_validator({
            "index.html": "<a href=/paths/#valid>Path</a>",
            "paths/index.html": "<section id=valid></section>",
        })
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_unquoted_directory_link_with_missing_fragment(self):
        result = self.run_validator({
            "index.html": "<a href=/paths/#missing>Path</a>",
            "paths/index.html": "<section id=valid></section>",
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing fragment", result.stderr)


if __name__ == "__main__":
    unittest.main()
