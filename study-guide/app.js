(() => {
  "use strict";

  const STORE_KEY = "kaoyan199-study-guide-v1";
  const DEFAULT_SETTINGS = { examDate: "2026-12-19", weeklyHours: 14 };
  // 原卷切片图路径模板：本地复习台指向 Markdown 题库，站点构建产物改写为站点内目录
  const IMAGE_PATH_TEMPLATE = "../199管综真题_Markdown题库/{year}年/images/{file}.png";
  const VIEW_NAMES = {
    practice: "真题训练",
    mistakes: "错题本",
    skills: "知识点速查"
  };
  const MODULE_CONFIG = {
    math: { label: "数学基础", first: 1, last: 25 },
    logic: { label: "逻辑推理", first: 26, last: 55 },
    all: { label: "完整客观题", first: 1, last: 55 },
    writing: { label: "综合写作", first: 56, last: 57 }
  };
  const SKILL_KNOWLEDGE = {
    math: [
      "math-applications",
      "math-equations",
      "math-geometry",
      "math-data",
      "math-sequences",
      "math-numbers"
    ],
    logic: [
      "logic-formal",
      "logic-argument",
      "logic-analysis",
      "logic-analysis",
      "logic-argument",
      "logic-analysis"
    ]
  };
  const WRITING_KNOWLEDGE = ["logic-writing"];

  const MATH_SKILLS = [
    {
      name: "应用题",
      count: "115 题",
      share: 100,
      detail: "工程、行程、利润、浓度、比例与集合模型。优先练公倍数赋值和份数法。"
    },
    {
      name: "代数与方程函数",
      count: "91 题",
      share: 79,
      detail: "二次方程根分布、韦达定理、均值不等式、余式定理与二次函数最值。"
    },
    {
      name: "几何学",
      count: "102 题",
      share: 89,
      detail: "平几 54、立几 20、解几 28。相似比平方、面积割补与垂径定理是高频抓手。"
    },
    {
      name: "数据分析",
      count: "50 题",
      share: 43,
      detail: "排列组合、古典概率、独立事件、伯努利概型，以及均值与方差。"
    },
    {
      name: "数列",
      count: "38 题",
      share: 33,
      detail: "等差等比通项与求和性质，递推、裂项、错位相减与分段求和。"
    },
    {
      name: "算术与实数",
      count: "54 题",
      share: 47,
      detail: "绝对值 38 题、整数 16 题。特别关注端点值、零值、奇偶和整除。"
    }
  ];

  const LOGIC_SKILLS = [
    {
      name: "形式逻辑",
      count: "183 题 · 33.9%",
      share: 68,
      detail: "假言、选言、直言、对当关系与三段论。目标：翻译正确，逆否熟练，不靠语感。"
    },
    {
      name: "论证逻辑",
      count: "239 题 · 44.3%",
      share: 89,
      detail: "支持 88、削弱 68、假设 25、解释 25、相似 26、评价 7。先找论证关系再判断力度。"
    },
    {
      name: "综合分析推理",
      count: "118 题 · 21.9%",
      share: 44,
      detail: "2018–2026 年增加到 74 题。每年通常出现 2–5 组大题组，表格建模与条件隔离最重要。"
    },
    {
      name: "题组与条件复用",
      count: "2026 年 5 组",
      share: 100,
      detail: "同一大题干下每题新增的假设必须隔离，不能把上一小题的推演结果带入下一小题。"
    },
    {
      name: "支持与排除他因",
      count: "后期支持 58 题",
      share: 65,
      detail: "支持题占比明显增加。有效路径通常是补足论据与结论之间的缺口，或排除竞争解释。"
    },
    {
      name: "考场速度控制",
      count: "180 分钟整卷",
      share: 55,
      detail: "单题先设 2–3 分钟上限。题组连续无推进时切到选项回代，最后统一猜答并标记。"
    }
  ];

  const WRITING_SKILLS = [
    {
      name: "论证有效性分析",
      count: "30 分 · 约 600 字",
      share: 86,
      detail: "只反驳材料推不出，不另起炉灶谈个人观点。优先找能反驳的论据到结论跳跃。"
    },
    {
      name: "论说文",
      count: "35 分 · 约 700 字",
      share: 100,
      detail: "审题先抓关系而非单个词。立意要能统领全文，分论点要逐层递进。"
    },
    {
      name: "缺陷识别",
      count: "4 个主体段",
      share: 57,
      detail: "以偏概全、偷换概念、强加因果、不当类比、忽略他因、非黑即白、自相矛盾。"
    },
    {
      name: "论证结构",
      count: "62–64 个写作解析切分",
      share: 72,
      detail: "先写观点和理由，再落实到实践条件。例证必须服务论点，不能堆砌案例。"
    },
    {
      name: "经管视野",
      count: "近年主要风向",
      share: 72,
      detail: "传承与创新、全局与实践、投资与投机、发散与收敛，都需要决策思维和辩证关系。"
    },
    {
      name: "卷面与配时",
      count: "55–65 分钟",
      share: 100,
      detail: "两篇作文必须完整写完。结构清晰、字迹稳定、删改有度，通常与内容得分同等重要。"
    }
  ];

  const FORMULAS = [
    {
      title: "条件充分性 · 选项判定",
      content: "A：仅 (1) 充分\nB：仅 (2) 充分\nC：(1)、(2) 联合后充分\nD：(1)、(2) 各自独立充分\nE：联合后仍不充分\n\n充分意味着条件能必然推出结论。找到一个反例即可判定不充分。"
    },
    {
      title: "绝对值 · 三角不等式",
      content: "||a| − |b|| ≤ |a ± b| ≤ |a| + |b|\n\n|x − a| + |x − b| 在 [a, b] 上取最小值 b − a。\n\n判定 |a + b| = |a| + |b| 时，检查 ab ≥ 0；遇到 0 不能漏掉。"
    },
    {
      title: "二次函数 · 区间最值",
      content: "顶点横坐标：x = −b / 2a。\n\n区间最值比较三类点：顶点（若在区间内）、左端点、右端点。\n\n根的分布同时检查 Δ、对称轴位置和区间端点函数值。"
    },
    {
      title: "等差与等比 · 核心性质",
      content: "等差：m + n = p + q ⇒ aₘ + aₙ = aₚ + a_q。\nS_(2n−1) = (2n−1)aₙ。\n\n等比：m + n = p + q ⇒ aₘaₙ = aₚa_q。\n求和前必须检查 q = 1 的特殊情况。"
    },
    {
      title: "相似与面积 · 几何割补",
      content: "相似比为 k 时，周长比为 k，面积比为 k²。\n\n同高三角形的面积比等于底边比。\n\n不规则阴影优先用“总面积 − 空白面积”或平移拼接。"
    },
    {
      title: "直线与圆 · 弦长",
      content: "圆心到直线距离：d = |Ax₀ + By₀ + C| / √(A² + B²)。\n\n弦长：L = 2√(r² − d²)。\n\n垂径定理构造直角三角形，比联立方程求判别式更快。"
    },
    {
      title: "概率与统计 · 常用公式",
      content: "相反事件：P(A) = 1 − P(Ā)。\n\nn 次独立试验恰好发生 k 次：C(n,k)pᵏ(1−p)ⁿ⁻ᵏ。\n\n若 yᵢ = axᵢ + b，则 ȳ = ax̄ + b，s_y² = a²s_x²。"
    },
    {
      title: "形式逻辑 · 假言命题",
      content: "如果 A 就 B：A → B。\n只有 B 才 A：A → B。\n除非 B，否则 A：¬B → A。\n\nA → B 与 ¬B → ¬A 等价。\n其矛盾命题是 A ∧ ¬B。"
    },
    {
      title: "分析推理 · 草稿区",
      content: "公共条件区：只写大题干推出的确定事实。\n小题演算区：每题新增假设单独放置，做完封存。\n\n先找确定项和最高频主体；条件互锁时立即尝试选项回代。"
    },
    {
      title: "论证题 · 力度与干扰",
      content: "削弱：因果倒置、另有他因、有因无果、切断联系。\n支持：建立联系、排除他因、补充因果机制。\n假设：取反后论证明显坍塌。\n\n区分直接作用于论题与只作用在边角事实上的选项。"
    },
    {
      title: "有效性分析 · 段落骨架",
      content: "指出：材料由 A 推出 B，存在【缺陷】。\n解释：因为存在条件 C，A 不必然导致 B。\n收束：因此该推论不能成立。\n\n四个主体段各解决一个主要缺陷，不必追求数量。"
    },
    {
      title: "论说文 · 五段布局",
      content: "第 1 段：引材料、亮中心论点。\n第 2–4 段：分论点 + 说理 + 例证，逐层递进。\n第 5 段：回扣材料，落到实践。\n\n中心论点只回答一个可证明的判断，避免写口号。"
    }
  ];

  const WRITING_REVIEW = [
    ["结构是否可扫读", "标题和每段首句直接显示判断与理由。"],
    ["缺陷是否是论证跳跃", "不只复述材料，而是解释为什么推不出。"],
    ["中心论点是否唯一", "每个分论点都服务同一判断，不各说各话。"],
    ["完成与卷面是否达标", "字数达到要求，删改少，字迹稳定。"]
  ];

  function parseStorage() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return typeof stored === "object" && stored ? stored : {};
    } catch {
      return {};
    }
  }

  const state = {
    view: "practice",
    skillTab: "math",
    knowledgeChapter: null,
    knowledgeLevel: "all",
    knowledgeQuery: "",
    data: null,
    store: {
      settings: DEFAULT_SETTINGS,
      attempts: {},
      drafts: {},
      mistakes: {},
      retries: {},
      writingReview: {},
      ...parseStorage(),
      settings: { ...DEFAULT_SETTINGS, ...parseStorage().settings }
    },
    question: null,
    selected: null,
    checked: false,
    practiceYear: 2026,
    practiceModule: "math",
    writingSeconds: 0,
    writingTimer: null,
    toastTimer: null
  };

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
    } catch {
      showToast("当前浏览器无法保存学习记录。");
    }
  }

  function localDateKey(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function parseLocalDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function daysUntil(dateString) {
    const today = parseLocalDate(localDateKey());
    const target = parseLocalDate(dateString);
    return Math.ceil((target - today) / 86400000);
  }

  function formatExamDate(value) {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(parseLocalDate(value));
  }

  function attemptFor(question) {
    return state.store.attempts?.[question.year]?.[question.number];
  }

  function draftFor(question) {
    return state.store.drafts?.[question.year]?.[question.number] || null;
  }

  function saveDraft(question, selected) {
    state.store.drafts ||= {};
    state.store.drafts[question.year] ||= {};
    state.store.drafts[question.year][question.number] = selected;
    save();
  }

  function mistakeFor(question) {
    return state.store.mistakes?.[question.year]?.[question.number];
  }

  function isRetrying(question) {
    return state.store.retries?.[question.year]?.[question.number] === true;
  }

  function mistakeQuestions() {
    return state.data.questions.filter((question) => question.number <= 55 && mistakeFor(question));
  }

  function isManualBookmark(question) {
    const mistake = mistakeFor(question);
    return Boolean(mistake && mistake.source === "manual" && !mistake.wrongCount);
  }

  function bookmarkMistake(question) {
    // 答对或尚未作答的题也可以手动收藏进错题本，便于回头复习。
    if (question.number > 55 || mistakeFor(question)) return false;
    state.store.mistakes ||= {};
    state.store.mistakes[question.year] ||= {};
    state.store.mistakes[question.year][question.number] = {
      wrongCount: 0,
      lastWrongAt: "",
      lastWrongSelected: null,
      mastered: false,
      source: "manual",
      addedAt: new Date().toISOString()
    };
    save();
    return true;
  }

  function unbookmarkMistake(question) {
    // 只允许移除纯手动收藏；一旦答错过就保留错题记录。
    if (!isManualBookmark(question)) return false;
    delete state.store.mistakes[question.year][question.number];
    save();
    return true;
  }

  function restoreMistakes() {
    // Import old wrong answers once; do not count page refreshes as new mistakes.
    state.store.mistakes ||= {};
    state.store.retries ||= {};
    for (const question of state.data.questions) {
      const attempt = attemptFor(question);
      if (question.number > 55 || !attempt || attempt.correct !== false || mistakeFor(question)) continue;
      state.store.mistakes[question.year] ||= {};
      state.store.mistakes[question.year][question.number] = {
        wrongCount: 1,
        lastWrongAt: attempt.updatedAt || "",
        lastWrongSelected: attempt.selected,
        mastered: false
      };
    }
    const filters = state.store.mistakeFilters || {};
    state.store.mistakeFilters = {
      year: state.data.meta.years.includes(Number(filters.year)) ? String(filters.year) : "all",
      module: Object.hasOwn(MODULE_CONFIG, filters.module) ? filters.module : "all",
      status: ["pending", "mastered", "all"].includes(filters.status) ? filters.status : "pending"
    };
    save();
  }

  function saveAttempt(question, selected) {
    const attempts = state.store.attempts;
    attempts[question.year] ||= {};
    const old = attempts[question.year][question.number];
    attempts[question.year][question.number] = {
      selected,
      correct: selected === question.answer,
      attempts: (old?.attempts || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    const mistake = mistakeFor(question);
    if (selected !== question.answer) {
      state.store.mistakes[question.year] ||= {};
      state.store.mistakes[question.year][question.number] = {
        ...mistake,
        wrongCount: (mistake?.wrongCount || 0) + 1,
        lastWrongAt: attempts[question.year][question.number].updatedAt,
        lastWrongSelected: selected,
        mastered: false,
        source: mistake?.source || "wrong"
      };
    } else if (mistake) {
      mistake.mastered = true;
    }
    if (state.store.retries?.[question.year]) {
      delete state.store.retries[question.year][question.number];
    }
    if (state.store.drafts?.[question.year]) {
      delete state.store.drafts[question.year][question.number];
    }
    state.store.activity ||= {};
    state.store.activity[localDateKey()] = {
      count: (state.store.activity[localDateKey()]?.count || 0) + 1
    };
    save();
  }

  function allAttempts() {
    return Object.values(state.store.attempts || {}).flatMap(Object.values);
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll(".view").forEach((element) => {
      element.classList.toggle("is-active", element.id === `view-${view}`);
    });
    document.querySelectorAll(".nav-item").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.view === view);
    });
    document.getElementById("breadcrumb-current").textContent = VIEW_NAMES[view];
    document.getElementById("sidebar").classList.remove("is-open");
    history.replaceState(null, "", `#${view}`);
    window.scrollTo({ top: 0, behavior: "instant" });
    if (view === "practice") {
      renderQuestion();
    }
    if (view === "mistakes") {
      renderMistakes();
    }
    if (view === "skills") {
      renderSkills();
      if (location.hash.startsWith("#knowledge=")) {
        const id = decodeURIComponent(location.hash.slice("#knowledge=".length));
        if (knowledgeData().chapters.some((chapter) => chapter.id === id)) {
          requestAnimationFrame(() => setKnowledgeChapter(id));
        }
      }
    }
  }

  function renderStats() {
    const attendance = state.store.activity || {};
    const now = parseLocalDate(localDateKey());
    let hours = 0;
    const weekdays = [];
    for (let offset = -6; offset <= 0; offset += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() + offset);
      const key = localDateKey(date);
      const day = attendance[key];
      hours += day ? Math.max(0.25, (day.count || 0) * 0.1) : 0;
      weekdays.push({
        key,
        active: Boolean(day),
        today: offset === 0,
        label: ["日", "一", "二", "三", "四", "五", "六"][date.getDay()]
      });
    }
    const target = Number(state.store.settings.weeklyHours) || 14;
    document.getElementById("week-hours").textContent = hours.toFixed(1);
    document.getElementById("week-track-fill").style.width = `${Math.min(100, hours / target * 100)}%`;
    document.getElementById("week-dots").innerHTML = weekdays.map((day) =>
      `<span class="week-dot${day.active ? " is-active" : ""}${day.today ? " is-today" : ""}"><i></i>${day.label}</span>`
    ).join("");

    let streak = 0;
    for (let offset = 0; offset < 400; offset += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - offset);
      if (attendance[localDateKey(date)]) {
        streak += 1;
      } else if (offset > 0) {
        break;
      }
    }
    document.getElementById("streak-days").textContent = streak;

    const attempts = allAttempts();
    const correct = attempts.filter((attempt) => attempt.correct).length;
    document.getElementById("solved-total").textContent = attempts.length;
    document.getElementById("accuracy-total").textContent =
      attempts.length ? `${Math.round(correct / attempts.length * 100)}%` : "—";
    renderMistakeCounts();
  }

  function renderMistakeCounts() {
    const mistakes = mistakeQuestions();
    const mastered = mistakes.filter((question) => mistakeFor(question).mastered).length;
    const pending = mistakes.length - mastered;
    document.getElementById("nav-mistakes-badge").textContent = pending;
    document.getElementById("mistakes-pending-total").textContent = pending;
    document.getElementById("mistakes-mastered-total").textContent = mastered;
  }

  function renderMistakes() {
    renderMistakeCounts();
    const filters = state.store.mistakeFilters;
    const yearSelect = document.getElementById("mistakes-year");
    yearSelect.innerHTML = '<option value="all">全部年份</option>' +
      [...state.data.meta.years].reverse().map((year) => `<option value="${year}">${year} 年</option>`).join("");
    yearSelect.value = filters.year;
    document.getElementById("mistakes-module").value = filters.module;
    document.getElementById("mistakes-status").value = filters.status;
    const config = MODULE_CONFIG[filters.module];
    const all = mistakeQuestions();
    const questions = all.filter((question) =>
      (filters.year === "all" || question.year === Number(filters.year)) &&
      question.number >= config.first && question.number <= config.last &&
      (filters.status === "all" || Boolean(mistakeFor(question).mastered) === (filters.status === "mastered"))
    ).sort((a, b) =>
      String(mistakeFor(b).lastWrongAt || mistakeFor(b).addedAt || "").localeCompare(String(mistakeFor(a).lastWrongAt || mistakeFor(a).addedAt || "")) ||
      b.year - a.year || a.number - b.number
    );
    document.getElementById("mistakes-summary").textContent =
      `当前筛选 ${questions.length} 题 · 累计收录 ${all.length} 题 · 按最近收录优先显示`;
    const list = document.getElementById("mistakes-list");
    list.innerHTML = questions.length ? questions.map((question) => {
      const mistake = mistakeFor(question);
      const preview = (question.shared ? `${question.shared}\n${question.stem}` : question.stem).replace(/\s+/g, " ");
      const origin = mistake.source === "manual"
        ? (mistake.wrongCount ? `手动收藏 · 累计答错 ${mistake.wrongCount} 次` : "手动收藏")
        : `累计答错 ${mistake.wrongCount} 次`;
      return `<article class="mistake-card" data-year="${question.year}" data-number="${question.number}">
        <div class="mistake-card-heading"><h2>${question.year} 年 · 第 ${question.number} 题</h2><span class="mistake-status ${mistake.mastered ? "is-mastered" : "is-pending"}">${mistake.mastered ? "已订正" : "待复习"}</span></div>
        <p class="mistake-meta">${escapeHTML(question.category)} · ${origin}${isRetrying(question) ? " · 重做中" : ""}</p>
        <p class="mistake-preview">${escapeHTML(preview.slice(0, 170))}${preview.length > 170 ? "…" : ""}</p>
        <div class="mistake-actions"><button type="button" class="secondary-button" data-mistake-action="view">查看题目与解析</button><button type="button" class="primary-button" data-mistake-action="retry">${isRetrying(question) ? "继续重新练习" : "重新练习"}</button>${isManualBookmark(question) ? '<button type="button" class="secondary-button" data-mistake-action="remove">移出错题本</button>' : ""}</div>
      </article>`;
    }).join("") : `<div class="empty-panel"><h2>${all.length ? "当前筛选下没有错题" : "还没有收录的错题"}</h2><p>${all.length ? "可以切换年份、模块或复习状态；已订正的题仍保留在错题本中。" : "在真题训练中提交答案，答错的客观题会自动出现在这里；答对或想重点复习的题也可以点“加入错题本”手动收藏。"}</p><button type="button" class="secondary-button" data-empty-practice>去真题训练</button></div>`;
    list.querySelector("[data-empty-practice]")?.addEventListener("click", () => setView("practice"));
    typeset(list);
  }

  function focusQuestion() {
    const panel = document.getElementById("question-panel");
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ block: "start", behavior: "instant" });
  }

  function openMistake(question, retry) {
    if (!mistakeFor(question)) return;
    if (retry) {
      if (!state.store.retries?.[question.year]?.[question.number] && state.store.drafts?.[question.year]) {
        delete state.store.drafts[question.year][question.number];
      }
      state.store.retries[question.year] ||= {};
      state.store.retries[question.year][question.number] = true;
    } else if (isRetrying(question)) {
      // Pause rather than discard a retry draft when reviewing the previous explanation.
      state.store.retries[question.year][question.number] = "paused";
    }
    state.practiceYear = question.year;
    state.practiceModule = question.number <= 25 ? "math" : "logic";
    state.question = question;
    save();
    renderPracticeOptions();
    setView("practice");
    focusQuestion();
  }

  function renderDate() {
    const days = daysUntil(state.store.settings.examDate);
    document.getElementById("countdown-days").textContent = Math.max(0, days);
    document.getElementById("exam-date-caption").textContent = `${formatExamDate(state.store.settings.examDate)}${days >= 0 ? "" : " · 考试日期已过"}`;
    document.getElementById("date-label").textContent = days >= 0 ? `距考试 ${days} 天` : "更新考试日期";
  }

  function moduleQuestions() {
    const config = MODULE_CONFIG[state.practiceModule];
    return state.data.questions.filter((question) =>
      question.year === state.practiceYear &&
      question.number >= config.first &&
      question.number <= config.last
    );
  }

  function findNextUnanswered() {
    const questions = moduleQuestions();
    return questions.find((question) => !attemptFor(question)) || questions[0] || null;
  }

  function setQuestion(question) {
    if (!question) {
      state.question = null;
      renderQuestion();
      return;
    }
    state.question = question;
    renderQuestion();
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderMarkdownText(value) {
    const safe = escapeHTML(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^【([^】]+)】/gm, '<strong style="color:var(--accent-dark)">【$1】</strong>')
      .replace(/^#+\s+(.+)$/gm, "<strong>$1</strong>")
      // Quoted material blocks (写作题题干) are shown as an indented excerpt.
      .replace(/(?:^&gt;[^\n]*\n?)+/gm, (block) => {
        const text = block.replace(/^&gt;\s?/gm, "").replace(/\n+$/, "");
        return `<div class="material-block">${text.replace(/\n/g, "<br>")}</div>`;
      });
    return safe.replace(/\n/g, "<br>");
  }

  function sanitizeFigure(source) {
    return String(source ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
      .replace(/(xlink:href|href)\s*=\s*"(?!#)[^"]*"/gi, '$1="#"');
  }

  function renderFigures(figures) {
    return (figures || [])
      .map((source) => sanitizeFigure(source).trim())
      .filter((svg) => svg.startsWith("<svg"))
      .map((svg) => `<figure class="question-figure">${svg}</figure>`)
      .join("");
  }

  function questionStatus(question) {
    if (question.number > 55) return { key: "writing", label: "写作题" };
    if (isRetrying(question)) return { key: "retry", label: "重做中" };
    const attempt = attemptFor(question);
    if (attempt) return attempt.correct ? { key: "correct", label: "答对" } : { key: "wrong", label: "答错" };
    return draftFor(question) ? { key: "draft", label: "待提交" } : { key: "unanswered", label: "未作答" };
  }

  function renderQuestionNavigation() {
    const questions = moduleQuestions();
    document.getElementById("practice-question").innerHTML = questions.map((question) =>
      `<option value="${question.number}">第 ${question.number} 题 · ${questionStatus(question).label}</option>`
    ).join("");
    document.getElementById("practice-question").value = String(state.question?.number || "");
    const grid = document.getElementById("question-grid");
    // Update existing buttons on selection so keyboard focus stays on the same cell.
    if (grid.dataset.scope !== `${state.practiceYear}-${state.practiceModule}`) {
      grid.dataset.scope = `${state.practiceYear}-${state.practiceModule}`;
      grid.innerHTML = questions.map((question) =>
        `<button type="button" data-question-jump="${question.number}" aria-controls="question-panel">${question.number}</button>`
      ).join("");
    }
    for (const question of questions) {
      const button = grid.querySelector(`[data-question-jump="${question.number}"]`);
      const status = questionStatus(question);
      button.className = `question-jump is-${status.key}`;
      button.setAttribute("aria-current", String(question.number === state.question?.number));
      button.setAttribute("aria-label", `第 ${question.number} 题 · ${status.label}`);
      button.title = `第 ${question.number} 题 · ${status.label}`;
    }
  }

  function renderQuestion() {
    if (!state.data) {
      return;
    }
    const panel = document.getElementById("question-panel");
    const questions = moduleQuestions();
    const question = state.question && questions.some((item) =>
      item.year === state.question.year && item.number === state.question.number
    ) ? state.question : findNextUnanswered();
    if (!question) {
      panel.innerHTML = '<div class="empty-panel">当前范围没有可用题目。</div>';
      return;
    }
    state.question = question;
    const attempt = attemptFor(question);
    const retrying = isRetrying(question);
    const isWriting = question.number > 55;
    const selected = isWriting ? null : retrying ? draftFor(question) : attempt?.selected || draftFor(question);
    const checked = !isWriting && Boolean(attempt) && !retrying;
    const mistake = mistakeFor(question);
    const bookmarkControl = isWriting ? "" : mistake
      ? (isManualBookmark(question)
        ? '<button type="button" class="text-button" id="unbookmark-question">移出错题本</button>'
        : '<span class="bookmarked-note">已在错题本</span>')
      : '<button type="button" class="text-button" id="bookmark-question">加入错题本</button>';
    state.selected = selected;
    state.checked = checked;
    state.store.practice = {
      year: state.practiceYear,
      module: state.practiceModule,
      number: question.number
    };
    save();
    const correct = selected === question.answer;
    const index = questions.findIndex((item) => item.number === question.number);
    const options = Object.entries(question.options || {}).map(([letter, text]) => {
      let stateClass = "";
      if (selected === letter) stateClass += " is-selected";
      if (checked && letter === question.answer) stateClass += " is-correct";
      if (checked && selected === letter && letter !== question.answer) stateClass += " is-incorrect";
      return `<button class="option-button${stateClass}" data-option="${letter}" ${checked ? "disabled" : ""} aria-pressed="${selected === letter}">
        <span class="option-letter">${letter}</span>
        <span>${renderMarkdownText(text)}</span>
      </button>`;
    }).join("");
    const imageName = String(question.image).split("/").pop().replace(/\.[^.]+$/, "");
    const imagePath = question.image
      ? IMAGE_PATH_TEMPLATE
        .replace("{year}", String(question.year))
        .replace("{file}", imageName)
      : null;
    const submittedCount = questions.filter(attemptFor).length;
    const suggestedMinutes = question.number <= 25 ? "2" : question.number <= 55 ? "2.5" : question.number === 56 ? "25–30" : "30–35";
    renderQuestionNavigation();
    panel.innerHTML = `
      <div class="question-meta">
        <div class="question-kicker"><strong>${question.year} 年 · 第 ${question.number} 题</strong><span class="category-chip">${question.category}</span></div>
        <span class="question-time"><svg class="icon"><use href="#icon-clock"></use></svg>建议 ${suggestedMinutes} 分钟</span>
      </div>
      <div class="question-divider"></div>
      ${retrying ? '<div class="retry-notice">正在重新练习 · 答案和解析已隐藏，提交前保留上次作答记录。<button type="button" class="secondary-button" id="cancel-retry">取消本次重做</button></div>' : ""}
      ${isWriting ? '<div class="writing-question-note"><svg class="icon" aria-hidden="true"><use href="#icon-pen"></use></svg><span>写作题不计入客观题作答与正确率统计，下方直接给出参考立意与评分要点。</span></div>' : ""}
      ${question.shared ? `<div class="group-stem">${renderMarkdownText(question.shared)}</div>` : ""}
      <div class="question-body">${renderMarkdownText(question.stem)}</div>
      ${renderFigures(question.figures)}
      ${imagePath ? `<button class="question-image-toggle" data-image-toggle>查看原卷版式 <svg class="icon"><use href="#icon-chevron-down"></use></svg></button><img class="question-image" src="${escapeHTML(imagePath)}" alt="${question.year} 年第 ${question.number} 题原卷切片" loading="lazy" />` : ""}
      ${options ? `<div class="option-list">${options}</div>` : ""}
      <div class="action-row">
        <div class="action-meta">
          <span class="question-index">${index + 1} / ${questions.length} · ${isWriting ? "写作题" : `已提交 ${submittedCount}`}</span>
          ${bookmarkControl}
        </div>
        <div class="action-group">
          <button type="button" class="secondary-button" data-question-nav="-1" ${index <= 0 ? "disabled" : ""} aria-label="上一题"><svg class="icon"><use href="#icon-arrow-left"></use></svg></button>
          ${isWriting ? "" : !checked ? `<button type="button" class="primary-button" id="submit-answer" aria-describedby="question-submit-status" ${selected ? "" : "disabled"}>提交本题并查看解析</button>` : `<button type="button" class="primary-button" id="view-explanation" aria-controls="question-feedback">查看本题解析</button>`}
          <button type="button" class="secondary-button" data-question-nav="1" ${index === questions.length - 1 ? "disabled" : ""} aria-label="下一题"><svg class="icon"><use href="#icon-arrow-right"></use></svg></button>
        </div>
      </div>
      <p class="question-submit-status" id="question-submit-status" role="status">${isWriting ? "写作题无客观选项，可对照原卷版式与参考立意自评。" : checked ? "本题已提交，作答和解析已保留。" : selected ? `已选 ${selected} · 待提交，仅提交当前题目。` : "请先选择一个选项。每题独立提交，无需完成整套试卷。"}</p>
      ${isWriting ? `<section class="feedback is-writing" id="question-feedback" tabindex="-1" aria-labelledby="question-explanation-title">
        <div class="feedback-status good">
          <svg class="icon"><use href="#icon-info"></use></svg>
          参考立意与评分要点
        </div>
        <div class="explanation"><h3 id="question-explanation-title">参考立意</h3>${renderMarkdownText(question.explanation || "本题暂无参考立意，请对照原卷评分标准。")}</div>
      </section>` : checked ? `<section class="feedback" id="question-feedback" tabindex="-1" aria-labelledby="question-explanation-title">
        <div class="feedback-status ${correct ? "good" : "bad"}">
          <svg class="icon"><use href="#icon-${correct ? "check" : "info"}"></use></svg>
          ${correct ? "回答正确" : "回答错误"} · 你的答案 ${selected} · 正确答案 ${question.answer}
        </div>
        ${mistake ? `<div class="mistake-feedback"><p>${mistake.mastered ? "本题已订正，仍保留在错题本中。" : mistake.source === "manual" ? "本题已收藏到错题本，可随时重新练习。" : "本题已自动收录到错题本，可稍后重新练习。"}</p><div class="mistake-actions"><button type="button" class="secondary-button" id="retry-question">重新练习本题</button><button type="button" class="secondary-button" id="open-mistakes">返回错题本</button></div></div>` : ""}
        <div class="explanation"><h3 id="question-explanation-title">本题解析</h3>${renderMarkdownText(question.explanation || "本题暂无详细解析，请对照原卷答案。")}</div>
      </section>` : ""}
    `;
    const focusExplanation = () => {
      const feedback = panel.querySelector("#question-feedback");
      feedback?.focus({ preventScroll: true });
      feedback?.scrollIntoView({ block: "start", behavior: "instant" });
    };
    panel.querySelectorAll("[data-option]").forEach((button) => {
      button.addEventListener("click", () => {
        if (attemptFor(question) && !isRetrying(question)) return;
        state.selected = button.dataset.option;
        saveDraft(question, state.selected);
        renderQuestionNavigation();
        // Keep the rendered math, image expansion and keyboard focus intact.
        panel.querySelectorAll("[data-option]").forEach((option) => {
          const active = option.dataset.option === state.selected;
          option.classList.toggle("is-selected", active);
          option.setAttribute("aria-pressed", String(active));
        });
        panel.querySelector("#submit-answer").disabled = false;
        panel.querySelector("#question-submit-status").textContent =
          `已选 ${state.selected} · 待提交，仅提交当前题目。`;
      });
    });
    panel.querySelector("#submit-answer")?.addEventListener("click", () => {
      const answer = draftFor(question);
      if (!answer || (attemptFor(question) && !isRetrying(question)) || !question.options?.[answer]) return;
      saveAttempt(question, answer);
      renderQuestion();
      renderStats();
      focusExplanation();
    });
    panel.querySelector("#view-explanation")?.addEventListener("click", focusExplanation);
    panel.querySelector("#retry-question")?.addEventListener("click", () => openMistake(question, true));
    panel.querySelector("#open-mistakes")?.addEventListener("click", () => setView("mistakes"));
    panel.querySelector("#bookmark-question")?.addEventListener("click", () => {
      if (!bookmarkMistake(question)) return;
      renderQuestion();
      renderMistakeCounts();
      showToast("已加入错题本，可在错题本中复习。");
    });
    panel.querySelector("#unbookmark-question")?.addEventListener("click", () => {
      if (!unbookmarkMistake(question)) return;
      renderQuestion();
      renderMistakeCounts();
      showToast("已移出错题本。");
    });
    panel.querySelector("#cancel-retry")?.addEventListener("click", () => {
      delete state.store.retries[question.year][question.number];
      if (state.store.drafts?.[question.year]) delete state.store.drafts[question.year][question.number];
      save();
      renderQuestion();
      focusExplanation();
    });
    panel.querySelectorAll("[data-question-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = questions[index + Number(button.dataset.questionNav)];
        if (next) setQuestion(next);
      });
    });
    panel.querySelector("[data-image-toggle]")?.addEventListener("click", () => {
      const image = panel.querySelector(".question-image");
      image.classList.toggle("is-visible");
    });
    typeset(panel);
  }

  function renderPracticeOptions() {
    const yearSelect = document.getElementById("practice-year");
    yearSelect.innerHTML = [...state.data.meta.years].reverse().map((year) =>
      `<option value="${year}" ${year === state.practiceYear ? "selected" : ""}>${year} 年</option>`
    ).join("");
    yearSelect.value = String(state.practiceYear);
    document.getElementById("practice-module").value = state.practiceModule;
  }

  function typeset(element) {
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([element]).catch(() => {});
    }
  }

  function renderSkills() {
    const config = {
      math: {
        title: "数学基础 · 用模型拿分",
        summary: "75 分，25 题。真题复习报告把应用题、几何、代数列为最高优先级模块。先练可迁移的建模动作，再压缩计算时间。",
        score: "25",
        scoreLabel: "题 / 75 分",
        modules: MATH_SKILLS
      },
      logic: {
        title: "逻辑推理 · 先形式化，再控时间",
        summary: "60 分，30 题。后期分析推理增长明显，论证逻辑仍占主体。核心防线是条件翻译、论证关系识别和题组隔离。",
        score: "30",
        scoreLabel: "题 / 60 分",
        modules: LOGIC_SKILLS
      }
    }[state.skillTab];
    document.querySelectorAll(".skill-tab").forEach((tab) => {
      const active = tab.dataset.skillTab === state.skillTab;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    const linkedChapters = SKILL_KNOWLEDGE[state.skillTab] || [];
    if (!linkedChapters.includes(state.knowledgeChapter)) {
      state.knowledgeChapter = linkedChapters[0] || null;
    }
    document.getElementById("skill-content").innerHTML = `
      <div class="skill-summary">
        <div><div class="eyebrow">PRIORITY MAP</div><h3>${config.title}</h3><p>${config.summary}</p></div>
        <div class="skill-score"><strong>${config.score}</strong><small>${config.scoreLabel}</small></div>
      </div>
      ${renderModuleGrid(config.modules, linkedChapters)}
    `;
    bindKnowledgeModuleLinks();
    renderKnowledgeBase();
    renderWritingSkills();
    renderWritingReview();
  }

  function renderModuleGrid(modules, linkedChapters) {
    return `<div class="module-grid">${modules.map((module, index) => `
      <button class="module-row" data-knowledge-chapter="${linkedChapters[index] || ""}">
        <div class="module-top"><strong>${module.name}</strong><span>${module.count}</span></div>
        <p>${module.detail}</p>
        <div class="module-bar"><span style="width:${module.share}%"></span></div>
      </button>
    `).join("")}</div>`;
  }

  function renderWritingSkills() {
    const grid = document.getElementById("writing-skills-grid");
    if (!grid) return;
    grid.innerHTML = WRITING_SKILLS.map((module, index) => `
      <button class="module-row" data-writing-chapter="${WRITING_KNOWLEDGE[index] || WRITING_KNOWLEDGE[0]}">
        <div class="module-top"><strong>${module.name}</strong><span>${module.count}</span></div>
        <p>${module.detail}</p>
        <div class="module-bar"><span style="width:${module.share}%"></span></div>
      </button>
    `).join("");
    grid.querySelectorAll("[data-writing-chapter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.knowledgeChapter = button.dataset.writingChapter;
        setKnowledgeChapter(button.dataset.writingChapter);
      });
    });
  }

  function renderFormulas() {
    document.getElementById("formula-grid").innerHTML = FORMULAS.map((formula) =>
      `<details class="formula-item">
        <summary>${formula.title}<svg class="icon"><use href="#icon-chevron-down"></use></svg></summary>
        <div class="formula-content">${formula.content.split("\n").map((line) => line ? `<p>${renderMarkdownText(line)}</p>` : "").join("")}</div>
      </details>`
    ).join("");
    typeset(document.getElementById("formula-grid"));
  }

  function knowledgeData() {
    const data = window.KAOYAN199_KNOWLEDGE;
    return Array.isArray(data?.chapters) ? data : { chapters: [], sources: {}, coverage: [] };
  }

  function knowledgeDomain(chapter) {
    return { math: "数学", logic: "逻辑", writing: "写作" }[chapter.domain] || "综合";
  }

  function knowledgeRole(section) {
    return section.level === "ext" ? "拓展" : "核心";
  }

  function knowledgeSearchText(chapter) {
    const sections = Array.isArray(chapter.sections) ? chapter.sections : [];
    const notes = Array.isArray(chapter.notes) ? chapter.notes : [];
    const searchable = [
      chapter.title,
      chapter.summary,
      ...notes.flatMap((note) => [note.label, ...note.lines]),
      ...sections.flatMap((section) => [section.title, ...section.lines])
    ].join("\n");
    return searchable
      .replace(/\$/g, "")
      .replace(/\\[a-zA-Z]+/g, " ")
      .replace(/[{}\\]/g, " ")
      .replace(/([a-zA-Z])([0-9])/g, "$1 $2")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function knowledgeQueryTerms(query) {
    return query.toLowerCase().split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}]+/gu, ""))
      .filter(Boolean);
  }

  function matchesKnowledgeChapter(chapter, query, level) {
    const terms = knowledgeQueryTerms(query);
    const sections = Array.isArray(chapter.sections) ? chapter.sections : [];
    const visibleSections = sections.filter((section) =>
      level === "all" || section.level === level
    );
    if (!visibleSections.length || !chapter.domain) return false;
    if (!terms.length) return true;
    const matchesInChapter = (candidate) => {
      const text = knowledgeSearchText(candidate);
      return terms.every((term) => text.includes(term));
    };
    return matchesInChapter({ ...chapter, sections: visibleSections });
  }

  function filteredKnowledgeChapters() {
    return knowledgeData().chapters.filter((chapter) =>
      matchesKnowledgeChapter(chapter, state.knowledgeQuery, state.knowledgeLevel)
    );
  }

  function bindKnowledgeModuleLinks() {
    document.querySelectorAll("[data-knowledge-chapter]").forEach((link) => {
      const id = link.dataset.knowledgeChapter;
      if (!id) return;
      link.addEventListener("click", () => {
        if (link.closest(".module-grid")) {
          state.knowledgeChapter = id;
        }
        setKnowledgeChapter(id);
      });
    });
    document.querySelectorAll(".knowledge-filter").forEach((button) => {
      button.addEventListener("click", () => {
        state.knowledgeLevel = button.dataset.knowledgeLevel;
        renderKnowledgeBase();
      });
    });
    const search = document.getElementById("knowledge-search");
    search.addEventListener("input", () => {
      state.knowledgeQuery = search.value.trim();
      renderKnowledgeBase();
    });
  }

  function renderKnowledgeTree(chapters) {
    const tree = document.getElementById("knowledge-tree");
    const domains = [
      { id: "math", title: "数学基础" },
      { id: "logic", title: "逻辑推理" },
      { id: "writing", title: "写作衔接" }
    ];
    const groups = domains.map((domain) => ({
      ...domain,
      chapters: chapters.filter((chapter) => chapter.domain === domain.id)
    })).filter((domain) => domain.chapters.length);
    tree.innerHTML = groups.length ? `
      <div class="knowledge-tree-heading">PDF · 知识目录</div>
      ${groups.map((group) => `
        <div class="knowledge-domain">
          <div class="knowledge-domain-title"><span>${group.title}</span><span>${group.chapters.length} 章</span></div>
          ${group.chapters.map((chapter) => `
            <button class="knowledge-chapter-button ${chapter.id === state.knowledgeChapter ? "is-active" : ""}"
              data-knowledge-chapter="${escapeHTML(chapter.id)}" aria-pressed="${chapter.id === state.knowledgeChapter}">
              ${escapeHTML(chapter.title)}
              <small>${chapter.sections.length} 个知识卡 · ${chapter.sections.filter((section) => section.level === "core").length} 核心</small>
            </button>
          `).join("")}
        </div>
      `).join("")}
    ` : '<div class="knowledge-tree-empty">没有匹配的专题。</div>';
    tree.querySelectorAll("[data-knowledge-chapter]").forEach((button) => {
      button.addEventListener("click", () => setKnowledgeChapter(button.dataset.knowledgeChapter));
    });
  }

  function setKnowledgeChapter(id, scroll = true) {
    state.knowledgeChapter = id;
    renderKnowledgeBase();
    if (scroll) {
      document.querySelector(".knowledge-layout").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderKnowledgeReader(chapter) {
    const reader = document.getElementById("knowledge-reader");
    if (!chapter) {
      const hasFilters = state.knowledgeQuery || state.knowledgeLevel !== "all";
      reader.innerHTML = `
        <div class="reader-empty">
          <strong>${hasFilters ? "没有匹配的知识卡" : "知识库暂无内容"}</strong>
          <p>${hasFilters ? "换一个关键词，或切回“全部”继续浏览。" : "请确认 knowledge-base.js 已随复习台一起加载。"}</p>
        </div>`;
      return;
    }
    const sections = chapter.sections.filter((section) =>
      state.knowledgeLevel === "all" || section.level === state.knowledgeLevel
    );
    const notes = (chapter.notes || []).map((note) => `
      <div class="knowledge-note-card ${note.type === "rule" ? "is-rule" : note.type === "tip" ? "is-tip" : ""}">
        <div class="note-label">${escapeHTML(note.label)}</div>
        ${note.lines.map((line) => `<p>${renderMarkdownText(line)}</p>`).join("")}
      </div>
    `).join("");
    const sourceData = knowledgeData().sources;
    const cards = sections.map((section, index) => {
      const refs = (section.refs || []).map(([key, page]) => {
        const source = sourceData[key] || { short: key };
        const location = page === "整册" ? source.short : `${source.short} p.${page}`;
        return `<span class="knowledge-source-ref ${section.level === "core" ? "is-core" : ""}">${escapeHTML(location)}</span>`;
      }).join("");
      return `
        <details class="knowledge-section" ${index === 0 ? "open" : ""}>
          <summary class="knowledge-section-head">
            <strong>${escapeHTML(section.title)}</strong>
            <span class="knowledge-section-tag ${section.level === "core" ? "is-core" : ""}">${knowledgeRole(section)}</span>
          </summary>
          <div class="knowledge-lines">
            ${section.lines.map((line) => `<p>${renderMarkdownText(line)}</p>`).join("")}
          </div>
          <div class="knowledge-sources-link">${refs}</div>
        </details>`;
    }).join("");
    reader.innerHTML = `
      <div class="reader-breadcrumb">知识点速查 / ${knowledgeDomain(chapter)} / ${escapeHTML(chapter.title)}</div>
      <div class="reader-title-row">
        <div><h3>${escapeHTML(chapter.title)}</h3><p>${renderMarkdownText(chapter.summary)}</p></div>
        <div class="reader-section-count">${sections.length}<small>知识卡</small></div>
      </div>
      ${state.knowledgeLevel === "ext" ? "" : `<div class="knowledge-roles">
        <span class="knowledge-role is-exam">核心 · 必会</span>
        <span class="knowledge-role">拓展 · 识别与补缺</span>
        <span class="knowledge-role is-tip">页码均指向项目内 PDF</span>
      </div>`}
      ${notes ? `<div class="knowledge-notes">${notes}</div>` : ""}
      <div class="knowledge-sections">${cards}</div>
    `;
    bindKnowledgeModuleLinks();
    typeset(reader);
  }

  function renderKnowledgeSources() {
    const data = knowledgeData();
    const files = Object.entries(data.sources || {}).map(([key, source]) => `
      <div class="knowledge-source-file">
        <strong>${escapeHTML(source.file)}</strong>
        <small>共 ${escapeHTML(source.pages)} 页 · 编号 ${escapeHTML(key)}</small>
      </div>
    `).join("");
    const coverage = (data.coverage || []).map((item) =>
      `${item.domain}：PDF 第 ${item.from}–${item.to} 页，${item.label}。`
    ).join("<br>");
    const sectionCount = (data.chapters || []).reduce((sum, chapter) => sum + chapter.sections.length, 0);
    document.getElementById("knowledge-sources").innerHTML = `
      <p>本知识库根据项目根目录的 5 份 PDF 重新编排为可筛选的学习卡，共 ${(data.chapters || []).length} 个专题、${sectionCount} 张知识卡。公式与规则按考试口径整理，并保留原始页码以便回查；未收录应试规划、例题堆叠和链接建议。</p>
      <p><strong>资料分工：</strong>知识地图用于考法与入口，陈剑手册与小册子用于定义、公式和常用模型，逻辑公式 PDF 用于命题翻译、论证模型与分析推理。完整版一本通在本次读取中无可提取文本，因此没有直接引用它的版面文字。</p>
      <p><strong>覆盖范围：</strong>数学核心公式与典型模型、条件充分性判断；形式逻辑 1–6 节、论证逻辑 7–14 节、分析推理 15–17 节，以及论证有效性分析的常见缺陷。</p>
      ${coverage ? `<p>${coverage}</p>` : ""}
      <div class="knowledge-source-list">${files}</div>
    `;
  }

  function renderKnowledgeBase() {
    const chapters = filteredKnowledgeChapters();
    if (chapters.length && !chapters.some((chapter) => chapter.id === state.knowledgeChapter)) {
      state.knowledgeChapter = chapters[0].id;
    }
    const current = chapters.find((chapter) => chapter.id === state.knowledgeChapter) || null;
    renderKnowledgeTree(chapters);
    renderKnowledgeReader(current);
    document.querySelectorAll("[data-knowledge-level]").forEach((button) => {
      const active = button.dataset.knowledgeLevel === state.knowledgeLevel;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const sectionCount = chapters.reduce((sum, chapter) => sum +
      chapter.sections.filter((section) => state.knowledgeLevel === "all" || section.level === state.knowledgeLevel).length,
    0);
    document.getElementById("knowledge-meta").textContent =
      `${chapters.length} 个专题 · ${sectionCount} 张知识卡${state.knowledgeQuery.trim() ? ` · 搜索“${state.knowledgeQuery.trim()}”` : ""}`;
    renderKnowledgeSources();
  }

  function renderWritingReview() {
    const review = state.store.writingReview?.[localDateKey()] || {};
    document.getElementById("writing-review-list").innerHTML = WRITING_REVIEW.map(([title, text], index) => `
      <label class="review-check"><input type="checkbox" data-review-index="${index}" ${review[index] ? "checked" : ""} />
        <span><strong>${title}</strong><small>${text}</small></span>
      </label>
    `).join("");
    document.querySelectorAll("[data-review-index]").forEach((input) => {
      input.addEventListener("change", () => {
        state.store.writingReview ||= {};
        state.store.writingReview[localDateKey()] ||= {};
        state.store.writingReview[localDateKey()][input.dataset.reviewIndex] = input.checked;
        save();
      });
    });
  }

  function updateWritingClock() {
    const minutes = String(Math.floor(state.writingSeconds / 60)).padStart(2, "0");
    const seconds = String(state.writingSeconds % 60).padStart(2, "0");
    document.getElementById("writing-clock").textContent = `${minutes}:${seconds}`;
  }

  function toggleWritingTimer() {
    if (state.writingTimer) {
      clearInterval(state.writingTimer);
      state.writingTimer = null;
      document.getElementById("writing-toggle").textContent = "继续";
      return;
    }
    document.getElementById("writing-toggle").textContent = "暂停";
    state.writingTimer = setInterval(() => {
      state.writingSeconds += 1;
      updateWritingClock();
    }, 1000);
  }

  function resetWritingTimer() {
    clearInterval(state.writingTimer);
    state.writingTimer = null;
    state.writingSeconds = 0;
    document.getElementById("writing-toggle").textContent = "开始";
    updateWritingClock();
  }

  function openSettings() {
    document.getElementById("exam-date-input").value = state.store.settings.examDate;
    document.getElementById("weekly-hours-input").value = state.store.settings.weeklyHours;
    document.getElementById("settings-dialog").showModal();
  }

  function openNotes(title, html) {
    document.getElementById("notes-title").textContent = title;
    document.getElementById("notes-content").innerHTML = html;
    document.getElementById("notes-dialog").showModal();
  }

  function openSourceNotes(year = null) {
    if (year) {
      const notes = state.data.meta.answer_notes[String(year)] || [];
      const source = state.data.meta.source_titles[String(year)];
      openNotes(`${year} 年解析来源`, `
        <p>${escapeHTML(source.answer)}</p>
        ${notes.length ? notes.map((note) => `<p><strong>${escapeHTML(note.label)}：</strong>${escapeHTML(note.text)}</p>`).join("") : "<p>该年解析来自项目已校核的 Markdown 答案库。</p>"}
        <p>本页面从项目题库动态读取题干、选项、答案与解析，未自行改写题目。需要核对原卷时，可在题目下展开“查看原卷版式”。</p>
      `);
      return;
    }
    const meta = state.data.meta;
    const reportSections = meta.cross_check.report_sections.slice(0, 7)
      .map((section) => `<li>${escapeHTML(section)}</li>`).join("");
    openNotes("复习优先级的数据依据", `
      <p>页面中的 1026 道题直接来自本项目的 Markdown 真题与答案解析库。复习优先级、题型趋势与考试配时来自项目中的《考点考频、演进趋势与高分实战技巧报告》和《全景复习指南》。</p>
      <p><strong>数据范围：</strong>2009–2026 年，每年 57 题，共 ${meta.question_count} 题；数学 450 题、逻辑 540 题、写作 36 篇，与项目报告的样本口径一致。</p>
      <p><strong>报告原文章节：</strong></p><ul>${reportSections}</ul>
      <p>按项目说明，多数年份的解析经过原 PDF 对照校核；少数补充与修订已在对应年份的来源说明中标出。学习页面不把项目报告的统计结果解释为新的考试预测。</p>
    `);
  }

  function bindEvents() {
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", () => setView(item.dataset.view));
    });
    document.querySelectorAll("[data-view-link]").forEach((item) => {
      item.addEventListener("click", () => setView(item.dataset.viewLink));
    });
    document.getElementById("menu-toggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("is-open");
    });
    document.getElementById("date-chip").addEventListener("click", openSettings);
    document.getElementById("open-settings").addEventListener("click", openSettings);
    document.getElementById("open-help").addEventListener("click", () => openNotes("如何使用复习台", `
      <p>复习台分三页：真题训练、错题本、知识点速查。作答记录只保存在当前浏览器。</p>
      <ul>
        <li>真题训练支持数学、逻辑、整卷客观题和综合写作，记录保存在当前浏览器。</li>
        <li>每题选择选项后，点击“提交本题并查看解析”即可查看对错与解析，无需交整卷。</li>
        <li>未提交的选择和已提交的结果均逐题保存，切题或刷新后可继续；已提交题可点击“查看本题解析”回看。</li>
        <li>选择年份和模块后，可用“直接定位题目”或展开题号面板跳到任意题；颜色和文字标明作答状态。</li>
        <li>答错自动进入错题本，可按年份、模块、复习状态筛选；重新练习会隐藏答案，答对后归入已订正。</li>
        <li>答对或想重点复习的题，可在题目下方点“加入错题本”手动收藏；纯手动收藏可随时移出，答错过则保留记录。</li>
        <li>错题本也会收录旧作答中的错题；清除训练范围作答会同步清除该范围错题及订正记录。</li>
        <li>知识点速查可按“核心 / 拓展”与专题、公式、规则关键词筛选，知识卡附 PDF 页码。</li>
        <li>写作方法、限时配时和全文自查清单在知识点速查页，不替你编写范文。</li>
      </ul>
    `));
    document.getElementById("settings-form").addEventListener("submit", (event) => {
      if (event.submitter?.value !== "save") return;
      event.preventDefault();
      const examDate = document.getElementById("exam-date-input").value;
      const weeklyHours = Number(document.getElementById("weekly-hours-input").value);
      if (!examDate || !weeklyHours || weeklyHours < 1) return;
      state.store.settings = { examDate, weeklyHours };
      save();
      renderDate();
      renderStats();
      document.getElementById("settings-dialog").close();
      showToast("学习设置已保存。");
    });
    document.getElementById("notes-close").addEventListener("click", () => {
      document.getElementById("notes-dialog").close();
    });
    document.getElementById("view-bank-summary").addEventListener("click", () => openSourceNotes());
    document.getElementById("practice-question").addEventListener("change", (event) => {
      const question = moduleQuestions().find((item) => item.number === Number(event.target.value));
      if (question) {
        setQuestion(question);
        focusQuestion();
      }
    });
    document.getElementById("question-grid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-question-jump]");
      if (!button) return;
      const question = moduleQuestions().find((item) => item.number === Number(button.dataset.questionJump));
      if (question) {
        setQuestion(question);
        focusQuestion();
      }
    });
    for (const filter of ["year", "module", "status"]) {
      document.getElementById(`mistakes-${filter}`).addEventListener("change", (event) => {
        state.store.mistakeFilters[filter] = event.target.value;
        save();
        renderMistakes();
      });
    }
    document.getElementById("mistakes-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-mistake-action]");
      if (!button) return;
      const card = button.closest(".mistake-card");
      const question = state.data.questions.find((item) =>
        item.year === Number(card.dataset.year) && item.number === Number(card.dataset.number)
      );
      if (!question) return;
      if (button.dataset.mistakeAction === "remove") {
        if (unbookmarkMistake(question)) {
          renderMistakes();
          showToast("已移出错题本。");
        }
        return;
      }
      openMistake(question, button.dataset.mistakeAction === "retry");
    });
    document.getElementById("practice-module").addEventListener("change", (event) => {
      state.practiceModule = event.target.value;
      state.question = null;
      state.selected = null;
      state.checked = false;
      setQuestion(findNextUnanswered());
    });
    document.getElementById("practice-year").addEventListener("change", (event) => {
      state.practiceYear = Number(event.target.value);
      state.question = null;
      state.selected = null;
      state.checked = false;
      setQuestion(findNextUnanswered());
    });
    document.getElementById("practice-clear").addEventListener("click", () => {
      const questions = moduleQuestions();
      for (const question of questions) {
        if (state.store.attempts?.[question.year]) {
          delete state.store.attempts[question.year][question.number];
        }
        if (state.store.drafts?.[question.year]) {
          delete state.store.drafts[question.year][question.number];
        }
        if (state.store.mistakes?.[question.year]) {
          delete state.store.mistakes[question.year][question.number];
        }
        if (state.store.retries?.[question.year]) {
          delete state.store.retries[question.year][question.number];
        }
      }
      save();
      state.question = null;
      state.selected = null;
      state.checked = false;
      setQuestion(findNextUnanswered());
      renderStats();
      showToast("当前范围的作答、错题及订正记录已清除。");
    });
    document.querySelectorAll(".skill-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.skillTab = tab.dataset.skillTab;
        state.knowledgeChapter = null;
        renderSkills();
      });
    });
    document.getElementById("writing-toggle").addEventListener("click", toggleWritingTimer);
    document.getElementById("writing-reset").addEventListener("click", resetWritingTimer);
    document.getElementById("writing-start").addEventListener("click", () => {
      document.querySelector(".runtime-card").scrollIntoView({ behavior: "smooth", block: "center" });
      if (!state.writingTimer) toggleWritingTimer();
    });
    document.querySelectorAll("[data-practice-writing]").forEach((button) => {
      button.addEventListener("click", () => {
        const year = Number(button.dataset.practiceWriting);
        state.practiceYear = year;
        state.practiceModule = "writing";
        state.question = state.data.questions.find((question) =>
          question.year === year && question.number === 56
        ) || state.data.questions.find((question) => question.year === year && question.number === 57);
        state.selected = null;
        state.checked = false;
        renderPracticeOptions();
        setView("practice");
        setQuestion(state.question);
        focusQuestion();
      });
    });
  }

  async function init() {
    try {
      state.data = window.KAOYAN199_DATA;
      if (!state.data?.questions?.length) {
        throw new Error("Question data bundle is unavailable");
      }
      const hashView = location.hash.replace("#", "");
      if (VIEW_NAMES[hashView]) state.view = hashView;
      const savedPractice = state.store.practice;
      if (savedPractice && state.data.meta.years.includes(savedPractice.year) &&
          Object.hasOwn(MODULE_CONFIG, savedPractice.module)) {
        state.practiceYear = savedPractice.year;
        state.practiceModule = savedPractice.module;
        state.question = moduleQuestions().find((question) =>
          question.number === savedPractice.number
        ) || null;
      }
      restoreMistakes();
      bindEvents();
      renderDate();
      renderStats();
      renderPracticeOptions();
      renderSkills();
      renderFormulas();
      renderWritingReview();
      if (state.view === "practice") {
        setQuestion(state.question || findNextUnanswered());
      }
      setView(state.view);
    } catch (error) {
      document.getElementById("question-panel").innerHTML =
        '<div class="empty-panel">题库读取失败。请运行 <code>python study-guide/build_data.py</code> 重新生成数据。</div>';
      console.error("Unable to load question data", error);
    }
  }

  init();
})();
