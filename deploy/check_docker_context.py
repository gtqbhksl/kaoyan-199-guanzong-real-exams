#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""模拟 Docker 的 .dockerignore 过滤,核算实际进入构建上下文的文件。

用于在没有 Docker 的环境里核对 Dockerfile 的 COPY 是否拿得到文件、
上下文体积是否合理。规则按 Docker 语义近似:
  * `*` 不跨 `/`,`**` 跨任意层级目录
  * 目录项 `dir/` 匹配该目录下全部内容
"""
import fnmatch
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_patterns(path):
    out = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.split("#")[0].strip()
            if line:
                out.append(line)
    return out


def match(pattern, rel):
    """判断单个文件相对路径是否被某条规则忽略。"""
    if pattern.endswith("/"):
        prefix = pattern[:-1]
        return rel == prefix or rel.startswith(prefix + "/")
    if pattern.startswith("**/"):
        tail = pattern[3:]
        parts = rel.split("/")
        for i in range(len(parts)):
            if fnmatch.fnmatch("/".join(parts[i:]), tail):
                return True
        return False
    if fnmatch.fnmatch(rel, pattern):
        return True
    # `*.md` 这类规则在 Docker 中对任意层级都生效
    return any(fnmatch.fnmatch(seg, pattern) for seg in rel.split("/"))


def main():
    patterns = load_patterns(os.path.join(ROOT, ".dockerignore"))
    keep = []
    skip = 0
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "__pycache__")]
        for name in files:
            full = os.path.join(base, name)
            rel = os.path.relpath(full, ROOT).replace("\\", "/")
            if any(match(p, rel) for p in patterns):
                skip += 1
            else:
                keep.append((rel, os.path.getsize(full)))

    total = sum(size for _, size in keep) / 1024 / 1024
    print(f"进入构建上下文:{len(keep)} 个文件,排除 {skip} 个,合计 {total:.1f} MiB")
    print("--- 按顶层目录 ---")
    counter = Counter(rel.split("/")[0] for rel, _ in keep)
    for key, count in counter.most_common():
        print(f"  {count:5d}  {key}")
    print("--- 抽样文件 ---")
    for rel, _ in keep[:8]:
        print(f"  {rel}")

    # 核对 Dockerfile 与 compose 需要的文件是否都在上下文里
    required = [
        "study-guide/build_site.py",
        "study-guide/app.js",
        "study-guide/index.html",
        "study-guide/styles.css",
        "study-guide/data/questions.js",
        "study-guide/data/knowledge-base.js",
        "deploy/nginx.conf",
    ]
    names = {rel for rel, _ in keep}
    missing = [r for r in required if r not in names]
    print("--- 必需文件 ---")
    for r in required:
        print(f"  {'OK ' if r in names else '缺失'} {r}")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
