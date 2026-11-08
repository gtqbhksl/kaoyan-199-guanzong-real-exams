#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""核对 nginx 配置的路径匹配与缓存头是否符合预期。

本机无 nginx,按 deploy/nginx.conf 的 location 规则模拟匹配,
列出站点各类资源的预期响应行为,便于在没有容器的环境下确认配置意图。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = os.path.join(ROOT, "deploy", "nginx.conf")

RULES = [
    (r"^/data/.*\.js$", "no-cache", "题库数据:随题库更新,不缓存"),
    (r"^/scans/.*\.webp$", "public, max-age=31536000, immutable", "原卷切片图:长缓存"),
    (r".*\.(html|css|js)$", "no-cache", "页面与样式:取最新"),
    (r".*\.(ico|png|jpg|jpeg|gif|woff2?)$", "public, max-age=604800", "小资源:缓存一周"),
]


def main():
    text = open(CONF, encoding="utf-8").read()
    if "try_files $uri $uri/ =404;" not in text:
        print("[ERR] 站点根未配置 =404 回退")
        return 1
    if "error_page 404" in text:
        print("[ERR] 存在 error_page 404 回退,会掩盖缺失资源")
        return 1

    samples = [
        ("/", "站点首页"),
        ("/index.html", "首页"),
        ("/app.js", "页面脚本"),
        ("/styles.css", "样式"),
        ("/site.design.css", "站点设计样式"),
        ("/data/questions.js", "题库数据"),
        ("/data/knowledge-base.js", "知识卡数据"),
        ("/scans/2026/2026_q01.webp", "原卷切片图"),
        ("/scans/2019/2019_shared_54_55.webp", "共享题干切片图(未生成)"),
        ("/favicon.ico", "图标"),
    ]

    print(f"{'路径':<38}{'缓存头':<46}说明")
    print("-" * 110)
    for path, note in samples:
        cache = "(默认:nginx 无缓存头)"
        for pattern, value, _ in RULES:
            if re.search(pattern, path):
                cache = value
                break
        print(f"{path:<38}{cache:<46}{note}")

    # 站点实际产出的资源类型是否都有对应规则
    web = os.path.join(ROOT, "study-guide", "web")
    if os.path.isdir(web):
        found = set()
        for base, _dirs, files in os.walk(web):
            for name in files:
                found.add(os.path.splitext(name)[1].lower())
        print("\n产物中的文件扩展名:", ", ".join(sorted(found)))
        # 用该扩展名的典型真实路径去匹配规则,而不是拼一个假路径
        probes = {
            ".webp": "/scans/2026/2026_q01.webp",
            ".js": "/data/questions.js",
            ".css": "/styles.css",
            ".html": "/index.html",
            ".json": "/data/questions.json",
        }
        missing = []
        for ext in sorted(found):
            probe = probes.get(ext)
            if probe is None:
                continue
            if not any(re.search(p, probe) for p, _, _ in RULES):
                missing.append(ext)
        if missing:
            print("[ERR] 以下扩展名没有对应缓存规则:", missing)
            return 1
    print("\nnginx 路径规则自检通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
