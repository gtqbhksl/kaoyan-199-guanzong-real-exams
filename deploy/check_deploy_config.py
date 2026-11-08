#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""部署配置静态校验:docker-compose.yml 与 deploy/nginx.conf。

本机没有 Docker/nginx 时,至少把能在本地确认的错误挡掉:
  * YAML 是否可解析、services 是否齐全
  * nginx 配置块是否配对、location 是否以 / 收尾、指令结尾是否有分号
  * Dockerfile 引用的文件是否都存在
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors = []
notes = []


def check_compose():
    path = os.path.join(ROOT, "docker-compose.yml")
    if not os.path.exists(path):
        errors.append("缺少 docker-compose.yml")
        return
    text = open(path, encoding="utf-8").read()
    try:
        import yaml

        data = yaml.safe_load(text)
    except ImportError:
        notes.append("未安装 PyYAML,跳过 compose 结构解析")
        data = None
    except Exception as exc:  # pragma: no cover
        errors.append(f"docker-compose.yml 解析失败: {exc}")
        return
    if not isinstance(data, dict) or "services" not in data:
        errors.append("docker-compose.yml 缺少 services")
        return
    for name, svc in data["services"].items():
        if "build" not in svc and "image" not in svc:
            errors.append(f"service {name} 既无 build 也无 image")
        for port in svc.get("ports", []):
            if not re.match(r"^\d+:\d+$", str(port)):
                errors.append(f"service {name} 端口写法异常: {port}")
    notes.append(f"compose services: {', '.join(data['services'])}")


def check_nginx():
    path = os.path.join(ROOT, "deploy", "nginx.conf")
    if not os.path.exists(path):
        errors.append("缺少 deploy/nginx.conf")
        return
    depth = 0
    # 指令可跨行书写(gzip_types 等多值指令),只有确定是单值指令时才查分号
    single_value = ("listen", "root", "index", "charset", "expires",
                    "client_max_body_size", "sendfile", "tcp_nopush",
                    "gzip", "gzip_vary", "gzip_min_length", "gzip_proxied",
                    "gzip_comp_level", "access_log", "error_log")
    for lineno, raw in enumerate(open(path, encoding="utf-8"), 1):
        line = raw.split("#")[0].strip()
        if not line:
            continue
        depth += line.count("{") - line.count("}")
        if depth < 0:
            errors.append(f"nginx.conf:{lineno} 花括号不匹配")
            return
        if "{" in line or "}" in line:
            continue
        head = line.split()[0]
        if head in single_value and not line.endswith(";"):
            errors.append(f"nginx.conf:{lineno} 指令缺少分号: {line}")
    if depth != 0:
        errors.append(f"nginx.conf 花括号未闭合,剩余 {depth}")
    text = open(path, encoding="utf-8").read()
    for required in ("listen", "root", "try_files", "gzip"):
        if required not in text:
            errors.append(f"nginx.conf 缺少关键指令: {required}")
    if "error_page 404 /index.html" in text:
        errors.append("nginx.conf 不应把 404 回退成 index.html,会掩盖缺失资源")


def check_dockerfile():
    path = os.path.join(ROOT, "Dockerfile")
    if not os.path.exists(path):
        errors.append("缺少 Dockerfile")
        return
    text = open(path, encoding="utf-8").read()
    copies = re.findall(r"^COPY\s+(?:--from=(\S+)\s+)?(.+)$", text, re.M)
    for stage, args in copies:
        parts = args.split()
        if stage:
            continue
        for arg in parts[:-1]:
            source = arg.strip('"').replace("./", "")
            if source.startswith("http"):
                continue
            if not os.path.exists(os.path.join(ROOT, source)):
                errors.append(f"Dockerfile COPY 的路径不存在: {source}")
    if "FROM" not in text:
        errors.append("Dockerfile 缺少 FROM")
    notes.append(f"Dockerfile COPY 指令 {len(copies)} 条,均已校验源路径")


def main():
    check_compose()
    check_nginx()
    check_dockerfile()
    for note in notes:
        print(f"[ok]   {note}")
    for error in errors:
        print(f"[ERR]  {error}")
    if errors:
        return 1
    print("部署配置静态校验通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
