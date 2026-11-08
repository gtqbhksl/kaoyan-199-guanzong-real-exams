#!/usr/bin/env python3
"""Regression tests for the browser data, using the reviewed Markdown as truth."""

import copy
import importlib.util
import json
import re
import unittest
from pathlib import Path
from unittest import mock


STUDY_GUIDE = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_data", STUDY_GUIDE / "build_data.py")
build_data = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build_data)

SVG = re.compile(r"<svg\b[\s\S]*?</svg>")
OPTION = re.compile(r"^- \*\*([A-E])\*\*．(.*)$", re.MULTILINE)
IMAGE = re.compile(r"^!\[[^\]]*\]\((images/[^)]+)\)$", re.MULTILINE)


def source_blocks(text):
    parts = re.split(r"(?m)^(#{2,3} .*)\n", text)
    return list(zip(parts[1::2], parts[2::2]))


def question_block(blocks, number):
    return next((heading, body) for heading, body in blocks
                if re.match(rf"^### (?:第 {number} 题\b|{number}[.．])", heading))


def unquote(text):
    return re.sub(r"(?m)^\s*> ?", "", text)


class BuildDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.years = sorted(int(folder.name[:-1])
                           for folder in build_data.QUESTION_DIR.glob("*年")
                           if folder.is_dir())
        cls.sources = {}
        cls.blocks = {}
        cls.questions = {}
        cls.answers = {}
        for year in cls.years:
            cls.sources[year] = build_data.read_year(
                year, build_data.QUESTION_DIR).read_text(encoding="utf-8")
            cls.blocks[year] = source_blocks(cls.sources[year])
            cls.questions[year], _ = build_data.parse_questions(year)
            cls.answers[year], _ = build_data.parse_answers(year)

    def test_all_18_years_have_57_questions_and_answers(self):
        self.assertEqual(self.years, list(range(2009, 2027)))
        self.assertEqual(sum(map(len, self.questions.values())), 1026)
        for year in self.years:
            with self.subTest(year=year):
                self.assertEqual(set(self.questions[year]), set(range(1, 58)))
                self.assertEqual(set(self.answers[year]), set(range(1, 58)))

    def test_990_objective_questions_have_five_options_and_valid_answers(self):
        count = 0
        for year in self.years:
            for number in range(1, 56):
                with self.subTest(year=year, number=number):
                    question = self.questions[year][number]
                    self.assertEqual(set(question["options"]), set("ABCDE"))
                    self.assertTrue(all(question["options"].values()))
                    self.assertIn(self.answers[year][number]["answer"], question["options"])
                    self.assertTrue(self.answers[year][number]["explanation"])
                    count += 1
        self.assertEqual(count, 990)

    def test_180_condition_questions_keep_their_years_original_legend(self):
        for year in self.years:
            legend_text = self.sources[year].split("## 二、条件充分性判断", 1)[1]
            legend_text = legend_text.split("### 第 16 题", 1)[0]
            expected = {key: value.strip() for key, value in OPTION.findall(legend_text)}
            self.assertEqual(set(expected), set("ABCDE"))
            for number in range(16, 26):
                with self.subTest(year=year, number=number):
                    self.assertEqual(self.questions[year][number]["options"], expected)
        for year in (2017, 2019):
            self.assertEqual(self.questions[year][16]["options"]["C"],
                             "条件（1）和条件（2）单独都不充分，但条件（1）和条件（2）联合起来充分")
        self.assertEqual(self.questions[2025][16]["options"]["C"],
                         "条件（1）和（2）单独都不充分，但条件（1）和（2）联合起来充分；")

    def test_q15_keeps_actual_options_in_every_year(self):
        for year in self.years:
            _, body = question_block(self.blocks[year], 15)
            expected = {key: value.strip() for key, value in OPTION.findall(body)}
            with self.subTest(year=year):
                self.assertEqual(self.questions[year][15]["options"], expected)
                self.assertNotIn("解题说明", self.questions[year][15]["stem"])
        self.assertEqual(self.questions[2019][15]["options"], {
            "A": "$2^{99} - 1$", "B": "$2^{99}$", "C": "$2^{99} + 1$",
            "D": "$2^{100} - 1$", "E": "$2^{100} + 1$",
        })
        self.assertEqual(self.questions[2025][15]["options"],
                         dict(zip("ABCDE", ("5 种", "6 种", "10 种", "12 种", "15 种"))))

    def test_shared_stems_and_all_svg_figures_belong_to_correct_questions(self):
        for year in self.years:
            expected_shared = {number: ("", []) for number in range(1, 58)}
            for heading, body in self.blocks[year]:
                match = re.match(r"### (\d+)[~～](\d+) 题基于以下题干", heading)
                if not match:
                    continue
                body = "\n".join(line for line in unquote(body).splitlines()
                                 if line.strip() and line.strip() != "---"
                                 and not IMAGE.fullmatch(line))
                figures = SVG.findall(body)
                stem = "\n".join(line for line in SVG.sub("", body).splitlines()
                                 if line.strip()).strip()
                for number in range(int(match[1]), int(match[2]) + 1):
                    expected_shared[number] = (stem, figures)
            for number, question in self.questions[year].items():
                with self.subTest(year=year, number=number):
                    stem, figures = expected_shared[number]
                    _, own_body = question_block(self.blocks[year], number)
                    self.assertEqual(question["shared"], stem)
                    self.assertEqual(question["figures"], SVG.findall(unquote(own_body)) + figures)
                    self.assertNotIn("<svg", question["stem"])
                    self.assertNotIn("<svg", question["shared"])

    def test_2019_garden_figure_is_on_q54_q55_not_q53(self):
        questions = self.questions[2019]
        self.assertEqual(questions[53]["shared"], "")
        self.assertEqual(questions[53]["figures"], [])
        self.assertNotIn("某园艺公司", questions[53]["stem"])
        self.assertEqual(questions[54]["shared"], questions[55]["shared"])
        self.assertEqual(questions[54]["figures"], questions[55]["figures"])
        for number in (54, 55):
            self.assertIn("某园艺公司", questions[number]["shared"])
            self.assertEqual(len(questions[number]["figures"]), 1)
            self.assertIn("<polygon", questions[number]["figures"][0])

    def test_all_original_image_paths_are_preserved_and_exist(self):
        for year in self.years:
            parent = build_data.read_year(year, build_data.QUESTION_DIR).parent
            for number, question in self.questions[year].items():
                with self.subTest(year=year, number=number):
                    _, body = question_block(self.blocks[year], number)
                    self.assertEqual(IMAGE.findall(body), [question["image"]])
                    self.assertTrue(question["image"].startswith("images/"))
                    self.assertTrue((parent / question["image"]).is_file())
            # Shared-stem slices remain in the source bank, too.
            for image in IMAGE.findall(self.sources[year]):
                self.assertTrue((parent / image).is_file(), str(parent / image))

    def test_writing_heading_content_is_preserved(self):
        for year in self.years:
            for number in (56, 57):
                with self.subTest(year=year, number=number):
                    question = self.questions[year][number]
                    self.assertTrue(question["stem"])
                    self.assertEqual(question["options"], {})
        for number in (56, 57):
            heading, body = question_block(self.blocks[2025], number)
            title_content = heading.split(". ", 1)[1]
            self.assertTrue(self.questions[2025][number]["stem"].startswith(title_content))
            self.assertIn(body.strip().splitlines()[0], self.questions[2025][number]["stem"])

    def test_any_header_ends_the_previous_question(self):
        source = self.sources[2025].replace(
            "## 二、条件充分性判断", "### 不属于第15题\n不应进入上一题\n\n## 二、条件充分性判断", 1)
        with mock.patch.object(build_data, "read_year") as read_year:
            read_year.return_value.read_text.return_value = source
            questions, _ = build_data.parse_questions(2025)
        self.assertEqual(questions[15], self.questions[2025][15])
        self.assertEqual(questions[56], self.questions[2025][56])
        self.assertEqual(questions[57], self.questions[2025][57])

    def test_missing_legend_is_rejected_without_a_standard_fallback(self):
        source = self.sources[2019]
        start = source.index("## 二、条件充分性判断")
        end = source.index("### 第 16 题", start)
        incomplete = re.sub(r"(?m)^- \*\*E\*\*．.*\n", "", source[start:end])
        with mock.patch.object(build_data, "read_year") as read_year:
            read_year.return_value.read_text.return_value = source[:start] + incomplete + source[end:]
            with self.assertRaisesRegex(ValueError, "2019: incomplete A-E"):
                build_data.parse_questions(2019)

    def test_build_rejects_invalid_objective_data_before_writing(self):
        variants = [
            ("missing option", {"A": "one"}, "A"),
            ("extra option", dict.fromkeys("ABCDEF", "text"), "A"),
            ("empty option", {**dict.fromkeys("ABCDE", "text"), "E": ""}, "A"),
            ("missing answer", dict.fromkeys("ABCDE", "text"), None),
            ("invalid answer", dict.fromkeys("ABCDE", "text"), "F"),
            ("multiple answers", dict.fromkeys("ABCDE", "text"), "AB"),
        ]
        for label, options, answer in variants:
            for number in (1, 16, 25, 55):
                with self.subTest(label=label, number=number):
                    questions = copy.deepcopy(self.questions[2009])
                    answers = copy.deepcopy(self.answers[2009])
                    questions[number]["options"] = options
                    answers[number]["answer"] = answer
                    with (mock.patch.object(build_data, "parse_questions", return_value=(questions, "")),
                          mock.patch.object(build_data, "parse_answers", return_value=(answers, "")),
                          mock.patch.object(build_data, "OUTPUT") as output,
                          mock.patch.object(build_data, "BUNDLE") as bundle):
                        with self.assertRaisesRegex(ValueError, rf"2009 Q{number}:"):
                            build_data.main()
                        output.write_text.assert_not_called()
                        bundle.write_text.assert_not_called()

    def test_generated_json_and_js_match_all_parsed_questions(self):
        payload = json.loads(build_data.OUTPUT.read_text(encoding="utf-8"))
        bundle = build_data.BUNDLE.read_text(encoding="utf-8")
        prefix = "window.KAOYAN199_DATA = "
        self.assertTrue(bundle.startswith(prefix))
        self.assertTrue(bundle.endswith(";\n"))
        self.assertEqual(json.loads(bundle[len(prefix):-2]), payload)
        self.assertEqual(payload["meta"]["years"], self.years)
        self.assertEqual(payload["meta"]["question_count"], 1026)
        expected = [{**question, **self.answers[year][number]}
                    for year in self.years
                    for number, question in self.questions[year].items()]
        self.assertEqual(payload["questions"], expected)


if __name__ == "__main__":
    unittest.main()
