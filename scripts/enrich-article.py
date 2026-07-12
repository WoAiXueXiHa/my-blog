#!/usr/bin/env python3
"""Fill empty summary/categories/tags from article content deterministically."""
from __future__ import annotations

import re
import sys
from pathlib import Path

CATEGORY_BY_TOPIC = {
    "golang": "Go 语言",
    "go-linked-list": "数据结构",
    "data-structures": "数据结构",
    "algorithms": "算法",
    "backend": "后端工程",
    "networks": "计算机网络",
    "os": "操作系统",
    "ai": "AI 工程",
    "reading": "阅读与思考",
    "devops": "工程实践",
    "frontend": "前端工程",
}
TOPIC_ALIASES = {
    "go-linked-list": "data-structures",
    "datastructure-linked-list": "data-structures",
    "data-structure": "data-structures",
    "network": "networks",
    "operating-system": "os",
}

KEYWORDS = {
    "Go": ("go ", "golang", "goroutine", "channel", "slice", "string", "map"),
    "数据结构": ("数据结构", "链表", "数组", "栈", "队列", "树", "哈希"),
    "链表": ("链表", "listnode", "linked list"),
    "算法": ("算法", "复杂度", "leetcode", "排序", "搜索"),
    "并发": ("并发", "goroutine", "线程", "协程", "锁"),
    "内存": ("内存", "指针", "gc", "逃逸", "分配"),
    "网络": ("网络", "tcp", "http", "socket", "epoll"),
    "后端": ("后端", "服务", "数据库", "api"),
    "AI": (" ai ", "人工智能", "大模型", "llm"),
}

SERIES_RULES = (
    ("Go 底层原理", ("go string", "go slice", "go map", "interface", "defer", "panic", "goroutine", "golang")),
    ("数据结构基础", ("链表", "数组", "栈", "队列", "二叉树", "哈希表", "linked list", "listnode")),
    ("计算机网络基础", ("tcp", "http", "socket", "epoll", "网络协议")),
    ("操作系统基础", ("进程", "线程", "虚拟内存", "文件系统", "操作系统")),
    ("AI 工程实践", ("rag", "agent", "llm", "大模型", "人工智能")),
)


def field(front: str, name: str) -> str:
    match = re.search(rf"(?m)^{re.escape(name)}:\s*[\"']?(.*?)[\"']?\s*$", front)
    return match.group(1).strip().strip('"\'') if match else ""


def replace_field(front: str, name: str, value: str) -> str:
    line = f"{name}: {value}"
    pattern = rf"(?m)^{re.escape(name)}:.*$"
    return re.sub(pattern, lambda _: line, front, count=1) if re.search(pattern, front) else front + "\n" + line


def plain_paragraphs(body: str) -> list[str]:
    body = re.sub(r"```.*?```", "", body, flags=re.S)
    body = re.sub(r"!\[[^]]*]\([^)]*\)", "", body)
    paragraphs: list[str] = []
    for block in re.split(r"\n\s*\n", body):
        text = " ".join(line.strip() for line in block.splitlines() if not re.match(r"^\s*(#{1,6}|[-*+] |\d+[.)] |>|\||---)", line))
        text = re.sub(r"[`*_~]", "", text)
        text = re.sub(r"\[([^]]+)]\([^)]*\)", r"\1", text)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) >= 12:
            paragraphs.append(text)
    return paragraphs


def yaml_list(value: str) -> list[str]:
    return re.findall(r'["\']([^"\']+)["\']', value)


def infer_series(title: str, topic: str, body: str) -> str:
    haystack = f" {title} {topic} {body[:4000]} ".lower()
    for name, words in SERIES_RULES:
        if any(word.lower() in haystack for word in words):
            return name
    return ""


def next_series_order(current: Path, series_name: str) -> int:
    highest = 0
    for candidate in current.parents[1].glob("*/index.md"):
        if candidate == current:
            continue
        text = candidate.read_text(encoding="utf-8")
        match = re.match(r"^---\s*\n(.*?)\n---+", text, flags=re.S)
        if not match or series_name not in yaml_list(field(match.group(1), "series")):
            continue
        raw_order = field(match.group(1), "seriesOrder")
        if raw_order.isdigit():
            highest = max(highest, int(raw_order))
    return highest + 1


def main() -> int:
    path = Path(sys.argv[1])
    source = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---+\s*\n?", source, flags=re.S)
    if not match:
        raise SystemExit(f"无法识别 front matter: {path}")
    front, body = match.group(1), source[match.end():]
    topic = field(front, "topic")
    normalized_topic = TOPIC_ALIASES.get(topic.lower(), topic)
    if normalized_topic != topic:
        topic = normalized_topic
        front = replace_field(front, "topic", f'"{topic}"')
    title = field(front, "title")
    paragraphs = plain_paragraphs(body)

    if not field(front, "summary"):
        summary = " ".join(paragraphs[:2])
        if len(summary) > 150:
            summary = summary[:147].rstrip("，。；：,. ") + "…"
        front = replace_field(front, "summary", f'"{summary.replace(chr(34), chr(39))}"')

    if not field(front, "categories").strip("[] "):
        category = CATEGORY_BY_TOPIC.get(topic, topic.replace("-", " ").title() or "技术笔记")
        front = replace_field(front, "categories", f'["{category}"]')

    if not field(front, "tags").strip("[] "):
        haystack = f" {topic} {body} ".lower()
        tags = [tag for tag, words in KEYWORDS.items() if any(word.lower() in haystack for word in words)][:4]
        if not tags:
            tags = [CATEGORY_BY_TOPIC.get(topic, topic or "技术笔记")]
        front = replace_field(front, "tags", "[" + ", ".join(f'"{tag}"' for tag in tags) + "]")

    existing_series = yaml_list(field(front, "series"))
    series_name = existing_series[0] if existing_series else infer_series(title, topic, body)
    if series_name and not existing_series:
        front = replace_field(front, "series", f'["{series_name}"]')
    if series_name and not field(front, "seriesOrder"):
        front = replace_field(front, "seriesOrder", str(next_series_order(path, series_name)))

    path.write_text(f"---\n{front}\n---\n\n{body.lstrip()}", encoding="utf-8")
    print(f"已自动识别摘要、分类、标签和学习系列: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
