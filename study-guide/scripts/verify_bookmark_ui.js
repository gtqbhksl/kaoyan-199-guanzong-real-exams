// Verifies manually bookmarking questions (including correctly answered ones) into the mistake notebook.
// node study-guide/scripts/verify_bookmark_ui.js
// Optional: PLAYWRIGHT_MODULE_PATH, CHROME_PATH, TEST_BASE_URL, UI_TEST_OUTPUT_DIR.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
const url = `${base}/study-guide/index.html#practice`;
const storeKey = "kaoyan199-study-guide-v1";
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/questions.json"), "utf8"));
const passed = [];

const years = [...new Set(fixture.questions.map(q => q.year))].sort((a, b) => b - a);
const year = years[0];
function question(number) {
  const q = fixture.questions.find(item => item.year === year && item.number === number);
  assert.ok(q, `fixture 缺少 ${year}/${number}`);
  return q;
}
const a = question(1);   // 答对后手动收藏
const b = question(2);   // 先收藏后答错
const c = question(3);   // 先收藏后重做答对
const d = question(4);   // 直接答错（自动收录）
const e = question(5);   // 未作答直接收藏
const w = question(56);  // 写作题不提供收藏
const wrong = q => Object.keys(q.options).find(letter => letter !== q.answer);
const key = q => `${q.year}:${q.number}`;

function check(label, value) {
  assert.ok(value, label);
  passed.push(label);
}
const practice = page => page.locator("#view-practice");
const panel = page => practice(page).locator("#question-panel");
const mistakes = page => page.locator("#view-mistakes");
const card = (page, q) => mistakes(page).locator(`#mistakes-list article.mistake-card[data-year="${q.year}"][data-number="${q.number}"]`);
const option = (page, letter) => panel(page).locator(`[data-option="${letter}"]`);
async function store(page) {
  return page.evaluate(name => JSON.parse(localStorage.getItem(name) || "{}"), storeKey);
}
async function ready(page) {
  await practice(page).locator(`#practice-year option[value="${year}"]`).waitFor({ state: "attached" });
}
async function openView(page, view) {
  const menu = page.locator("#menu-toggle");
  if (await menu.isVisible() && !(await page.locator("#sidebar").evaluate(el => el.classList.contains("is-open")))) {
    await menu.click();
  }
  await page.locator(`button[data-view="${view}"]`).click();
  await page.locator(`#view-${view}`).waitFor();
}
async function goQuestion(page, q) {
  if (!(await practice(page).isVisible())) await openView(page, "practice");
  const module = q.number <= 25 ? "math" : q.number <= 55 ? "logic" : "writing";
  if (await practice(page).locator("#practice-module").inputValue() !== module) {
    await practice(page).locator("#practice-module").selectOption(module);
  }
  await practice(page).locator("#practice-question").selectOption(String(q.number));
  await page.waitForFunction(({ year, number }) => {
    const title = document.querySelector("#view-practice #question-panel .question-kicker strong");
    return title?.textContent.trim() === `${year} 年 · 第 ${number} 题`;
  }, { year: q.year, number: q.number });
}
async function submit(page, letter) {
  await option(page, letter).click();
  await panel(page).locator("#submit-answer").click();
  await panel(page).locator("#question-feedback").waitFor();
}
async function badge(page) {
  return Number(await page.locator("#nav-mistakes-badge").textContent());
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe"
  });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await ready(page);

    // 1) 答对的题可以手动收藏
    await goQuestion(page, a);
    await submit(page, a.answer);
    check("答对后反馈为回答正确且提供加入错题本按钮",
      (await panel(page).locator(".feedback-status").textContent()).includes("回答正确") &&
      await panel(page).locator("#bookmark-question").isVisible());
    await panel(page).locator("#bookmark-question").click();
    await page.waitForTimeout(200);
    check("收藏后按钮变为移出错题本且待复习计数加一",
      await panel(page).locator("#unbookmark-question").isVisible() && await badge(page) === 1);
    const savedA = (await store(page)).mistakes?.[a.year]?.[a.number];
    check("收藏记录标记为手动且不计答错次数",
      savedA?.source === "manual" && savedA?.wrongCount === 0 && savedA?.mastered === false);

    await openView(page, "mistakes");
    check("错题本出现手动收藏卡片并标注来源",
      await card(page, a).isVisible() &&
      (await card(page, a).locator(".mistake-meta").textContent()).includes("手动收藏") &&
      (await card(page, a).locator(".mistake-status").textContent()).includes("待复习") &&
      await card(page, a).locator('[data-mistake-action="remove"]').isVisible());

    // 2) 刷新后保留
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    await openView(page, "mistakes");
    check("刷新后手动收藏仍在错题本", await card(page, a).isVisible() && await badge(page) === 1);

    // 3) 卡片上可移出
    await card(page, a).locator('[data-mistake-action="remove"]').click();
    await page.waitForTimeout(200);
    check("移出后卡片消失且计数归零", await card(page, a).count() === 0 && await badge(page) === 0);

    // 4) 未作答的题也能收藏
    await goQuestion(page, e);
    check("未作答题目同样提供加入错题本", await panel(page).locator("#bookmark-question").isVisible());
    await panel(page).locator("#bookmark-question").click();
    await page.waitForTimeout(200);
    check("未作答收藏不产生作答记录", await badge(page) === 1 &&
      !(await store(page)).attempts?.[e.year]?.[e.number]);

    // 5) 先收藏后答错：合并为一条且不再可移出
    await goQuestion(page, b);
    await panel(page).locator("#bookmark-question").click();
    await page.waitForTimeout(150);
    await submit(page, wrong(b));
    await openView(page, "mistakes");
    const savedB = (await store(page)).mistakes?.[b.year]?.[b.number];
    check("收藏后答错合并为单条记录并累计次数",
      savedB?.source === "manual" && savedB?.wrongCount === 1 &&
      await mistakes(page).locator(`#mistakes-list article.mistake-card[data-number="${b.number}"]`).count() === 1);
    check("答错过的收藏不再提供移出按钮",
      (await card(page, b).locator(".mistake-meta").textContent()).includes("累计答错 1 次") &&
      await card(page, b).locator('[data-mistake-action="remove"]').count() === 0);

    // 6) 先收藏后重做答对：归入已订正
    await goQuestion(page, c);
    await panel(page).locator("#bookmark-question").click();
    await page.waitForTimeout(150);
    await openView(page, "mistakes");
    await card(page, c).locator('[data-mistake-action="retry"]').click();
    await page.waitForTimeout(200);
    await submit(page, c.answer);
    await openView(page, "mistakes");
    await mistakes(page).locator("#mistakes-status").selectOption("mastered");
    check("收藏题重做答对后归入已订正",
      await card(page, c).isVisible() &&
      (await card(page, c).locator(".mistake-status").textContent()).includes("已订正"));

    // 7) 自动收录的错题不提供收藏/移出按钮
    await goQuestion(page, d);
    await submit(page, wrong(d));
    check("自动收录题在训练页显示已在错题本",
      await panel(page).locator(".bookmarked-note").isVisible() &&
      await panel(page).locator("#bookmark-question").count() === 0 &&
      await panel(page).locator("#unbookmark-question").count() === 0);
    await openView(page, "mistakes");
    await mistakes(page).locator("#mistakes-status").selectOption("all");
    check("自动收录卡片无移出按钮且标注答错次数",
      await card(page, d).locator('[data-mistake-action="remove"]').count() === 0 &&
      (await card(page, d).locator(".mistake-meta").textContent()).includes("累计答错 1 次"));

    // 8) 写作题不提供收藏入口
    await goQuestion(page, w);
    check("写作题不显示收藏按钮", await panel(page).locator("#bookmark-question").count() === 0 &&
      await panel(page).locator("#unbookmark-question").count() === 0);

    if (process.env.UI_TEST_OUTPUT_DIR) {
      await openView(page, "mistakes");
      await mistakes(page).locator("#mistakes-status").selectOption("all");
      await page.screenshot({ path: path.join(process.env.UI_TEST_OUTPUT_DIR, "bookmark-desktop.png"), fullPage: true });
    }
    console.log(JSON.stringify({ passed, pageErrors: errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ passed, error: error.message, pageErrors: errors }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
