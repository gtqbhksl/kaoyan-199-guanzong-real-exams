// Run against serve.py using isolated browser contexts and synthetic records only.
// node study-guide/scripts/verify_mistakes_ui.js
// Optional: PLAYWRIGHT_MODULE_PATH, CHROME_PATH, TEST_BASE_URL, UI_TEST_OUTPUT_DIR.
// If screenshots are wanted, UI_TEST_OUTPUT_DIR should point to an existing directory.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
const url = `${base}/study-guide/index.html#practice`;
const storeKey = "kaoyan199-study-guide-v1";
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/questions.json"), "utf8"));
const passed = [];
const buckets = ["attempts", "drafts", "mistakes", "retries"];
const statusClasses = ["is-unanswered", "is-draft", "is-correct", "is-wrong", "is-retry"];
const statusNames = { unanswered: "未作答", draft: "待提交", correct: "答对", wrong: "答错", retry: "重做中" };

// Only module boundaries/question identities are fixed; years and answer letters come from the fixture.
const years = [...new Set(fixture.questions.map(q => q.year))].sort((a, b) => b - a);
const [yearA, yearB] = years;
assert.ok(yearA && yearB && yearA !== yearB, "fixture 必须包含两个年份");
function question(year, number) {
  const q = fixture.questions.find(item => item.year === year && item.number === number);
  assert.ok(q && q.options && Object.hasOwn(q.options, q.answer), `fixture 缺少 ${year}/${number} 的可提交答案`);
  assert.ok(Object.keys(q.options).some(letter => letter !== q.answer), "fixture 必须提供错误选项");
  return q;
}
const a = question(yearA, 1);
const draftMath = question(yearA, 2);
const b = question(yearA, 26);
const untouchedLogic = question(yearA, 27);
const lastLogic = question(yearA, 55);
const c = question(yearB, 1);
const d = question(yearB, 26);
const mobileLast = question(yearB, 55);
const wrong = q => Object.keys(q.options).find(letter => letter !== q.answer);
const key = q => `${q.year}:${q.number}`;
const entry = (store, bucket, q) => store[bucket]?.[q.year]?.[q.number];
const hasEntry = (store, bucket, q) => Object.hasOwn(store[bucket]?.[q.year] || {}, q.number);
const practice = page => page.locator("#view-practice");
const panel = page => practice(page).locator("#question-panel");
const mistakes = page => page.locator("#view-mistakes");
const card = (page, q) => mistakes(page).locator(`#mistakes-list article.mistake-card[data-year="${q.year}"][data-number="${q.number}"]`);
const option = (page, letter) => panel(page).locator(`[data-option="${letter}"]`);

function check(label, value) {
  assert.ok(value, label);
  passed.push(label);
}
async function store(page) {
  return page.evaluate(name => JSON.parse(localStorage.getItem(name) || "{}"), storeKey);
}
async function solved(page) {
  return Number(await page.locator("#solved-total").textContent());
}
async function ready(page) {
  await practice(page).locator(`#practice-year option[value="${yearA}"]`).waitFor({ state: "attached" });
}
async function reload(page, view) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await page.locator(`#view-${view}`).waitFor();
}
async function openView(page, view) {
  const menu = page.locator("#menu-toggle");
  if (await menu.isVisible() && !(await page.locator("#sidebar").evaluate(el => el.classList.contains("is-open")))) {
    await menu.click();
  }
  await page.locator(`button[data-view="${view}"]`).click();
  await page.locator(`#view-${view}`).waitFor();
}
async function waitQuestion(page, q) {
  await practice(page).waitFor();
  await page.waitForFunction(({ year, number }) => {
    const title = document.querySelector("#view-practice #question-panel .question-kicker strong");
    return title?.textContent.trim() === `${year} 年 · 第 ${number} 题` &&
      document.querySelector("#practice-year")?.value === String(year) &&
      document.querySelector("#practice-question")?.value === String(number);
  }, { year: q.year, number: q.number });
}
async function selectQuestion(page, q) {
  await practice(page).locator("#practice-question").selectOption(String(q.number));
  await waitQuestion(page, q);
}
async function goQuestion(page, q, module = q.number <= 25 ? "math" : "logic") {
  if (!(await practice(page).isVisible())) await openView(page, "practice");
  const yearSelect = practice(page).locator("#practice-year");
  const moduleSelect = practice(page).locator("#practice-module");
  if (await yearSelect.inputValue() !== String(q.year)) await yearSelect.selectOption(String(q.year));
  if (await moduleSelect.inputValue() !== module) await moduleSelect.selectOption(module);
  await selectQuestion(page, q);
}
async function openNavigator(page) {
  const navigator = practice(page).locator("details#question-navigator");
  if (!(await navigator.evaluate(el => el.open))) await navigator.locator(":scope > summary").click();
  return navigator;
}
async function jumpQuestion(page, q) {
  const navigator = await openNavigator(page);
  await navigator.locator(`button[data-question-jump="${q.number}"]`).click();
  await waitQuestion(page, q);
}
async function submit(page, letter) {
  await option(page, letter).click();
  await panel(page).locator("#submit-answer").click();
  await panel(page).locator("#question-feedback").waitFor();
}
async function feedbackMatches(page, q, letter) {
  const feedback = panel(page).locator("#question-feedback");
  if (!(await feedback.isVisible())) return false;
  const text = await feedback.locator(".feedback-status").textContent();
  return text.includes(letter === q.answer ? "回答正确" : "回答错误") &&
    text.includes(`你的答案 ${letter}`) && text.includes(`正确答案 ${q.answer}`) &&
    await feedback.locator(".explanation").isVisible() &&
    await panel(page).locator("[data-option]:disabled").count() === Object.keys(q.options).length;
}
async function noAnswerLeak(page) {
  return await panel(page).locator([
    "#question-feedback:visible", ".explanation:visible", ".feedback-status:visible", "#view-explanation:visible",
    "[data-option].is-correct", "[data-option].is-incorrect", "[data-option].is-wrong"
  ].join(", ")).count() === 0 && !/正确答案|参考答案|本题解析/.test(await panel(page).innerText());
}
async function draftMatches(page, q, letter = null, retry = false) {
  const selected = panel(page).locator('[data-option][aria-pressed="true"]');
  return await noAnswerLeak(page) &&
    await panel(page).locator("[data-option]:enabled").count() === Object.keys(q.options).length &&
    await selected.count() === (letter ? 1 : 0) &&
    (!letter || await option(page, letter).getAttribute("aria-pressed") === "true") &&
    await panel(page).locator("#submit-answer").isEnabled() === Boolean(letter) &&
    (!retry || await panel(page).locator("#cancel-retry").isVisible());
}
async function rangeMatches(page, first, last) {
  const expected = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const options = await practice(page).locator("#practice-question option").evaluateAll(els => els.map(el => Number(el.value)).sort((a, b) => a - b));
  const buttons = await practice(page).locator("#question-navigator button[data-question-jump]").evaluateAll(els => els.map(el => Number(el.dataset.questionJump)).sort((a, b) => a - b));
  return isDeepStrictEqual(options, expected) && isDeepStrictEqual(buttons, expected);
}
async function navMatches(page, current, expected) {
  const rows = await practice(page).locator("#question-navigator button[data-question-jump]").evaluateAll(els => els.map(el => ({
    number: Number(el.dataset.questionJump), label: el.getAttribute("aria-label"),
    current: el.getAttribute("aria-current"), classes: [...el.classList]
  })));
  return rows.length > 0 && rows.some(row => row.number === current) && rows.every(row => {
    const names = statusClasses.filter(name => row.classes.includes(name));
    const status = expected[row.number];
    return row.current === String(row.number === current) && names.length === 1 &&
      /^第 \d+ 题 · (未作答|待提交|答对|答错|重做中)$/.test(row.label || "") &&
      (!status || row.label === `第 ${row.number} 题 · ${statusNames[status]}` && names[0] === `is-${status}`);
  });
}
async function filters(page, year = "all", module = "all", status = "pending") {
  await mistakes(page).locator("#mistakes-year").selectOption(String(year));
  await mistakes(page).locator("#mistakes-module").selectOption(module);
  await mistakes(page).locator("#mistakes-status").selectOption(status);
}
async function filtersMatch(page, year = "all", module = "all", status = "pending") {
  return await mistakes(page).locator("#mistakes-year").inputValue() === String(year) &&
    await mistakes(page).locator("#mistakes-module").inputValue() === module &&
    await mistakes(page).locator("#mistakes-status").inputValue() === status;
}
async function listMatches(page, questions) {
  const actual = await mistakes(page).locator("#mistakes-list article.mistake-card").evaluateAll(els => els.map(el => `${el.dataset.year}:${el.dataset.number}`).sort());
  // The first number is the filtered count; the summary may also include the archive total.
  const summary = await mistakes(page).locator("#mistakes-summary").textContent();
  return isDeepStrictEqual(actual, questions.map(key).sort()) && Number(summary.match(/\d+/)?.[0]) === questions.length;
}
async function countsMatch(page, pending, mastered) {
  return Number(await page.locator("#nav-mistakes-badge").textContent()) === pending &&
    Number(await mistakes(page).locator("#mistakes-pending-total").textContent()) === pending &&
    Number(await mistakes(page).locator("#mistakes-mastered-total").textContent()) === mastered;
}
async function cardAction(page, q, action) {
  // Every caller must be on the mistakes view: either action switches back to practice.
  await mistakes(page).waitFor();
  await card(page, q).locator(`button[data-mistake-action="${action}"]`).click();
  await waitQuestion(page, q);
}
function recordsMatching(saved, predicate) {
  return Object.fromEntries(buckets.map(bucket => [bucket, Object.fromEntries(
    Object.entries(saved[bucket] || {}).flatMap(([year, questions]) => Object.entries(questions)
      .filter(([number]) => predicate(Number(year), Number(number)))
      .map(([number, value]) => [`${year}:${number}`, value]))
  )]));
}
const emptyRecords = saved => Object.values(saved).every(values => Object.keys(values).length === 0);
async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}
async function fitsWidth(locator, width) {
  await locator.scrollIntoViewIfNeeded();
  const rect = await locator.boundingBox();
  return rect !== null && rect.width > 0 && rect.x >= 0 && rect.x + rect.width <= width;
}
async function snapshot(page, name) {
  if (process.env.UI_TEST_OUTPUT_DIR) {
    await page.screenshot({ path: path.join(process.env.UI_TEST_OUTPUT_DIR, name), fullPage: true });
  }
}
function storageState(saved) {
  return { cookies: [], origins: [{ origin: new URL(base).origin, localStorage: [{ name: storeKey, value: JSON.stringify(saved) }] }] };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe"
  });
  const errors = [];
  const monitor = (page, name) => page.on("pageerror", error => errors.push(`${name}: ${error.message}`));
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    monitor(page, "desktop");
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await ready(page);
    await goQuestion(page, a);
    check("数学题号下拉与面板均为1–25，初始当前题未作答且不泄漏答案", await rangeMatches(page, 1, 25) &&
      await navMatches(page, a.number, { 1: "unanswered" }) && await draftMatches(page, a));

    await selectQuestion(page, draftMath);
    await option(page, wrong(draftMath)).click();
    await selectQuestion(page, a);
    check("下拉直接跳题保留普通草稿且不把选项带到另一题", entry(await store(page), "drafts", draftMath) === wrong(draftMath) &&
      await navMatches(page, a.number, { 1: "unanswered", 2: "draft" }) && await draftMatches(page, a));
    await jumpQuestion(page, draftMath);
    check("展开题号面板直接回到草稿题，同步题号与待提交状态", await draftMatches(page, draftMath, wrong(draftMath)) &&
      await navMatches(page, draftMath.number, { 1: "unanswered", 2: "draft" }));

    await selectQuestion(page, a);
    await submit(page, wrong(a));
    const firstSaved = await store(page);
    const originalAttempt = entry(firstSaved, "attempts", a);
    check("首次答错自动归档，显示本题解析且仅计一个已完成题", originalAttempt?.correct === false &&
      originalAttempt.selected === wrong(a) && entry(firstSaved, "mistakes", a)?.wrongCount === 1 &&
      await feedbackMatches(page, a, wrong(a)) && await solved(page) === 1 &&
      await navMatches(page, a.number, { 1: "wrong", 2: "draft" }));
    await openView(page, "mistakes");
    check("错题本默认all/all/pending，卡片操作、全局计数和筛选数量正确", await filtersMatch(page) &&
      await listMatches(page, [a]) && await countsMatch(page, 1, 0) &&
      await card(page, a).locator('button[data-mistake-action="view"]').isVisible() &&
      await card(page, a).locator('button[data-mistake-action="retry"]').isVisible());

    // Deliberately leave practice on another year/module before viewing the archived question.
    await goQuestion(page, d);
    await openView(page, "mistakes");
    await cardAction(page, a, "view");
    check("查看错题跨年份模块准确定位原题并恢复既有解析，不新增提交", await feedbackMatches(page, a, wrong(a)) &&
      await practice(page).locator("#practice-module").inputValue() === "math" &&
      isDeepStrictEqual(entry(await store(page), "attempts", a), originalAttempt) && await solved(page) === 1);
    await openView(page, "mistakes");
    await cardAction(page, a, "retry");
    check("卡片重做隐藏答案解析、不预选，并保留原attempt和重做标记", await draftMatches(page, a, null, true) &&
      hasEntry(await store(page), "retries", a) && isDeepStrictEqual(entry(await store(page), "attempts", a), originalAttempt) &&
      await navMatches(page, a.number, { 1: "retry", 2: "draft" }) && await solved(page) === 1);
    await option(page, a.answer).click();
    await selectQuestion(page, draftMath);
    const ordinaryDraftIntact = await draftMatches(page, draftMath, wrong(draftMath));
    await jumpQuestion(page, a);
    check("重做草稿与普通草稿各自保留，跳回本题仍无答案泄漏", ordinaryDraftIntact &&
      await draftMatches(page, a, a.answer, true) && entry(await store(page), "drafts", a) === a.answer &&
      isDeepStrictEqual(entry(await store(page), "attempts", a), originalAttempt));
    await reload(page, "practice");
    await waitQuestion(page, a);
    check("刷新保留重做当前题号、草稿、状态和旧attempt", await draftMatches(page, a, a.answer, true) &&
      await navMatches(page, a.number, { 1: "retry", 2: "draft" }) && hasEntry(await store(page), "retries", a) &&
      isDeepStrictEqual(entry(await store(page), "attempts", a), originalAttempt));
    await openView(page, "mistakes");
    await cardAction(page, a, "view");
    await reload(page, "practice");
    await waitQuestion(page, a);
    check("重做中回看旧解析只暂停练习，刷新也不丢失重做草稿", await feedbackMatches(page, a, wrong(a)) &&
      entry(await store(page), "drafts", a) === a.answer &&
      isDeepStrictEqual(entry(await store(page), "attempts", a), originalAttempt));
    await panel(page).locator("#retry-question").click();
    check("回看后继续重做恢复草稿并再次隐藏旧答案解析", await draftMatches(page, a, a.answer, true) &&
      await navMatches(page, a.number, { 1: "retry", 2: "draft" }));
    await panel(page).locator("#cancel-retry").click();
    check("取消重做回到旧解析并删除该题重做标记和草稿，不动别题草稿", await feedbackMatches(page, a, wrong(a)) &&
      !hasEntry(await store(page), "retries", a) && !hasEntry(await store(page), "drafts", a) &&
      entry(await store(page), "drafts", draftMath) === wrong(draftMath) &&
      isDeepStrictEqual(entry(await store(page), "attempts", a), originalAttempt) &&
      await navMatches(page, a.number, { 1: "wrong", 2: "draft" }));

    await panel(page).locator("#question-feedback #retry-question").click();
    await submit(page, wrong(a));
    check("反馈区可发起重做，重做答错增加wrongCount但不增加已完成题数", await feedbackMatches(page, a, wrong(a)) &&
      entry(await store(page), "mistakes", a)?.wrongCount === 2 && entry(await store(page), "attempts", a)?.correct === false &&
      !hasEntry(await store(page), "retries", a) && !hasEntry(await store(page), "drafts", a) && await solved(page) === 1);
    await panel(page).locator("#question-feedback #open-mistakes").click();
    await mistakes(page).waitFor();
    check("反馈区返回错题本，重复答错仍只有一张待复习卡片", await listMatches(page, [a]) && await countsMatch(page, 1, 0));
    await cardAction(page, a, "retry");
    await submit(page, a.answer);
    check("重做答对更新原attempt与导航，不增加wrongCount或已完成题数", await feedbackMatches(page, a, a.answer) &&
      entry(await store(page), "attempts", a)?.correct === true && entry(await store(page), "mistakes", a)?.wrongCount === 2 &&
      !hasEntry(await store(page), "retries", a) && !hasEntry(await store(page), "drafts", a) &&
      await navMatches(page, a.number, { 1: "correct", 2: "draft" }) && await solved(page) === 1);
    await openView(page, "mistakes");
    check("已订正题从待复习列表移出，徽标及全局已订正计数同步", await listMatches(page, []) && await countsMatch(page, 0, 1));
    await filters(page, "all", "all", "mastered");
    const masteredCardPresent = await listMatches(page, [a]);
    await cardAction(page, a, "view");
    const masteredViewWorks = await feedbackMatches(page, a, a.answer);
    await openView(page, "mistakes");
    await cardAction(page, a, "retry");
    check("已订正卡片仍可查看正确解析及再次无泄漏重做", masteredCardPresent && masteredViewWorks &&
      await draftMatches(page, a, null, true) && entry(await store(page), "attempts", a)?.correct === true);
    await submit(page, wrong(a));
    await openView(page, "mistakes");
    await filters(page);
    check("已订正题再答错重新进入待复习，累计错误增加但卡片不重复", await listMatches(page, [a]) &&
      await countsMatch(page, 1, 0) && entry(await store(page), "mistakes", a)?.wrongCount === 3 && await solved(page) === 1);
    await cardAction(page, a, "retry");
    await submit(page, a.answer);

    // Four question identities across two years and both modules; no card-order assumptions.
    for (const q of [b, c, d]) {
      await goQuestion(page, q);
      await submit(page, wrong(q));
    }
    await openView(page, "mistakes");
    await filters(page);
    check("两年数学与逻辑错题独立归档，全局只统计四道不同题", await listMatches(page, [b, c, d]) &&
      await countsMatch(page, 3, 1) && await solved(page) === 4);
    await filters(page, yearA);
    check("年份筛选仅显示该年待复习题，不改变全局徽标与计数", await listMatches(page, [b]) && await countsMatch(page, 3, 1));
    await filters(page, yearA, "math");
    const emptyPendingMath = await listMatches(page, []);
    await filters(page, yearA, "math", "all");
    check("年份和模块组合筛选可显示空列表，all状态包含已订正数学题", emptyPendingMath && await listMatches(page, [a]) &&
      await countsMatch(page, 3, 1));
    await filters(page, yearA, "math", "mastered");
    const masteredMath = await listMatches(page, [a]);
    await filters(page, yearA, "logic", "mastered");
    check("已订正筛选与模块同时生效，逻辑待复习题不会混入", masteredMath && await listMatches(page, []));
    await filters(page, yearB, "logic", "pending");
    const otherYearLogic = await listMatches(page, [d]);
    await filters(page, yearA, "math", "mastered");
    await reload(page, "mistakes");
    check("刷新保留三个非默认筛选值及结果，全局计数不受筛选影响", otherYearLogic &&
      await filtersMatch(page, yearA, "math", "mastered") && await listMatches(page, [a]) && await countsMatch(page, 3, 1));
    await filters(page, yearB, "all", "all");
    const otherYearBothModules = await listMatches(page, [c, d]);
    await filters(page, "all", "math", "all");
    const bothYearsMath = await listMatches(page, [a, c]);
    await filters(page, "all", "all", "all");
    check("all年份、模块和状态正确组合，收录卡片集合不依赖排列顺序", otherYearBothModules && bothYearsMath &&
      await listMatches(page, [a, b, c, d]) && await countsMatch(page, 3, 1));
    await snapshot(page, "mistakes-desktop.png");

    await goQuestion(page, b);
    check("逻辑题号下拉与面板使用真实26–55题号而非模块内索引", await rangeMatches(page, 26, 55) &&
      await navMatches(page, b.number, { 26: "wrong", 27: "unanswered", 55: "unanswered" }));
    await selectQuestion(page, lastLogic);
    const lastWasUnanswered = await draftMatches(page, lastLogic);
    await option(page, wrong(lastLogic)).click();
    await jumpQuestion(page, untouchedLogic);
    const middleWasUnanswered = await draftMatches(page, untouchedLogic);
    await jumpQuestion(page, lastLogic);
    check("直接选第55题与面板往返均无需下一题，并隔离恢复普通草稿", lastWasUnanswered && middleWasUnanswered &&
      await draftMatches(page, lastLogic, wrong(lastLogic)) &&
      await navMatches(page, lastLogic.number, { 26: "wrong", 27: "unanswered", 55: "draft" }));
    await goQuestion(page, lastLogic, "all");
    check("整卷1–55导航同步正确、错误、草稿、未作答状态及唯一aria-current", await rangeMatches(page, 1, 55) &&
      await navMatches(page, lastLogic.number, { 1: "correct", 2: "draft", 26: "wrong", 27: "unanswered", 55: "draft" }) &&
      await draftMatches(page, lastLogic, wrong(lastLogic)));

    const beforeRetries = await store(page);
    for (const q of [a, b, c]) {
      await goQuestion(page, q);
      await panel(page).locator("#question-feedback #retry-question").click();
      await option(page, q.answer).click();
    }
    const beforeClear = await store(page);
    check("跨模块和年份的重做标记与草稿相互隔离，开始重做不覆盖旧attempt", [a, b, c].every(q =>
      hasEntry(beforeClear, "retries", q) && entry(beforeClear, "drafts", q) === q.answer &&
      isDeepStrictEqual(entry(beforeClear, "attempts", q), entry(beforeRetries, "attempts", q))) &&
      entry(beforeClear, "drafts", draftMath) === wrong(draftMath) && entry(beforeClear, "drafts", lastLogic) === wrong(lastLogic));
    await goQuestion(page, a);
    await practice(page).locator("#practice-clear").click();
    const afterMathClear = await store(page);
    const isClearedMath = (year, number) => year === yearA && number >= 1 && number <= 25;
    check("清除数学范围同时删除attempts/drafts/mistakes/retries并重置导航", emptyRecords(recordsMatching(afterMathClear, isClearedMath)) &&
      await draftMatches(page, a) && await navMatches(page, a.number, { 1: "unanswered", 2: "unanswered" }) && await solved(page) === 3);
    await reload(page, "practice");
    check("清除数学并刷新不影响其他模块或其他年份的四类记录", isDeepStrictEqual(
      recordsMatching(await store(page), (year, number) => !isClearedMath(year, number)),
      recordsMatching(beforeClear, (year, number) => !isClearedMath(year, number))) &&
      emptyRecords(recordsMatching(await store(page), isClearedMath)));
    await goQuestion(page, b);
    const logicRetryIntact = await draftMatches(page, b, b.answer, true) && await navMatches(page, b.number, { 26: "retry", 55: "draft" });
    await selectQuestion(page, lastLogic);
    const logicDraftIntact = await draftMatches(page, lastLogic, wrong(lastLogic));
    await goQuestion(page, c);
    check("范围外逻辑普通草稿、逻辑重做和其他年份重做均可继续", logicRetryIntact && logicDraftIntact &&
      await draftMatches(page, c, c.answer, true) && await navMatches(page, c.number, { 1: "retry" }) && await solved(page) === 3);
    const beforeAllClear = await store(page);
    await goQuestion(page, b, "all");
    await practice(page).locator("#practice-clear").click();
    check("整卷范围清除该年所有四类记录，但不清除另一年份", emptyRecords(recordsMatching(await store(page), year => year === yearA)) &&
      isDeepStrictEqual(recordsMatching(await store(page), year => year === yearB), recordsMatching(beforeAllClear, year => year === yearB)) &&
      await solved(page) === 2);
    await openView(page, "mistakes");
    await filters(page, "all", "all", "all");
    await reload(page, "mistakes");
    check("清除后刷新不会重新迁移已删错题，列表和全局计数同步", await listMatches(page, [c, d]) &&
      await countsMatch(page, 2, 0) && emptyRecords(recordsMatching(await store(page), year => year === yearA)));
    await context.close();

    // Legacy fixture has attempts only: no new mistake/retry fields, drafts or practice position.
    const legacy = { attempts: {} };
    for (const q of [a, b, c, d]) {
      legacy.attempts[q.year] ||= {};
      legacy.attempts[q.year][q.number] = { selected: q === d ? q.answer : wrong(q), correct: q === d, attempts: q === a ? 2 : 1 };
    }
    const oldContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: storageState(legacy) });
    const oldPage = await oldContext.newPage();
    monitor(oldPage, "legacy");
    await oldPage.goto(url, { waitUntil: "domcontentloaded" });
    await ready(oldPage);
    await openView(oldPage, "mistakes");
    const migrated = await store(oldPage);
    check("旧版仅attempts记录自动迁移错误项，正确项不收录且原记录保留", await filtersMatch(oldPage) &&
      await listMatches(oldPage, [a, b, c]) && await countsMatch(oldPage, 3, 0) && await solved(oldPage) === 4 &&
      !hasEntry(migrated, "mistakes", d) && [a, b, c].every(q => entry(migrated, "mistakes", q)?.wrongCount >= 1) &&
      isDeepStrictEqual(migrated.attempts, legacy.attempts));
    await reload(oldPage, "mistakes");
    await reload(oldPage, "mistakes");
    check("旧记录连续刷新迁移幂等，不重复卡片、不累加wrongCount、不改attempt", await listMatches(oldPage, [a, b, c]) &&
      await countsMatch(oldPage, 3, 0) && isDeepStrictEqual((await store(oldPage)).mistakes, migrated.mistakes) &&
      isDeepStrictEqual((await store(oldPage)).attempts, legacy.attempts));
    await cardAction(oldPage, c, "view");
    check("迁移错题可跨年份查看旧选择与题库对应解析", await feedbackMatches(oldPage, c, wrong(c)) && await solved(oldPage) === 4);
    await openView(oldPage, "mistakes");
    await cardAction(oldPage, c, "retry");
    check("迁移错题重做同样隐藏旧答案且提交前保留旧attempt", await draftMatches(oldPage, c, null, true) &&
      isDeepStrictEqual(entry(await store(oldPage), "attempts", c), entry(legacy, "attempts", c)));
    await submit(oldPage, c.answer);
    await openView(oldPage, "mistakes");
    await filters(oldPage, "all", "all", "mastered");
    await reload(oldPage, "mistakes");
    check("旧错题订正后刷新保留已订正状态，不重新迁移且已完成题数不增", await listMatches(oldPage, [c]) &&
      await countsMatch(oldPage, 2, 1) && await solved(oldPage) === 4 && entry(await store(oldPage), "attempts", c)?.correct === true &&
      entry(await store(oldPage), "mistakes", c)?.wrongCount === entry(migrated, "mistakes", c).wrongCount &&
      isDeepStrictEqual(recordsMatching(await store(oldPage), (year, number) => year !== c.year || number !== c.number),
        recordsMatching(migrated, (year, number) => year !== c.year || number !== c.number)));
    await oldContext.close();

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1,
      storageState: storageState(legacy)
    });
    const mobilePage = await mobile.newPage();
    monitor(mobilePage, "mobile");
    await mobilePage.goto(url, { waitUntil: "domcontentloaded" });
    await ready(mobilePage);
    await openView(mobilePage, "mistakes");
    check("390px手机经菜单进入错题本，卡片和两类操作均在屏内且无横向溢出", await mobilePage.locator("#menu-toggle").isVisible() &&
      await listMatches(mobilePage, [a, b, c]) && await fitsWidth(card(mobilePage, c), 390) &&
      await fitsWidth(card(mobilePage, c).locator('button[data-mistake-action="view"]'), 390) &&
      await fitsWidth(card(mobilePage, c).locator('button[data-mistake-action="retry"]'), 390) && await noOverflow(mobilePage));
    await snapshot(mobilePage, "mistakes-mobile.png");
    await cardAction(mobilePage, c, "view");
    check("手机错题卡查看准确跳转年份题号并显示原解析", await feedbackMatches(mobilePage, c, wrong(c)) && await noOverflow(mobilePage));
    await openView(mobilePage, "mistakes");
    await cardAction(mobilePage, c, "retry");
    check("手机从卡片发起重做无预选和答案泄漏，旧attempt仍保留", await draftMatches(mobilePage, c, null, true) &&
      isDeepStrictEqual(entry(await store(mobilePage), "attempts", c), entry(legacy, "attempts", c)));
    await option(mobilePage, c.answer).click();
    await goQuestion(mobilePage, c, "all");
    await jumpQuestion(mobilePage, mobileLast);
    // Reopen for the screenshot even if navigation intentionally collapses the panel on mobile.
    await openNavigator(mobilePage);
    check("手机展开整卷55题面板后第55题可点击，题号同步且没有横向溢出", await rangeMatches(mobilePage, 1, 55) &&
      await navMatches(mobilePage, mobileLast.number, { 1: "retry", 26: "correct", 55: "unanswered" }) &&
      await draftMatches(mobilePage, mobileLast) && await fitsWidth(practice(mobilePage).locator('#question-navigator button[data-question-jump="55"]'), 390) &&
      await noOverflow(mobilePage));
    await snapshot(mobilePage, "navigation-mobile.png");
    await jumpQuestion(mobilePage, c);
    await reload(mobilePage, "practice");
    await waitQuestion(mobilePage, c);
    check("手机跳回重做题再刷新仍保留草稿、题号及重做导航状态", await draftMatches(mobilePage, c, c.answer, true) &&
      await navMatches(mobilePage, c.number, { 1: "retry", 26: "correct", 55: "unanswered" }) &&
      isDeepStrictEqual(entry(await store(mobilePage), "attempts", c), entry(legacy, "attempts", c)));
    await panel(mobilePage).locator("#submit-answer").click();
    await panel(mobilePage).locator("#question-feedback").waitFor();
    const mobileCorrectFeedback = await feedbackMatches(mobilePage, c, c.answer);
    await panel(mobilePage).locator("#question-feedback #open-mistakes").click();
    await mistakes(mobilePage).waitFor();
    const mobilePending = await listMatches(mobilePage, [a, b]);
    await filters(mobilePage, "all", "all", "mastered");
    const mobileMastered = await listMatches(mobilePage, [c]);
    await cardAction(mobilePage, c, "view");
    check("手机订正和返回错题本更新计数，已订正卡片仍可查看且不重复统计", mobileCorrectFeedback && mobilePending && mobileMastered &&
      await countsMatch(mobilePage, 2, 1) && await solved(mobilePage) === 4 && await feedbackMatches(mobilePage, c, c.answer) &&
      !hasEntry(await store(mobilePage), "retries", c) && !hasEntry(await store(mobilePage), "drafts", c) && await noOverflow(mobilePage));
    await mobile.close();

    assert.deepEqual(errors, [], "所有隔离context均不应出现未处理的JavaScript错误");
    passed.push("所有隔离context均无未处理的JavaScript错误");
    console.log(JSON.stringify({ passed: passed.length, checks: passed, pageErrors: errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
