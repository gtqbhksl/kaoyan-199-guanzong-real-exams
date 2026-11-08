#!/usr/bin/env python3
"""Build the compact, browser-ready study data from the reviewed Markdown bank."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTION_DIR = ROOT / "199管综真题_Markdown题库"
ANSWER_DIR = ROOT / "199管综答案_Markdown题库"
OUTPUT = Path(__file__).resolve().parent / "data" / "questions.json"
BUNDLE = Path(__file__).resolve().parent / "data" / "questions.js"

QUESTION_HEAD = re.compile(r"^### 第 (\d+) 题")
ALT_QUESTION_HEAD = re.compile(r"^### (5[67])[\.．]\s*(.*)$")
OPTION_LINE = re.compile(r"^- \*\*([A-E])\*\*．(.*)$")
HEADER = re.compile(r"^(?:## |### )")
SECTION_HEAD = re.compile(r"^## ([一二三四五])、")
IMAGE = re.compile(r"^!\[[^\]]*\]\((images/[^)]+)\)$")
SVG_OPEN = re.compile(r"^\s*<svg\b")
SVG_CLOSE = "</svg>"
QUOTE_PREFIX = re.compile(r"^\s*>\s?")

SECTION_NAMES = {
    "一": "问题求解",
    "二": "条件充分性判断",
    "三": "逻辑推理",
    "四": "论证有效性分析",
    "五": "论说文",
}

# Question numbers have a fixed role in the 199 paper. These labels serve as
# a consistent vocabulary for the topic and option metadata in question groups.
SECTION_BY_NUMBER = {
    **{n: "问题求解" for n in range(1, 16)},
    **{n: "条件充分性判断" for n in range(16, 26)},
    **{n: "逻辑推理" for n in range(26, 56)},
    56: "论证有效性分析",
    57: "论说文",
}


def read_year(year: int, folder: Path) -> Path:
    suffix = "真题试卷" if folder == QUESTION_DIR else "真题解析"
    path = folder / f"{year}年" / f"{year}年199管综{suffix}.md"
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def strip_shared_stem_end(text: str) -> str:
    return re.split(r"\n- \*\*[A-E]\*\*．", text, maxsplit=1)[0].strip()


def split_svg(lines: list[str]) -> tuple[list[str], list[str]]:
    """Separate the redrawn SVG figure blocks from the prose around them.

    The md files carry an inline ``<svg>`` re-drawing for every geometry
    figure. Keeping the source in the question text floods the reader with
    markup, so the block is lifted out and handed to the page as a figure.
    """
    figures: list[str] = []
    kept: list[str] = []
    buffer: list[str] = []
    in_svg = False
    for line in lines:
        content = QUOTE_PREFIX.sub("", line, count=1) if line.lstrip().startswith(">") else line
        if in_svg:
            buffer.append(content)
            if SVG_CLOSE in content:
                figures.append("\n".join(buffer).strip())
                buffer = []
                in_svg = False
            continue
        if SVG_OPEN.match(content):
            buffer = [content]
            in_svg = True
            if SVG_CLOSE in content:
                figures.append("\n".join(buffer).strip())
                buffer = []
                in_svg = False
            continue
        kept.append(line)
    if buffer:
        figures.append("\n".join(buffer).strip())
    return kept, figures


def parse_questions(year: int) -> tuple[dict[int, dict], str]:
    path = read_year(year, QUESTION_DIR)
    lines = path.read_text(encoding="utf-8").splitlines()
    title = next((line[2:] for line in lines if line.startswith("# ")), str(year))
    # Preserve each paper's wording and punctuation instead of imposing a
    # standard short legend (notably different in 2017, 2019 and 2025).
    legend = {}
    in_legend = False
    for line in lines:
        if line.startswith("## 二、条件充分性判断"):
            in_legend = True
            continue
        if in_legend:
            if QUESTION_HEAD.match(line):
                break
            if match := OPTION_LINE.match(line):
                legend[match.group(1)] = match.group(2).strip()
    if set(legend) != set("ABCDE") or not all(legend.values()):
        raise ValueError(f"{year}: incomplete A-E condition-sufficiency legend")

    shared: dict[int, tuple[int, str, list[str]]] = {}
    for index, line in enumerate(lines):
        matched = re.match(r"^### (\d+)[~～](\d+) 题基于以下题干", line)
        if not matched:
            continue
        end = index + 1
        body = []
        while end < len(lines) and not HEADER.match(lines[end]):
            raw = QUOTE_PREFIX.sub("", lines[end], count=1)
            if raw.strip() and raw.strip() != "---" and not IMAGE.match(raw):
                body.append(raw)
            end += 1
        body, figures = split_svg(body)
        shared[int(matched.group(1))] = (
            int(matched.group(2)),
            strip_shared_stem_end("\n".join(body)),
            figures,
        )

    offsets = []
    headings = {}
    for index, line in enumerate(lines):
        if match := QUESTION_HEAD.match(line):
            offsets.append((index, int(match.group(1))))
        elif match := ALT_QUESTION_HEAD.match(line):
            offsets.append((index, int(match.group(1))))
            headings[int(match.group(1))] = match.group(2).strip()
    output = {}
    for position, (start, number) in enumerate(offsets):
        end = offsets[position + 1][0] if position + 1 < len(offsets) else len(lines)
        body_lines = []
        image = None
        for raw in lines[start + 1:end]:
            # Section instructions and shared stems belong to their own blocks,
            # not to the preceding question (especially Q15 and Q53).
            if HEADER.match(raw):
                break
            image_match = IMAGE.match(raw)
            if image_match:
                image = image_match.group(1)
            else:
                body_lines.append(raw)
        options = {}
        stem_lines = []
        for raw in body_lines:
            if match := OPTION_LINE.match(raw):
                options[match.group(1)] = match.group(2).strip()
            elif raw.strip() == "---":
                continue
            else:
                stem_lines.append(raw)
        stem_lines, figures = split_svg(stem_lines)
        stem = "\n".join(stem_lines).strip()
        stem = re.sub(r"\n+", "\n", stem)
        if number in headings:
            stem = f"{headings[number]}\n{stem}".strip()
        group_start = next((first for first, (last, text, group_figures) in shared.items()
                            if first <= number <= last), None)
        group = shared.get(group_start, (None, "", []))
        output[number] = {
            "year": year,
            "number": number,
            "category": SECTION_BY_NUMBER.get(number, "综合写作"),
            "stem": stem,
            "options": legend.copy() if 16 <= number <= 25 else options,
            "image": image,
            "shared": group[1],
            "figures": figures + group[2],
        }
    return output, title


def parse_answers(year: int) -> tuple[dict[int, dict], str]:
    path = read_year(year, ANSWER_DIR)
    lines = path.read_text(encoding="utf-8").splitlines()
    title = next((line[2:] for line in lines if line.startswith("# ")), str(year))
    offsets = [(index, int(match.group(1))) for index, line in enumerate(lines)
               if (match := QUESTION_HEAD.match(line))]
    output = {}
    for position, (start, number) in enumerate(offsets):
        end = offsets[position + 1][0] if position + 1 < len(offsets) else len(lines)
        block = []
        for raw in lines[start + 1:end]:
            if HEADER.match(raw):
                break
            block.append(raw)
        text = "\n".join(block).strip()
        answer = re.search(r"\*\*答案\*\*[：:]\s*([A-E])\b", text)
        output[number] = {
            "answer": answer.group(1) if answer else None,
            "explanation": text,
        }
    return output, title


def answer_notes(text: str) -> list[dict]:
    """Structured notes sourced from this repository's revision warnings."""
    result = []
    for paragraph in text.split("\n\n"):
        if paragraph.startswith(">") and any(
            key in paragraph for key in ("人工", "精简版", "原书", "推演", "更正")
        ):
            result.append({"label": "来源说明", "text": paragraph.lstrip("> ").strip()})
    return result


def find_terms() -> dict[str, object]:
    """Keep links and the report's stated sample on the page."""
    report = (ROOT / "docs" / "199_exam_points_trends_and_tricks.md").read_text(
        encoding="utf-8"
    )
    return {
        "source": "docs/199_exam_points_trends_and_tricks.md",
        "sample": ["18 年", "1026 题"],
        "report_sections": [line[3:].strip() for line in report.splitlines()
                            if line.startswith("## ")],
    }


def main() -> None:
    years = sorted(int(folder.name.removesuffix("年"))
                   for folder in QUESTION_DIR.glob("*年") if folder.is_dir())
    questions = []
    answer_notes_by_year = {}
    source_titles = {}
    for year in years:
        qs, question_title = parse_questions(year)
        answers, answer_title = parse_answers(year)
        missing = sorted((set(qs) | set(answers)) - (set(qs) & set(answers)))
        if missing:
            raise ValueError(f"{year}: question/answer mismatch: {missing}")
        if set(qs) != set(range(1, 58)):
            raise ValueError(f"{year}: expected questions 1-57, found {sorted(qs)}")
        for number, question in qs.items():
            answer = answers[number]
            if number <= 55:
                options = question["options"]
                if set(options) != set("ABCDE") or not all(options.values()):
                    raise ValueError(f"{year} Q{number}: expected five nonempty A-E options")
                if answer["answer"] not in options:
                    raise ValueError(f"{year} Q{number}: invalid answer {answer['answer']!r}")
            question.update(answer)
            questions.append(question)
        source_titles[str(year)] = {
            "question": question_title,
            "answer": answer_title,
        }
        # Preserve the source bank's explicit caveats on the page.
        notes = answer_notes(
            read_year(year, ANSWER_DIR).read_text(encoding="utf-8")
        )
        if notes:
            answer_notes_by_year[str(year)] = notes
    payload = {
        "meta": {
            "bank_title": "考研管综 199 真题题库（2009–2026）",
            "years": years,
            "question_count": len(questions),
            "source_titles": source_titles,
            "answer_notes": answer_notes_by_year,
            "cross_check": find_terms(),
        },
        "questions": questions,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    BUNDLE.write_text(
        "window.KAOYAN199_DATA = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Built {OUTPUT} with {len(questions)} questions from {years[0]}–{years[-1]}.")


if __name__ == "__main__":
    main()
