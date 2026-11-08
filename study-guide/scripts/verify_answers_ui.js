// Run against serve.py using an isolated browser profile, never the user's records.
// node study-guide/scripts/verify_answers_ui.js
// Optional: PLAYWRIGHT_MODULE_PATH, CHROME_PATH, TEST_BASE_URL, UI_TEST_OUTPUT_DIR.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8765";
const url = `${base}/study-guide/index.html#practice`;
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/questions.json"), "utf8"));
const passed = [];
function check(label, value) {
  assert.ok(value, label);
  passed.push(label);
}
async function title(page) {
  return (await page.locator(".question-kicker strong").textContent()).trim();
}
async function total(page) {
  return Number(await page.locator("#solved-total").textContent());
}
async function navigate(page, direction, year, number) {
  await page.getByRole("button", { name: direction, exact: true }).click();
  await page.getByText(`${year} 年 · 第 ${number} 题`, { exact: true }).waitFor();
}
async function submit(page, letter) {
  await page.locator(`[data-option="${letter}"]`).click();
  await page.locator("#submit-answer").click();
  await page.locator("#question-feedback").waitFor();
}
async function snapshot(page, name) {
  if (process.env.UI_TEST_OUTPUT_DIR) {
    await page.screenshot({ path: path.join(process.env.UI_TEST_OUTPUT_DIR, name), fullPage: true });
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe"
  });
  const errors = [];
  const monitor = (page) => page.on("pageerror", (error) => errors.push(error.message));
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    monitor(page);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.locator("#submit-answer").waitFor();
    check("没有选择时禁止提交", !(await page.locator("#submit-answer").isEnabled()));
    check("未提交时不展示解析", await page.locator("#question-feedback").count() === 0);
    await page.locator('[data-option="E"]').click();
    check("选择后可提交本题", await page.locator("#submit-answer").isEnabled());
    await navigate(page, "下一题", 2026, 2);
    check("下一题不继承上题选择", !(await page.locator("#submit-answer").isEnabled()));
    await page.locator('[data-option="A"]').click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#submit-answer").waitFor();
    check("刷新保留题号和未提交的A", (await title(page)).includes("第 2 题") &&
      await page.locator('[data-option="A"]').getAttribute("aria-pressed") === "true");
    await navigate(page, "上一题", 2026, 1);
    check("切回上一题恢复E草稿", await page.locator('[data-option="E"]').getAttribute("aria-pressed") === "true");
    await page.locator("#submit-answer").click();
    await page.locator("#question-feedback").waitFor();
    check("提交后仍停留本题", (await title(page)).includes("第 1 题"));
    check("正确作答即展示答案和解析", (await page.locator(".feedback-status").textContent()).includes("回答正确 · 你的答案 E · 正确答案 E") &&
      (await page.locator(".explanation").textContent()).includes("16 天"));
    check("只计入当前一题", await total(page) === 1);
    check("已提交题的全部选项锁定", await page.locator("[data-option]:disabled").count() === 5);
    check("解析区域获得焦点", await page.locator("#question-feedback").evaluate(el => el === document.activeElement));
    await snapshot(page, "answers-desktop.png");

    await navigate(page, "下一题", 2026, 2);
    check("第2题仍是A草稿而非已提交", await page.locator('[data-option="A"]').getAttribute("aria-pressed") === "true" &&
      await page.locator("#question-feedback").count() === 0);
    await page.locator("#submit-answer").click();
    await page.locator("#question-feedback").waitFor();
    check("错误作答显示所选A和正确D", (await page.locator(".feedback-status").textContent()).includes("回答错误 · 你的答案 A · 正确答案 D"));
    check("两题独立统计为50%", await total(page) === 2 && await page.locator("#accuracy-total").textContent() === "50%");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#question-feedback").waitFor();
    check("刷新恢复已提交题及其解析", (await title(page)).includes("第 2 题") &&
      (await page.locator(".feedback-status").textContent()).includes("正确答案 D"));
    await page.locator("#view-explanation").click();
    await page.locator("#view-explanation").click();
    check("反复查看解析不重复计数", await total(page) === 2);
    await navigate(page, "上一题", 2026, 1);
    check("其他题提交不覆盖第1题的结果", (await page.locator(".feedback-status").textContent()).includes("回答正确 · 你的答案 E · 正确答案 E"));

    await page.locator("#practice-year").selectOption("2025");
    check("不同年份同题号互相隔离", await page.locator("#question-feedback").count() === 0 && !(await page.locator("#submit-answer").isEnabled()));
    await page.locator('[data-option="B"]').click();
    await page.locator("#practice-year").selectOption("2026");
    await page.locator("#practice-module").selectOption("all");
    await navigate(page, "上一题", 2026, 2);
    check("切换模块仍可回看同题解析", (await page.locator(".feedback-status").textContent()).includes("正确答案 D"));
    await page.locator("#practice-module").selectOption("logic");
    await submit(page, "B");
    check("逻辑题支持独立提交", (await title(page)).includes("第 26 题") && (await page.locator(".feedback-status").textContent()).includes("回答正确"));

    await page.locator("#practice-module").selectOption("math");
    for (let number = 4; number <= 16; number++) await navigate(page, "下一题", 2026, number);
    check("条件充分性判断有五个完整选项", await page.locator("[data-option]").count() === 5 &&
      (await page.locator('[data-option="C"]').textContent()).includes("联合"));
    await submit(page, "C");
    check("条件充分性判断可提交并显示解析", (await page.locator(".feedback-status").textContent()).includes("回答正确 · 你的答案 C · 正确答案 C") &&
      await page.locator(".explanation").isVisible());
    check("四道不同题目只计四次", await total(page) === 4);
    await navigate(page, "下一题", 2026, 17);
    await page.locator('[data-option="B"]').click();
    await page.locator("#practice-module").selectOption("logic");
    await page.locator('[data-option="C"]').click();
    await page.locator("#practice-module").selectOption("math");
    await page.locator("#practice-clear").click();
    check("清除数学范围不删除逻辑作答", await total(page) === 1);
    for (let number = 2; number <= 17; number++) await navigate(page, "下一题", 2026, number);
    check("清除范围同时清除该范围草稿", !(await page.locator("#submit-answer").isEnabled()));
    await page.locator("#practice-module").selectOption("logic");
    check("其他范围未提交草稿不受清除影响", await page.locator('[data-option="C"]').getAttribute("aria-pressed") === "true");
    await page.locator("#practice-year").selectOption("2025");
    await page.locator("#practice-module").selectOption("math");
    check("其他年份草稿不受清除影响", await page.locator('[data-option="B"]').getAttribute("aria-pressed") === "true");

    // Old saved records have attempts but no drafts or practice-position fields.
    const oldAttempts = Object.fromEntries(fixture.questions
      .filter(q => q.year === 2026 && q.number <= 25)
      .map(q => [q.number, { selected: q.answer, correct: true, attempts: 1 }]));
    const oldContext = await browser.newContext({ storageState: {
      cookies: [], origins: [{ origin: base, localStorage: [{
        name: "kaoyan199-study-guide-v1",
        value: JSON.stringify({ attempts: { 2026: oldAttempts } })
      }] }]
    } });
    const oldPage = await oldContext.newPage();
    monitor(oldPage);
    await oldPage.goto(url, { waitUntil: "domcontentloaded" });
    await oldPage.locator("#question-feedback").waitFor();
    check("兼容旧记录且整模块已完成时仍可回看", await total(oldPage) === 25 &&
      await oldPage.locator("#submit-answer").count() === 0 && await oldPage.locator("[data-option]:disabled").count() === 5);
    await oldContext.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
    const mobilePage = await mobile.newPage();
    monitor(mobilePage);
    await mobilePage.goto(url, { waitUntil: "domcontentloaded" });
    await mobilePage.locator("#submit-answer").waitFor();
    const buttonRect = await mobilePage.locator("#submit-answer").boundingBox();
    check("390px窄屏提交按钮不超出屏幕", buttonRect.x >= 0 && buttonRect.x + buttonRect.width <= 390);
    await submit(mobilePage, "E");
    check("窄屏同样可提交并阅读解析", await mobilePage.locator(".explanation").isVisible());
    check("窄屏无页面横向溢出", await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await snapshot(mobilePage, "answers-mobile.png");
    await mobile.close();
    await context.close();
    assert.deepEqual(errors, [], "浏览器不应出现未处理的JavaScript错误");
    console.log(JSON.stringify({ passed: passed.length, checks: passed, pageErrors: errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
