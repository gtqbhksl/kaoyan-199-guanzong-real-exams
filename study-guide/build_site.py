#!/usr/bin/env python3
"""Assemble the publishable static site from the local study guide.

The browser app lives in ``study-guide/`` and is served locally by ``serve.py``.
This script copies the pieces a hosted site needs into ``study-guide/web/``:

* the page, script and stylesheet, with the original-paper slice path rewritten
  to the site's own ``scans/`` folder;
* the generated question bank and knowledge cards (the intermediate
  ``questions.json`` stays out of the package);
* every original-paper slice, re-encoded as WebP to keep the upload small.

Run from anywhere:

    python study-guide/build_site.py
"""

from __future__ import annotations

import argparse
import io
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "web"
BANK_DIR = ROOT.parent / "199管综真题_Markdown题库"

APP_TEMPLATE = "../199管综真题_Markdown题库/{year}年/images/{file}.png"
APP_SITE_TEMPLATE = "./scans/{year}/{file}.webp"

WEBP_QUALITY = 72
WEBP_METHOD = 4
MAX_WIDTH = 1600


def rewrite_app(source: str) -> str:
    if APP_TEMPLATE not in source:
        raise SystemExit("app.js 中未找到原卷切片图路径模板，请检查 build_site.py")
    return source.replace(APP_TEMPLATE, APP_SITE_TEMPLATE, 1)


def rewrite_html(source: str) -> str:
    marker = '<link rel="stylesheet" href="./styles.css" />'
    if marker not in source:
        raise SystemExit("index.html 中未找到样式表引用，请检查 build_site.py")
    source = source.replace(
        marker,
        marker + '\n    <link rel="stylesheet" href="./site.design.css" />',
        1,
    )
    source = source.replace(
        '<meta name="description" content="基于 2009–2026 年 1026 道真题的 199 管理类联考复习工作台" />',
        '<meta name="description" content="199 管理类联考在线复习台：'
        '基于 2009–2026 年 1026 道真题的逐题训练、错题本与知识点速查" />',
        1,
    )
    source = source.replace(
        "<title>199 复习台 · 管综备考工作台</title>",
        "<title>199 管综真题复习台 · 在线版</title>",
        1,
    )
    return source


def write_design_styles(path: Path) -> None:
    """Default values for the site design variables.

    The design panel rewrites this file with the tuned values; the defaults keep
    the page identical to the local study guide until then.
    """
    path.write_text(
        ":root {\n"
        "  --site-bg: #f4f6f2;\n"
        "  --site-fg: #162b2d;\n"
        "  --site-accent: #d8653e;\n"
        "  --site-on-accent: #ffffff;\n"
        "  --site-surface: #ffffff;\n"
        "  --site-muted: #748485;\n"
        "  --site-border: #dce5dd;\n"
        '  --site-font: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;\n'
        "  --site-radius: 8px;\n"
        "  --site-space: 1;\n"
        "  --site-type: 1;\n"
        "  --site-motion: 1;\n"
        "}\n",
        encoding="utf-8",
    )


def convert_scans(years: list[int]) -> tuple[int, int]:
    """Re-encode the original-paper slices as WebP. Returns (converted, skipped)."""
    from PIL import Image

    converted = 0
    skipped = 0
    for year in years:
        source_dir = BANK_DIR / f"{year}年" / "images"
        if not source_dir.is_dir():
            continue
        target_dir = OUTPUT / "scans" / str(year)
        target_dir.mkdir(parents=True, exist_ok=True)
        for source in sorted(source_dir.glob("*.png")):
            if "shared" in source.stem:
                # 共享题干切片图未被页面引用，不进入发布产物
                continue
            target = target_dir / f"{source.stem}.webp"
            if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
                skipped += 1
                continue
            image = Image.open(source).convert("L")
            if image.width > MAX_WIDTH:
                height = round(image.height * MAX_WIDTH / image.width)
                image = image.resize((MAX_WIDTH, height), Image.LANCZOS)
            buffer = io.BytesIO()
            image.save(buffer, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
            target.write_bytes(buffer.getvalue())
            converted += 1
    return converted, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="生成站点静态产物")
    parser.add_argument("--skip-images", action="store_true", help="不重新导出原卷切片图")
    args = parser.parse_args()

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    (OUTPUT / "data").mkdir(parents=True, exist_ok=True)

    (OUTPUT / "index.html").write_text(
        rewrite_html((ROOT / "index.html").read_text(encoding="utf-8")), encoding="utf-8"
    )
    (OUTPUT / "app.js").write_text(
        rewrite_app((ROOT / "app.js").read_text(encoding="utf-8")), encoding="utf-8"
    )
    shutil.copy2(ROOT / "styles.css", OUTPUT / "styles.css")
    write_design_styles(OUTPUT / "site.design.css")
    shutil.copy2(ROOT / "data" / "questions.js", OUTPUT / "data" / "questions.js")
    shutil.copy2(ROOT / "data" / "knowledge-base.js", OUTPUT / "data" / "knowledge-base.js")

    converted = skipped = 0
    if not args.skip_images:
        years = sorted(
            int(path.name.removesuffix("年"))
            for path in BANK_DIR.iterdir()
            if path.is_dir() and path.name.endswith("年")
        )
        converted, skipped = convert_scans(years)

    files = [path for path in OUTPUT.rglob("*") if path.is_file()]
    total = sum(path.stat().st_size for path in files)
    print(f"站点产物：{OUTPUT}")
    print(f"文件数 {len(files)} · 总体积 {total / 1024 / 1024:.1f} MiB")
    print(f"原卷切片图：本次转换 {converted} 张 · 复用 {skipped} 张")
    return 0


if __name__ == "__main__":
    sys.exit(main())
