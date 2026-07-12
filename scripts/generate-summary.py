#!/usr/bin/env python3
"""
Generate intelligent article summaries using DeepSeek API.
Auto-detects article type and produces high-quality Chinese summaries.

Usage:
    ./scripts/generate-summary.py content/posts/linked-list/index.md
    ./scripts/generate-summary.py --dry-run content/posts/linked-list/index.md

Requires: DEEPSEEK_API_KEY environment variable.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────
API_URL = "https://api.deepseek.com/chat/completions"
MODEL = "deepseek-chat"
MAX_TOKENS = 300
TEMPERATURE = 0.3
TIMEOUT_SEC = 20

# ── Article type detection ─────────────────────────────────────
TYPE_SIGNALS = {
    "deep-dive": {
        "title_words": ["原理", "底层", "源码", "内部", "机制", "实现", "运行时"],
        "min_code_ratio": 0.25,
    },
    "tutorial": {
        "title_words": ["深度解析", "详解", "入门", "实践", "构建", "实战", "手撕"],
        "min_code_ratio": 0.15,
    },
    "algo-solution": {
        "title_words": ["LeetCode", "题解", "算法", "解题"],
        "leetocde_links": True,
    },
    "note": {
        "title_words": ["阅读", "思考", "笔记", "记录", "随想"],
        "max_code_ratio": 0.15,
    },
}


def read_article(path: Path) -> tuple[str, str]:
    """Parse frontmatter and body from a markdown file."""
    source = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---+\s*\n?", source, flags=re.S)
    if not match:
        raise SystemExit(f"无法识别 front matter: {path}")
    return match.group(1), source[match.end():]


def field(front: str, name: str) -> str:
    """Extract a single frontmatter field value."""
    m = re.search(rf"(?m)^{re.escape(name)}:\s*[\"']?(.*?)[\"']?\s*$", front)
    return m.group(1).strip().strip('"\'') if m else ""


def yaml_list(value: str) -> list[str]:
    return re.findall(r'["\']([^"\']+)["\']', value)


def clean_body(body: str) -> str:
    """Strip code blocks, images, links, and formatting from markdown body."""
    # Remove fenced code blocks
    text = re.sub(r"```.*?```", " ", body, flags=re.S)
    # Remove inline code
    text = re.sub(r"`[^`]+`", " ", text)
    # Remove images
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    # Remove links, keep text
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Remove heading markers, keep text
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.M)
    # Remove bold/italic markers
    text = re.sub(r"[*_~]{1,3}", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_headings(body: str) -> list[str]:
    """Extract section heading text from markdown body."""
    headings = []
    for line in body.splitlines():
        m = re.match(r"^#{1,6}\s+(.+)", line)
        if m:
            h = m.group(1).strip()
            # Strip markdown formatting inside heading
            h = re.sub(r"[*_`~\[\]]", "", h)
            if len(h) >= 2:
                headings.append(h)
    return headings


def detect_article_type(title: str, body: str) -> str:
    """Detect article type from title signals and code/text ratio."""
    code_chars = sum(len(b) for b in re.findall(r"```.*?```", body, flags=re.S))
    total_chars = max(len(body), 1)
    code_ratio = code_chars / total_chars

    # Check algo-solution first (strong signal: LeetCode links)
    if re.search(r"leetcode\.cn|LeetCode", body, re.I):
        return "algo-solution"

    # Score each type
    scores: dict[str, int] = {}
    for typename, signals in TYPE_SIGNALS.items():
        score = 0
        for word in signals.get("title_words", []):
            if word.lower() in title.lower():
                score += 3
        if "min_code_ratio" in signals and code_ratio >= signals["min_code_ratio"]:
            score += 2
        if "max_code_ratio" in signals and code_ratio <= signals["max_code_ratio"]:
            score += 2
        if score > 0:
            scores[typename] = score

    if scores:
        return max(scores, key=lambda k: scores[k])
    return "tutorial"  # default


def build_prompt(title: str, topic: str, article_type: str,
                 headings: list[str], body_clean: str) -> str:
    """Build the prompt for summary generation."""
    type_desc = {
        "deep-dive": "一篇深入底层原理的技术文章",
        "tutorial": "一篇带有完整代码实现的技术教程",
        "algo-solution": "一篇算法题解文章",
        "note": "一篇个人阅读或思考笔记",
    }

    heading_tree = "\n".join(f"  - {h}" for h in headings[:15]) if headings else "（无章节标题）"
    excerpt = body_clean[:1500]

    return f"""你是技术博客的编辑。为以下{type_desc.get(article_type, '技术文章')}写一个1-2句的中文摘要。

要求：
- 不超过150字
- 不重复标题
- 概括文章要解决什么问题和核心内容
- 语言精炼、专业、有吸引力
- 只输出摘要本身，不要加任何前缀或说明

文章标题：{title}
文章主题：{topic}
章节结构：
{heading_tree}

文章内容（前段）：
{excerpt}
"""


def call_deepseek(prompt: str, api_key: str) -> str | None:
    """Call DeepSeek API. Returns summary string or None on failure."""
    data = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "你是一个专业的技术编辑，擅长写精炼的文章摘要。"},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
        "stream": False,
    }).encode("utf-8")

    req = urllib.request.Request(API_URL, data=data, headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    })

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as e:
        print(f"  DeepSeek API HTTP {e.code}: {e.reason}", file=sys.stderr)
        return None
    except urllib.error.URLError as e:
        print(f"  DeepSeek API 网络错误: {e.reason}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  DeepSeek API 调用失败: {e}", file=sys.stderr)
        return None


def fallback_summary(body_clean: str) -> str:
    """Rule-based summary as fallback when API is unavailable."""
    # Split into sentences
    sentences = re.split(r"[。！？；\n]", body_clean)
    # Take meaningful sentences (>10 chars) from the first 500 chars
    candidates = [s.strip() for s in sentences
                  if 12 <= len(s.strip()) <= 80 and not s.strip().endswith("：")]
    if len(candidates) >= 2:
        summary = "。".join(candidates[:2]) + "。"
    elif candidates:
        summary = candidates[0] + "。"
    else:
        summary = body_clean[:147].rstrip("，。；：,. ") + "…"
    return summary[:150]


def replace_field(front: str, name: str, value: str) -> str:
    """Replace or add a frontmatter field."""
    line = f'{name}: "{value}"'
    if re.search(rf"(?m)^{re.escape(name)}:", front):
        return re.sub(rf"(?m)^{re.escape(name)}:.*$",
                      lambda _: line, front, count=1)
    return front.rstrip() + "\n" + line


def main() -> int:
    dry_run = False
    args = sys.argv[1:]

    if "--dry-run" in args:
        dry_run = True
        args.remove("--dry-run")

    if not args:
        print("用法: ./scripts/generate-summary.py [--dry-run] <文章路径>")
        return 1

    path = Path(args[0])
    if not path.exists():
        print(f"文件不存在: {path}", file=sys.stderr)
        return 1

    front, body = read_article(path)
    title = field(front, "title")
    topic = field(front, "topic")
    current_summary = field(front, "summary")

    if not title:
        print(f"文章缺少 title: {path}", file=sys.stderr)
        return 1

    # Detect article type
    article_type = detect_article_type(title, body)
    print(f"  文章类型: {article_type}")

    # Extract structure
    headings = extract_headings(body)
    body_clean = clean_body(body)

    # Try DeepSeek API
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    summary = None

    if api_key:
        prompt = build_prompt(title, topic, article_type, headings, body_clean)
        print(f"  调用 DeepSeek API ({MODEL})...")
        summary = call_deepseek(prompt, api_key)

    if not summary:
        print("  降级为规则提取…")
        summary = fallback_summary(body_clean)
        if current_summary and len(current_summary) >= 20:
            print("  保留现有摘要（已有足够长度的手写摘要）")
            summary = None  # Don't overwrite existing good summary

    if not summary:
        print("  摘要未变更。")
        return 0

    # Clean up the summary
    summary = summary.strip().strip('"\'')
    if len(summary) > 150:
        summary = summary[:147].rstrip("，。；：,. ") + "…"

    print(f"  生成摘要: {summary}")

    if dry_run:
        print(f"\n  [DRY RUN] 将写入: summary: \"{summary}\"")
        return 0

    # Write back
    new_front = replace_field(front, "summary", summary.replace('"', "'"))
    # Ensure the related field exists if other articles have it
    if not field(front, "related"):
        new_front = replace_field(new_front, "related", "[]")

    path.write_text(f"---\n{new_front}\n---\n\n{body.lstrip()}", encoding="utf-8")
    print(f"  已更新: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
