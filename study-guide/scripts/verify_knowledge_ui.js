// Verifies the knowledge quick-reference area of the study guide.
// node study-guide/scripts/verify_knowledge_ui.js
// Optional: PLAYWRIGHT_MODULE_PATH, CHROME_PATH, TEST_BASE_URL, UI_TEST_OUTPUT_DIR.
// The page is opened from the file system by default, so no local server is required.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

const root = path.resolve(__dirname, "..");
const base = process.env.TEST_BASE_URL;
const url = base
  ? `${base.replace(/\/+$/, "")}/study-guide/index.html#skills`
  : `file:///${path.join(root, "index.html").replace(/\\/g, "/")}#skills`;
const output = process.env.UI_TEST_OUTPUT_DIR || "";
const passed = [];

function check(label, value) {
  assert.ok(value, label);
  passed.push(label);
}
async function snapshot(page, name) {
  if (output) {
    await page.screenshot({ path: path.join(output, name), fullPage: true });
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe"
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(url);
    await page.waitForTimeout(2500);
    const desktop = {
      chapters: await page.locator(".knowledge-chapter-button").count(),
      cards: await page.locator(".knowledge-section").count(),
      meta: await page.locator("#knowledge-meta").textContent(),
      math: await page.locator("mjx-container").count(),
      width: await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      }))
    };
    check("知识库渲染出全部专题与知识卡", desktop.chapters === 12 && desktop.cards > 0);
    check("桌面端无横向溢出", desktop.width.scroll <= desktop.width.client);

    await page.locator('[data-knowledge-chapter="math-applications"]').last().click();
    desktop.clickedChapter = await page.locator(".reader-title-row h3").textContent();
    check("点击目录可切换知识卡", desktop.clickedChapter.includes("应用题建模"));
    await snapshot(page, "knowledge-desktop.png");

    await page.locator('[data-knowledge-level="ext"]').click();
    const extensions = await page.locator("#knowledge-meta").textContent();
    check("拓展筛选生效", /(\d+) 个专题 · (\d+) 张知识卡/.test(extensions));
    await page.locator('[data-knowledge-level="all"]').click();
    await page.locator("#knowledge-search").fill("等比");
    await page.waitForTimeout(200);
    const search = {
      meta: await page.locator("#knowledge-meta").textContent(),
      chapter: await page.locator(".reader-title-row h3").textContent()
    };
    check("关键词检索生效", search.meta.includes("等比"));

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(url);
    await mobile.waitForTimeout(1500);
    const mobileResult = {
      width: await mobile.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      })),
      cards: await mobile.locator(".knowledge-section").count()
    };
    check("390px 窄屏知识库正常渲染且无横向溢出",
      mobileResult.cards > 0 && mobileResult.width.scroll <= mobileResult.width.client);
    await snapshot(mobile, "knowledge-mobile.png");

    console.log(JSON.stringify({ passed, desktop, extensions, search, mobileResult, errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ passed, error: error.message, errors }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
