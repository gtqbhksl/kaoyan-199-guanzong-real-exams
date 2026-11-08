#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从已人工校核的 Markdown 题库生成 RAG 切分库(JSONL)。

背景:早期 extract_199_markdown.py / batch_optimize_all_199.py 直接从 PDF
文本层用正则切题。199 试卷是双栏排版,PyMuPDF 的块阅读顺序会在栏间交错,
题号锚点又常与正文行首数字("16 人""30 天"等)混淆,导致串题。
2009-2026 各年试卷 md 已逐题人工/多模态校核,因此以 md 为唯一内容源
重建切分库,PDF 只负责提供原卷切片图(图中路径直接取自 md)。

用法(仓库根目录执行,脚本自身按 __file__ 定位仓库根,任意目录亦可):
    python3 scripts/build_rag_chunks_from_md.py            # 全量重建
    python3 scripts/build_rag_chunks_from_md.py 2013 2018  # 只重建指定年份

指定年份时,汇总库仍覆盖全部年份:指定年份从 md 重建,其余年份从各自
的逐年 jsonl 合并,不会因局部重建而丢失其他年份。指定的年份在题库中
不存在(或含非数字参数)时直接报错退出,不写任何文件。合并的逐年 jsonl
若比其 md 旧(改过 md 忘了重建),同样报错退出,防止汇总库混入过期内容。

输出:
    199管综真题_Markdown题库/{year}年/{year}年199真题_chunks.jsonl   (每年)
    199管综真题_Markdown题库/199管综历年真题_全量RAG切分库.jsonl      (汇总)

校验:每年必须恰好 57 个 chunk;1-15/26-55 题必须有 A-E 五项;
16-25 题 stem 必须含条件(1)(2)(全角或半角);题干为空或选项不齐会打印告警;
汇总库必须覆盖题库内全部年份,缺年份非 0 退出。
md 中的 SVG 重绘图块(2024/2025/2026 补图)在解析时剔除,不进入 chunk 文本。
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]          # 仓库根目录
OUTPUT_ROOT = ROOT / "199管综真题_Markdown题库"
TOTAL_JSONL_NAME = "199管综历年真题_全量RAG切分库.jsonl"

Q_HEAD = re.compile(r"^### 第 (\d+) 题")
# 2025 的写作题采用另一式头:### 56. 论证有效性分析：… / ### 57. 论说文：…
W_HEAD = re.compile(r"^### (5[67])[\.．]\s*(\S.*)$")
STEM_HEAD = re.compile(r"^### (\d+)[~～](\d+) 题基于以下题干")
OPT = re.compile(r"^- \*\*([A-E])\*\*．(.*)$")
IMG = re.compile(r"^!\[[^\]]*\]\((images/[^)]+)\)$")
HEADER = re.compile(r"^(## |### )")
SVG_OPEN = re.compile(r"^\s*<svg\b")
SVG_CLOSE = "</svg>"
QUOTE = re.compile(r"^>\s?")


def drop_svg(lines):
    """md 中的 SVG 重绘图块(2024/2025/2026 补图)是给人看的插图,不进 chunk 文本。

    共享题干里的插图被包在 "> " 引用块中,判定时需先剥掉引用前缀,
    否则 2019 年的 54/55 题会把整段 SVG 源码写进 stem。
    """
    out, in_svg = [], False
    for ln in lines:
        body = QUOTE.sub("", ln, count=1) if ln.lstrip().startswith(">") else ln
        if in_svg:
            if SVG_CLOSE in body:
                in_svg = False
            continue
        if SVG_OPEN.match(body):
            if SVG_CLOSE not in body:
                in_svg = True
            continue
        out.append(ln)
    return out


def parse_year_md(md_path: Path):
    """解析单年试卷 md,返回 (chunks, warnings)。"""
    year = int(md_path.parent.name.replace("年", ""))
    lines = md_path.read_text(encoding="utf-8").split("\n")

    # 第一遍:定位题目块与共享题干块
    q_blocks = {}   # qnum -> (start, end) 行区间(不含首尾标题行)
    q_extra = {}    # qnum -> 标题行内的前置文本(2025 写作题要求写在标题行里)
    shared = {}     # start_q -> (end_q, [题干行])
    spans = []      # (kind, qnum, line_idx, header_tail)
    for i, ln in enumerate(lines):
        m = Q_HEAD.match(ln)
        if m:
            spans.append(("q", int(m.group(1)), i, None))
            continue
        m = W_HEAD.match(ln)
        if m:
            spans.append(("q", int(m.group(1)), i, m.group(2).strip()))
            continue
        m = STEM_HEAD.match(ln)
        if m:
            spans.append(("stem", int(m.group(1)), i, None))

    for k, (kind, qnum, i, header_tail) in enumerate(spans):
        end = spans[k + 1][2] if k + 1 < len(spans) else len(lines)
        # 截断到下一个任意标题行:章节标题("二、"/"四、")、"### 解题说明："
        # 选项说明列表、共享题干标题等都不属于上一题的内容,否则第 15 题会
        # 吞入解题说明并让 A-E 说明覆盖真实选项,第 55 题会吞入"四、写作"标题
        for j in range(i + 1, end):
            if HEADER.match(lines[j]):
                end = j
                break
        if kind == "stem":
            m = STEM_HEAD.match(lines[i])
            body = [l[2:] if l.startswith("> ") else l
                    for l in drop_svg(lines[i + 1:end])
                    if l.strip() and l.strip() != "---"]
            body = [l for l in body if not IMG.match(l)]
            shared[qnum] = (int(m.group(2)), "\n".join(body).strip())
        else:
            q_blocks[qnum] = lines[i + 1:end]
            if header_tail:
                q_extra[qnum] = header_tail

    warnings = []
    if sorted(q_blocks) != list(range(1, 58)):
        missing = [q for q in range(1, 58) if q not in q_blocks]
        warnings.append(f"题目块缺失: {missing}")

    # 16-25 题的 A-E 判定说明:取当年 md 中"二、"标题与第 16 题之间的实际
    # 版本(多数年份为短式,2017/2019 原卷为长式,忠实保留)
    legend = {}
    in_legend = False
    for ln in lines:
        if ln.startswith("## 二、条件充分性判断"):
            in_legend = True
            continue
        if in_legend:
            if Q_HEAD.match(ln):
                break
            mo = OPT.match(ln)
            if mo:
                legend[mo.group(1)] = mo.group(2).strip()
    if len(legend) != 5:
        warnings.append(f"未从 md 解析出完整 A-E 判定说明({sorted(legend)}),使用标准短式")
        legend = {
            "A": "条件（1）充分，但条件（2）不充分",
            "B": "条件（2）充分，但条件（1）不充分",
            "C": "条件（1）和（2）单独都不充分，但条件（1）和条件（2）联合起来充分",
            "D": "条件（1）充分，条件（2）也充分",
            "E": "条件（1）和（2）单独都不充分，条件（1）和条件（2）联合起来也不充分",
        }

    def shared_for(q):
        for s, (e, text) in shared.items():
            if s <= q <= e:
                return text
        return None

    chunks = []
    for q in range(1, 58):
        block = q_blocks.get(q, [])
        if block is None:
            continue
        img_rel = None
        opts = {}
        body_lines = []
        for ln in drop_svg(block):
            mi = IMG.match(ln)
            if mi:
                img_rel = mi.group(1)
                continue
            if ln.strip() == ">":        # 空 blockquote 行:作为段落分隔保留
                body_lines.append("")
                continue
            if ln.startswith("> "):      # blockquote 行:去掉前缀(写作材料)
                ln = ln[2:]
            mo = OPT.match(ln)
            if mo and q not in (56, 57):
                opts[mo.group(1)] = mo.group(2).strip()
                continue
            if ln.strip() and ln.strip() != "---":
                body_lines.append(ln)

        body = "\n".join(body_lines).strip()
        sfx = shared_for(q)

        # 字段与既有切分库保持一致:year / question_no / category / stem / options / image
        if q <= 15:
            chunk = {
                "year": year, "question_no": q, "category": "问题求解",
                "stem": body, "options": {k: opts[k] for k in "ABCDE" if k in opts},
                "image": img_rel,
            }
            if not body:
                warnings.append(f"Q{q} 题干为空")
        elif q <= 25:
            chunk = {
                "year": year, "question_no": q, "category": "条件充分性判断",
                "stem": body, "options": {k: legend[k] for k in "ABCDE" if k in legend},
                "image": img_rel,
            }
            if not body:
                warnings.append(f"Q{q} 题干为空")
            if not ("（1）" in body or "(1)" in body) \
               or not ("（2）" in body or "(2)" in body):
                warnings.append(f"Q{q} 未找到条件（1）/（2）,需人工确认")
        elif q <= 55:
            stem = (sfx + "\n\n" + body) if sfx else body
            chunk = {
                "year": year, "question_no": q, "category": "逻辑推理",
                "stem": stem, "options": {k: opts[k] for k in "ABCDE" if k in opts},
                "image": img_rel,
            }
            if not body:
                warnings.append(f"Q{q} 题干为空")
        else:
            cat = "论证有效性分析" if q == 56 else "论说文"
            extra = q_extra.get(q, "")
            raw = (extra + "\n\n" + body) if extra else body
            stem = raw.replace("**", "").strip()
            chunk = {
                "year": year, "question_no": q, "category": cat,
                "stem": stem, "options": {},
                "image": img_rel,
            }
            if not stem:
                warnings.append(f"Q{q} 材料为空")
        chunks.append(chunk)

    # 选项完整性(1-15 与 26-55 应恰好 A-E 五项)
    for c in chunks:
        q = c["question_no"]
        if q <= 15 or (26 <= q <= 55):
            have = [k for k in "ABCDE" if k in c["options"]]
            if have != list("ABCDE"):
                warnings.append(f"Q{q} 选项不齐: {have}")
        if not c.get("image"):
            warnings.append(f"Q{q} 缺少原卷切片图引用")
    return chunks, warnings


def atomic_write(path: Path, text: str):
    """先写临时文件再原子替换,避免中途失败留下半截 jsonl/md。"""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def parse_year_args(available):
    """命令行年份参数:非数字或题库中不存在的年份直接报错退出。"""
    args = sys.argv[1:]
    bad = [a for a in args if not a.isdigit()]
    if bad:
        print(f"[✘] 非法年份参数: {bad}(应为 4 位年份数字)")
        sys.exit(1)
    only = [int(a) for a in args]
    unknown = [y for y in only if y not in available]
    if unknown:
        print(f"[✘] 指定的年份在题库中不存在: {unknown}")
        print(f"    题库现有年份: {sorted(available)}")
        sys.exit(1)
    return only


def main():
    year_dirs = sorted(OUTPUT_ROOT.glob("[0-9][0-9][0-9][0-9]年"))
    if not year_dirs:
        print(f"[✘] {OUTPUT_ROOT} 下没有任何年份目录,拒绝写入汇总库")
        sys.exit(1)
    available = {int(d.name.replace("年", "")) for d in year_dirs}
    only = parse_year_args(available)

    all_chunks, problems = [], 0
    for d in year_dirs:
        year = int(d.name.replace("年", ""))
        per_year = d / f"{year}年199真题_chunks.jsonl"
        if year in (only or available):
            md_path = d / f"{year}年199管综真题试卷.md"
            if not md_path.exists():
                print(f"[✘] {year} 年缺少 {md_path.name},跳过")
                problems += 1
                continue
            chunks, warns = parse_year_md(md_path)
            atomic_write(per_year, "".join(
                json.dumps(c, ensure_ascii=False) + "\n" for c in chunks))
            all_chunks.extend(chunks)
            status = "OK " if len(chunks) == 57 and not warns else "WARN"
            print(f"[{status}] {year}: {len(chunks)} chunks -> {per_year.name}")
            for w in warns:
                print(f"       ! {w}")
                problems += 1
            if len(chunks) != 57:
                problems += 1
        else:
            if not per_year.exists():
                print(f"[✘] {year}: 缺 {per_year.name},无法并入汇总库")
                problems += 1
                continue
            md_path = d / f"{year}年199管综真题试卷.md"
            if md_path.exists() and md_path.stat().st_mtime > per_year.stat().st_mtime:
                print(f"[✘] {year}: {md_path.name} 比 {per_year.name} 新,"
                      f"切分库可能过期,请先重建该年")
                problems += 1
                continue
            chunks = [json.loads(l) for l in
                      per_year.read_text(encoding="utf-8").splitlines()
                      if l.strip()]
            all_chunks.extend(chunks)

    # 汇总库必须覆盖题库内全部年份(局部重建不得缩小汇总范围)
    got_years = sorted({c["year"] for c in all_chunks})
    if got_years != sorted(available):
        missing_years = sorted(available - set(got_years))
        print(f"[✘] 汇总库缺少年份: {missing_years}")
        problems += 1

    if not problems:
        total_path = OUTPUT_ROOT / TOTAL_JSONL_NAME
        text = "".join(json.dumps(c, ensure_ascii=False) + "\n"
                       for c in all_chunks)
        atomic_write(total_path, text)

    print(f"\n共 {len(all_chunks)} 条切分({len(got_years)} 个年份)")
    if not problems:
        print(f"汇总库: {total_path}")
    if problems:
        print(f"⚠ 有 {problems} 处告警,见上方明细,请人工复核对应题目")
        sys.exit(1)
    print("全部年份 57 题齐整,校验通过")


if __name__ == "__main__":
    main()
