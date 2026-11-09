// Verifies the three-page layout (真题训练 / 错题本 / 知识点速查) of the study guide.
// node study-guide/scripts/verify_structure_ui.js
// Optional: PLAYWRIGHT_MODULE_PATH, CHROME_PATH, TEST_BASE_URL, UI_TEST_OUTPUT_DIR.
// If screenshots are wanted, UI_TEST_OUTPUT_DIR should point to an existing directory.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
const url = `${base}/study-guide/index.html`;
const passed = [];

function check(label, value) {
  assert.ok(value, label);
  passed.push(label);
}
async function snapshot(page, name) {
  if (process.env.UI_TEST_OUTPUT_DIR) {
    await page.screenshot({ path: path.join(process.env.UI_TEST_OUTPUT_DIR, name), fullPage: true });
  }
}
async function openView(page, view) {
  const menu = page.locator("#menu-toggle");
  if (await menu.isVisible() && !(await page.locator("#sidebar").evaluate(el => el.classList.contains("is-open")))) {
    await menu.click();
  }
  await page.locator(`button[data-view="${view}"]`).click();
  await page.locator(`#view-${view}`).waitFor();
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
    await page.locator("#practice-year option").first().waitFor({ state: "attached" });

    const navLabels = await page.locator(".side-nav .nav-item > span:not(.nav-badge)").allTextContents();
    check("导航为数据看板、真题训练、错题本、知识点速查四项",
      JSON.stringify(navLabels) === JSON.stringify(["数据看板", "真题训练", "错题本", "知识点速查"]));
    check("首页不再保留今日计划与写作工坊",
      await page.locator("#view-today").count() === 0 && await page.locator("#view-writing").count() === 0);
    check("默认落地页是数据看板",
      await page.locator("#view-dashboard").evaluate(el => el.classList.contains("is-active")) &&
      await page.locator("#view-practice").evaluate(el => !el.classList.contains("is-active")));
    check("面包屑指向数据看板",
      (await page.locator("#breadcrumb-current").textContent()).trim() === "数据看板");
    check("侧边栏保留连续学习、倒计时与本周投入",
      await page.locator("#streak-days").isVisible() &&
      await page.locator("#countdown-days").isVisible() &&
      await page.locator("#week-hours").isVisible() &&
      await page.locator("#week-dots .week-dot").count() === 7);

    // 数据看板
    check("看板渲染四张统计卡与模块/年份/活跃/最近面板",
      await page.locator("#view-dashboard .dash-stat").count() === 4 &&
      await page.locator("#view-dashboard .dash-panel").count() === 4 &&
      await page.locator('#view-dashboard [data-dash="module"]').count() === 2 &&
      await page.locator('#view-dashboard [data-dash="year"]').count() === 18 &&
      await page.locator("#view-dashboard .dash-activity-day").count() === 7);
    await page.locator('#view-dashboard [data-dash="module"][data-module="logic"]').click();
    await page.locator("#view-practice").waitFor();
    check("看板模块卡跳转到对应模块训练",
      await page.locator("#practice-module").inputValue() === "logic");
    await page.locator('button[data-view="dashboard"]').click();
    await page.locator("#view-dashboard").waitFor();
    await page.locator('#view-dashboard [data-dash="year"]').first().click();
    await page.locator("#view-practice").waitFor();
    check("看板年份卡跳转到对应年份训练",
      await page.locator("#practice-year").inputValue() === "2026");
    await page.locator('button[data-view="dashboard"]').click();
    await page.locator("#view-dashboard").waitFor();

    // 知识点速查
    await openView(page, "skills");
    check("知识点速查页含写作方法与限时训练板块",
      (await page.locator("#view-skills h2").allTextContents()).includes("写作方法与限时训练"));
    check("写作限时器与配时表在速查页内",
      await page.locator("#writing-clock").isVisible() &&
      await page.locator("#writing-toggle").isVisible() &&
      await page.locator("#writing-reset").isVisible());
    check("写作自查清单渲染四项",
      await page.locator("#writing-review-list .review-check").count() === 4);
    check("写作重点网格渲染六条",
      await page.locator("#writing-skills-grid .module-row").count() === 6);
    check("速查页学科标签只保留数学与逻辑",
      JSON.stringify(await page.locator(".skills-tabs .skill-tab").allTextContents()) ===
      JSON.stringify(["数学基础", "逻辑推理"]));

    await page.locator("#writing-toggle").click();
    await page.waitForTimeout(1200);
    const clock = (await page.locator("#writing-clock").textContent()).trim();
    check("写作计时器可启动并走秒", clock !== "00:00" && /^\d{2}:\d{2}$/.test(clock));
    await page.locator("#writing-reset").click();
    check("写作计时器可重置", (await page.locator("#writing-clock").textContent()).trim() === "00:00");

    await page.locator(".skill-tab[data-skill-tab='logic']").click();
    check("切换逻辑标签后优先级地图更新",
      (await page.locator("#skill-content .skill-summary h3").textContent()).includes("逻辑推理"));

    await page.locator("#writing-skills-grid .module-row").first().click();
    await page.waitForTimeout(400);
    check("写作重点可跳到写作知识卡",
      (await page.locator("#knowledge-reader .reader-title-row h3").textContent()).includes("论证有效性分析"));

    // 写作题进入真题训练
    await openView(page, "skills");
    await page.locator("[data-practice-writing='2026']").click();
    await page.locator("#view-practice").waitFor();
    await page.waitForFunction(() => {
      const title = document.querySelector("#view-practice #question-panel .question-kicker strong");
      return title?.textContent.trim() === "2026 年 · 第 56 题";
    });
    check("读取原题直接打开 2026 年第 56 题",
      await page.locator("#practice-module").inputValue() === "writing" &&
      await page.locator("#practice-year").inputValue() === "2026");
    check("写作题不显示提交按钮，只给出参考立意",
      await page.locator("#submit-answer").count() === 0 &&
      await page.locator("#question-feedback .explanation").isVisible() &&
      (await page.locator("#question-feedback .feedback-status").textContent()).includes("参考立意"));
    check("写作题不计入客观题统计",
      (await page.locator("#solved-total").textContent()).trim() === "0");

    await page.locator("#practice-question").selectOption("57");
    await page.waitForFunction(() => {
      const title = document.querySelector("#view-practice #question-panel .question-kicker strong");
      return title?.textContent.trim() === "2026 年 · 第 57 题";
    });
    check("写作题可在 56、57 之间直接切换",
      await page.locator("#practice-question").inputValue() === "57");
    check("题号面板把写作题标为写作题",
      await page.locator("#question-grid [data-question-jump='56']").evaluate(el => el.classList.contains("is-writing")));

    // 错题本仍是独立页面
    await openView(page, "mistakes");
    check("错题本可独立打开且有筛选工具条",
      await page.locator(".mistakes-toolbar").isVisible() &&
      await page.locator("#mistakes-year option").count() > 1);

    await snapshot(page, "structure-desktop.png");

    // 窄屏
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const small = await mobile.newPage();
    small.on("pageerror", error => errors.push(error.message));
    await small.goto(url, { waitUntil: "domcontentloaded" });
    await small.locator("#practice-year option").first().waitFor({ state: "attached" });
    const overflow = await small.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    }));
    check("390px 窄屏无横向溢出", overflow.scroll <= overflow.client);
    await small.locator("#menu-toggle").click();
    await small.locator("button[data-view='skills']").click();
    await small.locator("#view-skills").waitFor();
    check("390px 窄屏可从菜单进入知识点速查",
      await small.locator("#writing-clock").isVisible());
    const mobileOverflow = await small.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    }));
    check("390px 速查页无横向溢出", mobileOverflow.scroll <= mobileOverflow.client);
    await snapshot(small, "structure-mobile.png");

    console.log(JSON.stringify({ passed, pageErrors: errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ passed, error: error.message, pageErrors: errors }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
