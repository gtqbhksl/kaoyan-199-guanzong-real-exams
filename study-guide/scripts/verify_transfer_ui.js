// Verifies export/import of study records (attempts, drafts, mistakes, retries, activity, writing review).
// node study-guide/scripts/verify_transfer_ui.js
// Optional: PLAYWRIGHT_MODULE_PATH, CHROME_PATH, TEST_BASE_URL, UI_TEST_OUTPUT_DIR.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
const url = `${base}/study-guide/index.html#practice`;
const storeKey = "kaoyan199-study-guide-v1";
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/questions.json"), "utf8"));
const passed = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kaoyan-transfer-"));

const years = [...new Set(fixture.questions.map(q => q.year))].sort((a, b) => b - a);
const year = years[0];
function question(number) {
  const q = fixture.questions.find(item => item.year === year && item.number === number);
  assert.ok(q, `fixture 缺少 ${year}/${number}`);
  return q;
}
const q1 = question(1); // 答错 -> 自动错题
const q2 = question(2); // 答对
const q3 = question(3); // 手动收藏
const q4 = question(4); // 草稿未提交
const wrong = q => Object.keys(q.options).find(letter => letter !== q.answer);
const entry = (store, bucket, q) => store[bucket]?.[q.year]?.[q.number];

function check(label, value) {
  assert.ok(value, label);
  passed.push(label);
}
const practice = page => page.locator("#view-practice");
const panel = page => practice(page).locator("#question-panel");
const option = (page, letter) => panel(page).locator(`[data-option="${letter}"]`);
async function store(page) {
  return page.evaluate(name => JSON.parse(localStorage.getItem(name) || "{}"), storeKey);
}
async function ready(page) {
  await practice(page).locator(`#practice-year option[value="${year}"]`).waitFor({ state: "attached" });
}
async function goQuestion(page, q) {
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
async function openSettings(page) {
  await page.locator("#open-settings").click();
  await page.locator("#settings-dialog").waitFor();
}
async function exportTo(page, file) {
  await openSettings(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export-records").click()
  ]);
  await download.saveAs(file);
  await page.locator("#settings-dialog").evaluate(el => el.close());
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
async function importFile(page, file) {
  await openSettings(page);
  await page.locator("#import-file").setInputFiles(file);
  await page.waitForTimeout(400);
  const toast = (await page.locator("#toast").textContent()).trim();
  await page.locator("#settings-dialog").evaluate(el => el.close());
  return toast;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe"
  });
  const errors = [];
  try {
    // ---- Context A: build records and export ----
    const ctxA = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const a = await ctxA.newPage();
    a.on("pageerror", e => errors.push("A: " + e.message));
    await a.goto(url, { waitUntil: "domcontentloaded" });
    await ready(a);
    await goQuestion(a, q1); await submit(a, wrong(q1));
    await goQuestion(a, q2); await submit(a, q2.answer);
    await goQuestion(a, q3); await panel(a).locator("#bookmark-question").click(); await a.waitForTimeout(150);
    await goQuestion(a, q4); await option(a, "A").click(); await a.waitForTimeout(150);
    const exportPath = path.join(tmp, "records.json");
    const payload = await exportTo(a, exportPath);
    check("导出文件带 schema 与版本标记", payload.schema === "kaoyan199-study-records" && payload.version === 1 && typeof payload.exportedAt === "string");
    check("导出包含六类记录且不含设备设置",
      ["attempts", "drafts", "mistakes", "retries", "activity", "writingReview"].every(k => k in payload.records) &&
      !("settings" in payload.records));
    check("导出内容反映当前作答与错题",
      entry(payload.records, "attempts", q1)?.correct === false &&
      entry(payload.records, "attempts", q2)?.correct === true &&
      entry(payload.records, "mistakes", q1)?.wrongCount === 1 &&
      entry(payload.records, "mistakes", q3)?.source === "manual" &&
      entry(payload.records, "drafts", q4) === "A");
    const storeA = await store(a);
    await ctxA.close();

    // ---- Context B: fresh import ----
    const ctxB = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const b = await ctxB.newPage();
    b.on("pageerror", e => errors.push("B: " + e.message));
    await b.goto(url, { waitUntil: "domcontentloaded" });
    await ready(b);
    const toastB = await importFile(b, exportPath);
    const storeB = await store(b);
    check("导入提示合并成功", /导入完成/.test(toastB));
    check("导入还原作答、错题、收藏与草稿",
      entry(storeB, "attempts", q1)?.correct === false &&
      entry(storeB, "attempts", q2)?.correct === true &&
      entry(storeB, "mistakes", q1)?.wrongCount === 1 &&
      entry(storeB, "mistakes", q3)?.source === "manual" &&
      entry(storeB, "drafts", q4) === "A");
    check("导入后侧边栏错题计数同步", Number(await b.locator("#nav-mistakes-badge").textContent()) === 2);

    // ---- Re-import same file: idempotent ----
    await importFile(b, exportPath);
    const storeB2 = await store(b);
    check("重复导入不重复计数、不新增卡片",
      entry(storeB2, "mistakes", q1)?.wrongCount === 1 &&
      entry(storeB2, "attempts", q1)?.attempts === entry(storeB, "attempts", q1)?.attempts &&
      Number(await b.locator("#nav-mistakes-badge").textContent()) === 2);

    // ---- Conflict: local newer correct answer wins over older imported wrong ----
    await goQuestion(b, q1);
    // q1 already answered wrong; use retry to answer correctly and master it
    await b.locator("button[data-view='mistakes']").click();
    await b.locator("#view-mistakes").waitFor();
    await b.locator(`#mistakes-list article.mistake-card[data-number="${q1.number}"] [data-mistake-action="retry"]`).click();
    await b.waitForTimeout(200);
    await submit(b, q1.answer);
    const beforeConflict = await store(b);
    await importFile(b, exportPath); // older wrong attempt + pending mistake
    const afterConflict = await store(b);
    check("合并保留本地较新的答对记录与已订正状态",
      entry(afterConflict, "attempts", q1)?.correct === true &&
      entry(afterConflict, "attempts", q1)?.updatedAt === entry(beforeConflict, "attempts", q1)?.updatedAt &&
      entry(afterConflict, "mistakes", q1)?.mastered === true &&
      entry(afterConflict, "mistakes", q1)?.wrongCount === 1);

    // ---- Invalid files rejected without touching records ----
    const badSchema = path.join(tmp, "bad-schema.json");
    fs.writeFileSync(badSchema, JSON.stringify({ schema: "other", version: 1, records: {} }));
    const beforeBad = await store(b);
    const toastBad = await importFile(b, badSchema);
    const afterBad = await store(b);
    check("非本复习台备份被拒绝且记录不变", /导入失败/.test(toastBad) &&
      JSON.stringify(afterBad) === JSON.stringify(beforeBad));
    const badJson = path.join(tmp, "bad.json");
    fs.writeFileSync(badJson, "{ not json");
    const toastJson = await importFile(b, badJson);
    check("损坏 JSON 被拒绝", /导入失败/.test(toastJson));

    if (process.env.UI_TEST_OUTPUT_DIR) {
      await openSettings(b);
      await b.screenshot({ path: path.join(process.env.UI_TEST_OUTPUT_DIR, "transfer-settings.png") });
      await b.locator("#settings-dialog").evaluate(el => el.close());
    }
    console.log(JSON.stringify({ passed, pageErrors: errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ passed, error: error.message, pageErrors: errors }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
