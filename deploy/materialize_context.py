#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按 .dockerignore 规则复制出构建上下文,用于离线验证 Dockerfile 的构建流程。

用法:python deploy/materialize_context.py <目标目录>
"""
import fnmatch
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_patterns():
    out = []
    with open(os.path.join(ROOT, ".dockerignore"), encoding="utf-8") as handle:
        for line in handle:
            line = line.split("#")[0].strip()
            if line:
                out.append(line)
    return out


def match(pattern, rel):
    if pattern.endswith("/"):
        prefix = pattern[:-1]
        return rel == prefix or rel.startswith(prefix + "/")
    if pattern.startswith("**/"):
        tail = pattern[3:]
        parts = rel.split("/")
        return any(fnmatch.fnmatch("/".join(parts[i:]), tail) for i in range(len(parts)))
    if fnmatch.fnmatch(rel, pattern):
        return True
    return any(fnmatch.fnmatch(seg, pattern) for seg in rel.split("/"))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    dest = os.path.abspath(sys.argv[1])
    patterns = load_patterns()
    if os.path.exists(dest):
        shutil.rmtree(dest)
    count = 0
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "__pycache__")]
        for name in files:
            full = os.path.join(base, name)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            if any(match(p, rel) for p in patterns):
                continue
            target = os.path.join(dest, rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(full, target)
            count += 1
    print(f"copied {count} files -> {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
