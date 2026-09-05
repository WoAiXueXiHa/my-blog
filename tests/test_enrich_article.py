import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "enrich-article.py"
SPEC = importlib.util.spec_from_file_location("enrich_article", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class MetadataInferenceTests(unittest.TestCase):
    def test_ai_examples_do_not_create_database_tags(self):
        body = """
## 什么是大模型
大模型通过大量训练理解语言。
示例会提到 Redis、MySQL、数据库、string 和数据结构。
## Transformer 与注意力机制
Self-Attention 是核心机制。
"""
        tags = MODULE.score_tags("大模型基本认知", "ai", body)
        self.assertIn("AI", tags)
        self.assertIn("Transformer", tags)
        self.assertNotIn("数据库", tags)
        self.assertNotIn("字符串", tags)

    def test_declared_topic_controls_automatic_series(self):
        body = "数据库 Redis MySQL 数据库与存储"
        self.assertEqual(MODULE.infer_series("大模型基本认知", "ai", body), "AI 工程实践")

    def test_generated_summary_escapes_backslashes_for_yaml(self):
        with tempfile.TemporaryDirectory() as directory:
            article = Path(directory) / "content" / "posts" / "sample" / "index.md"
            article.parent.mkdir(parents=True)
            article.write_text(
                """---
title: "Windows 路径"
topic: "devops"
summary: ""
categories: []
tags: []
series: []
---

## 路径

请把文件复制到 C:\\users\\public\\documents，然后继续后续操作。
""",
                encoding="utf-8",
            )
            result = subprocess.run(
                ["python3", str(SCRIPT), str(article)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            summary_line = next(
                line for line in article.read_text(encoding="utf-8").splitlines()
                if line.startswith("summary: ")
            )
            self.assertIn("\\\\users\\\\public", summary_line)
            self.assertIn("C:\\users\\public", json.loads(summary_line.removeprefix("summary: ")))


if __name__ == "__main__":
    unittest.main()
