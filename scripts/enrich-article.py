#!/usr/bin/env python3
"""Fill empty summary/categories/tags from article content deterministically."""
from __future__ import annotations

import re
import sys
from pathlib import Path

CATEGORY_BY_TOPIC = {
    "golang": "Go 语言",
    "data-structures": "数据结构",
    "algorithms": "算法",
    "backend": "后端工程",
    "networks": "计算机网络",
    "os": "操作系统",
    "ai": "AI 工程",
    "mysql": "MySQL",
    "reading": "阅读与思考",
    "devops": "工程实践",
    "frontend": "前端工程",
}
TOPIC_ALIASES = {
    # ── data-structures 变体 ──
    "go-linked-list": "data-structures",
    "datastructure-linked-list": "data-structures",
    "datastructure-heap": "data-structures",
    "datastructure-tree": "data-structures",
    "datastructure-graph": "data-structures",
    "datastructure-stack": "data-structures",
    "datastructure-queue": "data-structures",
    "datastructure-hash": "data-structures",
    "datastructure-array": "data-structures",
    "data-structure": "data-structures",
    # ── golang 变体 ──
    "go-string": "golang",
    "go-slice": "golang",
    "go-map": "golang",
    "go-channel": "golang",
    "go-concurrency": "golang",
    "go-interface": "golang",
    "go-defer": "golang",
    "go-panic": "golang",
    "go-context": "golang",
    "go-struct": "golang",
    # ── 网络变体 ──
    "network": "networks",
    # ── OS 变体 ──
    "operating-system": "os",
    # ── 常见拼写变体 ──
    "database": "backend",
    "databases": "backend",
    "distributed": "backend",
    "microservice": "backend",
    "docker": "devops",
    "kubernetes": "devops",
    "testing": "backend",
    "security": "backend",
}

# Automatic metadata must stay inside the article's declared knowledge domain.
# Authors can still set any cross-domain tags manually; inference is deliberately conservative.
PRIMARY_SERIES_BY_TOPIC = {
    "golang": "Go 底层原理",
    "data-structures": "数据结构基础",
    "networks": "计算机网络基础",
    "os": "操作系统基础",
    "ai": "AI 工程实践",
    "mysql": "MySQL 基础",
}

TAG_ALLOWLIST_BY_TOPIC = {
    "golang": {"Go", "内存", "字符串", "切片", "并发", "编译"},
    "data-structures": {"数据结构", "链表", "算法", "堆"},
    "algorithms": {"算法", "数据结构", "堆", "链表"},
    "backend": {"数据库", "缓存", "分布式", "网络", "安全", "测试"},
    "networks": {"网络", "安全", "分布式"},
    "os": {"内存", "并发", "编译"},
    "ai": {"AI", "LLM", "Transformer", "注意力机制"},
    "mysql": {"数据库", "MySQL", "SQL", "DDL", "索引", "事务"},
    "devops": {"容器", "测试", "安全"},
}

KEYWORDS = {
    "Go": (
        "go ", "golang", "goroutine", "channel", "defer", "panic", "interface",
        "map", "struct", "select", "context", "iota", "make", "new", "comparable",
    ),
    "数据结构": (
        "数据结构", "数组", "栈", "队列", "树", "哈希表", "堆", "图", "二叉树",
        "优先队列", "跳表", "skip list", "并查集", "union find", "trie", "字典树",
        "b树", "红黑树", "red-black", "前缀树", "tree", "graph", "stack", "queue",
        "deque", "binary search tree", "bst",
    ),
    "链表": (
        "链表", "listnode", "linked list", "单链表", "双向链表", "环形链表",
        "双向", "环形", "头节点", "dummy", "哨兵", "singly", "doubly", "circular",
    ),
    "算法": (
        "算法", "复杂度", "leetcode", "排序", "搜索", "动态规划", "贪心", "二分", "递归",
        "回溯", "分治", "前缀和", "滑动窗口", "sliding window", "单调栈", "单调队列",
        "kmp", "bfs", "dfs", "拓扑排序", "topological", "记忆化", "memo", "双指针",
        "位运算", "bit manipulation", "堆排序", "快速排序", "归并排序", "top k", "heapify",
    ),
    "并发": (
        "并发", "goroutine", "线程", "协程", "channel", "锁", "同步", "原子",
        "mutex", "waitgroup", "semaphore", "rwmutex", "原子操作", "cas",
        "sync.once", "errgroup",
    ),
    "内存": (
        "内存", "指针", "gc", "逃逸", "内存分配", "栈内存", "堆内存", "分配器",
        "arena", "对齐", "内存对齐", "tcmalloc", "copy-on-write", "写时复制",
        "mark-sweep", "引用计数", "stack vs heap",
    ),
    "字符串": (
        "string", "字符串", "utf", "rune", "字节", "字符",
        "utf-8", "unicode", "ascii", "编码", "拼接", "builder", "clone", "compare",
    ),
    "切片": (
        "slice", "切片", "扩容", "append", "底层数组", "容量",
        "subslice", "copy", "grow", "memmove", "clear",
    ),
    "网络": (
        "网络", "tcp", "http", "socket", "epoll", "协议",
        "udp", "dns", "tls", "ssl", "websocket", "grpc", "rpc",
        "负载均衡", "反向代理", "cdn", "quic", "路由", "nginx",
    ),
    "缓存": (
        "缓存", "cache", "lru", "lfu", "淘汰",
        "redis", "memcached", "过期", "淘汰策略", "ttl",
        "cache aside", "write-through", "write-back",
        "缓存穿透", "缓存击穿", "缓存雪崩", "一致性哈希",
    ),
    "AI": (
        "人工智能", "大模型", "llm", "agent", "rag", "prompt", "模型训练", "深度学习",
        "transformer", "attention", "embedding", "tokenizer", "fine-tune", "微调",
        "推理", "inference", "training", "gpu", "npu", "rlhf", "reinforcement",
        "function calling",
    ),
    # ── 新增 7 组 ──
    "数据库": (
        "数据库", "database", "sql", "mysql", "postgresql", "mongodb", "redis",
        "索引", "index", "事务", "transaction", "acid", "orm", "连接池",
        "分库分表", "主从", "binlog", "wal", "b+树", "lsm",
    ),
    "MySQL": (
        "mysql", "innodb", "binlog", "redo log", "undo log", "sql", "ddl",
        "dml", "表", "数据库", "索引", "事务", "主键", "外键", "约束",
        "explain", "慢查询", "主从复制", "隔离级别",
    ),
    "SQL": (
        "sql", "select", "insert", "update", "delete", "join", "where",
        "group by", "order by", "having", "limit", "ddl", "dml", "dcl",
    ),
    "DDL": (
        "ddl", "create database", "create table", "alter table", "drop table",
        "truncate", "建库", "建表", "改表", "删表", "字段类型", "约束",
    ),
    "分布式": (
        "分布式", "distributed", "raft", "paxos", "共识", "consensus", "一致性",
        "etcd", "zookeeper", "消息队列", "mq", "kafka", "spanner",
        "微服务", "microservices", "cap theorem",
    ),
    "测试": (
        "测试", "testing", "unit test", "单元测试", "mock", "stub",
        "integration", "benchmark", "e2e", "覆盖率", "coverage",
        "table-driven", "fuzz", "tdd",
    ),
    "容器": (
        "docker", "kubernetes", "k8s", "pod", "镜像",
        "编排", "helm", "istio", "service mesh", "sidecar", "dockerfile",
        "docker-compose", "containerd",
    ),
    "安全": (
        "安全", "security", "auth", "认证", "授权", "jwt", "oauth",
        "加密", "解密", "aes", "rsa", "tls", "https", "xss", "csrf", "注入",
    ),
    "编译": (
        "编译", "compiler", "汇编", "assembly", "ast", "ir", "ssa",
        "链接器", "linker", "jit", "llvm", "parser", "lexer",
    ),
    "设计模式": (
        "设计模式", "design pattern", "单例", "singleton", "工厂", "factory",
        "观察者", "observer", "策略", "strategy", "装饰器", "decorator", "solid", "ddd",
    ),
}

KEYWORDS.update({
    "LLM": ("llm", "大模型", "语言模型", "large language model"),
    "Transformer": ("transformer", "encoder", "decoder", "self-attention"),
    "注意力机制": ("注意力", "attention", "self-attention", "multi-head"),
})

SERIES_RULES = (
    ("Go 底层原理", (
        "go string", "go slice", "go map", "interface", "defer", "panic", "goroutine", "golang",
        "go struct", "go context", "go channel", "go defer", "go panic",
    )),
    ("数据结构基础", (
        "链表", "数组", "栈", "队列", "二叉树", "哈希表", "堆", "heap",
        "linked list", "listnode", "优先队列", "跳表", "skip list", "trie",
        "红黑树", "red-black", "b树", "b-tree", "graph", "图", "tree", "树",
    )),
    ("计算机网络基础", (
        "tcp", "http", "socket", "epoll", "网络协议",
        "udp", "dns", "tls", "ssl", "websocket", "grpc", "rpc", "quic", "负载均衡", "nginx",
    )),
    ("操作系统基础", ("进程", "线程", "虚拟内存", "文件系统", "操作系统")),
    ("AI 工程实践", ("rag", "agent", "llm", "大模型", "人工智能")),
    # ── 新增系列 ──
    ("数据库与存储", (
        "数据库", "database", "sql", "mysql", "postgresql", "redis", "mongodb",
        "索引", "事务", "acid", "lsm", "b+树", "binlog", "wal",
    )),
    ("分布式系统", (
        "分布式", "distributed", "raft", "paxos", "共识", "consensus",
        "etcd", "kafka", "消息队列", "mq", "微服务", "microservices",
    )),
    ("软件设计", (
        "设计模式", "design pattern", "solid", "ddd", "clean architecture",
        "mvc", "重构", "refactor",
    )),
)


def field(front: str, name: str) -> str:
    match = re.search(rf"(?m)^{re.escape(name)}:[ \t]*[\"']?(.*?)[\"']?[ \t]*$", front)
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
    """Pick a series from the declared topic, then fall back to title/headings only."""
    if topic in PRIMARY_SERIES_BY_TOPIC:
        return PRIMARY_SERIES_BY_TOPIC[topic]
    headings = " ".join(
        match.group(1) for line in body.splitlines()
        if (match := re.match(r"^#{1,6}\s+(.+)", line))
    )
    haystack = f" {title} {topic} {headings} ".lower()
    best_name, best_count = "", 0
    for name, words in SERIES_RULES:
        count = sum(1 for w in words if w.lower() in haystack)
        if count > best_count:
            best_count = count
            best_name = name
    return best_name


def score_tags(title: str, topic: str, body: str) -> list[str]:
    """Infer only high-confidence tags allowed by the declared topic.

    Incidental body mentions never cross topic boundaries. A tag needs a title/heading
    signal, or at least three distinct body signals inside its topic allowlist.
    """
    title_lower = f" {title.lower()} "
    topic_lower = f" {topic.lower()} "

    # Extract headings
    headings: list[str] = []
    for line in body.splitlines():
        m = re.match(r"^#{1,6}\s+(.+)", line)
        if m:
            headings.append(m.group(1).strip().lower())
    headings_text = " ".join(headings)

    body_lower = body.lower()

    allowed = TAG_ALLOWLIST_BY_TOPIC.get(topic, set(KEYWORDS))
    scores: dict[str, int] = {}
    for tag, words in KEYWORDS.items():
        if tag not in allowed:
            continue
        title_hits = 0
        heading_hits = 0
        body_hits = 0
        for word in words:
            w = word.lower()
            if w in title_lower:
                title_hits += 1
            if w in headings_text:
                heading_hits += 1
            if w in body_lower:
                body_hits += 1
        if title_hits or heading_hits or body_hits >= 3:
            scores[tag] = title_hits * 5 + heading_hits * 3 + min(body_hits, 3)

    # Return top 4 tags by score
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [tag for tag, _ in ranked[:4]]


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
        tags = score_tags(title, topic, body)
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
