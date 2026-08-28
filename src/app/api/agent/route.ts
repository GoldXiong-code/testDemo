import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTemplateByCategory, renderTemplate, getDefaultTemplateData } from "@/lib/templates";
import { produceReactProject } from "@/lib/reactgen";
import { validateGeneratedHtml } from "@/lib/builder";

// 密钥只从环境变量读取（.env 文件，已在 .gitignore 中），禁止硬编码
const API_KEY = process.env.DASHSCOPE_API_KEY || "";
const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MODEL = "qwen3.8-max";

// 统一的 LLM 请求：遇到 429/5xx 等瞬时错误自动重试一次，避免直接报错给用户
async function llmFetch(body: Record<string, unknown>): Promise<Response> {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;
    console.warn(`[llm] HTTP ${res.status}${attempt === 0 ? "，3 秒后自动重试" : "，重试仍未成功"}`);
    if (attempt === 0) await new Promise((r) => setTimeout(r, 3000));
  }
  return res!;
}

async function callLLM(messages: { role: string; content: string }[], options?: { max_tokens?: number; temperature?: number }) {
  const res = await llmFetch({
    model: MODEL,
    messages,
    max_tokens: options?.max_tokens ?? 2048,
    temperature: options?.temperature ?? 0.7,
  });
  try {
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

// 流式调用 LLM（边生成边输出 chunk，用于展示 AI 思考过程）
// enableThinking: false 可关闭深度思考（节省 token 预算、加快长代码生成）
async function callLLMStreaming(
  messages: { role: string; content: string }[],
  options: { max_tokens?: number; temperature?: number; enableThinking?: boolean } | undefined,
  onChunk: (text: string) => void
): Promise<string> {
  const res = await llmFetch({
    model: MODEL,
    messages,
    max_tokens: options?.max_tokens ?? 4096,
    temperature: options?.temperature ?? 0.5,
    stream: true,
    ...(options?.enableThinking === false ? { enable_thinking: false } : {}),
  });

  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch { /* ignore */ }
    }
  }
  return full;
}

// 从 AI 输出中提取纯 HTML 代码（去除 markdown 包裹、多余文字）
function extractHtml(code: string): string {
  if (!code || !code.trim()) return code;

  let cleaned = code.trim();

  // 1. 去掉 markdown 代码块标记: ```html ... ``` 或 ``` ... ```
  cleaned = cleaned.replace(/^```[\s\S]*?\n/, "");
  cleaned = cleaned.replace(/\n```\s*$/, "");

  // 2. 尝试提取完整 HTML：从 <!DOCTYPE html> 到 </html>
  const doctypeMatch = cleaned.match(/<!DOCTYPE\s+html[^>]*>/i);
  const endHtmlMatch = cleaned.match(/<\/html>\s*$/i);
  if (doctypeMatch && endHtmlMatch) {
    return cleaned.substring(doctypeMatch.index!);
  }

  // 3. 如果没有 DOCTYPE，尝试从 <html 到 </html>
  const htmlStart = cleaned.match(/<html[\s>]/i);
  const htmlEnd = cleaned.match(/<\/html>/i);
  if (htmlStart && htmlEnd && htmlEnd.index! > htmlStart.index!) {
    return cleaned.substring(htmlStart.index!, htmlEnd.index! + 7);
  }

  // 4. 如果没有完整 html 标签，尝试找 <body> 或第一个可见标签
  const bodyMatch = cleaned.match(/<(?:body|div|section|main|header)[\s>]/i);
  if (bodyMatch && htmlEnd) {
    return cleaned.substring(bodyMatch.index!);
  }

  // 5. 如果找到 </html> 但开头没有标准标签，从开头到 </html>
  if (htmlEnd) {
    return cleaned.substring(0, htmlEnd.index! + 7);
  }

  // 6. 兜底：返回原始内容
  return cleaned;
}

/**
 * 安全过滤：检测并移除可能包含父 App 结构的代码
 * 防止 LLM 生成嵌套了父应用 UI 的 HTML
 */
function sanitizeGeneratedHtml(html: string): string {
  // 父 App 的特征字符串列表（一旦出现说明 LLM 把父 App 代码混进去了）
  const parentAppSignatures = [
    "应用查看器",
    "编辑器",
    "Atoms云",
    "Alex 正在构建",
    "请 Alex 构建",
    "h-screen flex flex-col",
    "flex-1 flex overflow-hidden",
    "w-1/2 flex flex-col border-r",
    "atoms_project_",
    "setActiveView",
    "setPreviewDevice",
    "expandedFolders",
    "WorkflowSteps",
    "PlanPanel",
    "ChatMessage",
    "handlePlanApprove",
    "handleSend",
    "previewCode",
    "srcDoc={previewCode}",
    "应用预览将在这里显示",
    "AI 生成的应用将在这里实时展示",
    "应用查看器",
    "请审阅这些功能描述",
    "请从下方推荐的",
    "atoms-demo.app/preview",
  ];

  let result = html;
  for (const sig of parentAppSignatures) {
    if (result.includes(sig)) {
      // 如果检测到父 App 特征，尝试清理：只保留 <!DOCTYPE> 到 </html> 的第一段
      const doctypeMatch = result.match(/<!DOCTYPE\s+html/i);
      const htmlMatch = result.match(/<html[\s>]/i);
      const closeHtml = result.match(/<\/html>/i);

      if (doctypeMatch && closeHtml && closeHtml.index! > (doctypeMatch.index || 0)) {
        result = result.substring(doctypeMatch.index || 0, closeHtml.index! + 7);
        // 清理后仍然包含特征，说明整个生成都是错的，返回安全占位
        for (const sig2 of parentAppSignatures) {
          if (result.includes(sig2)) {
            return generateSafePlaceholder();
          }
        }
        return result;
      }

      if (htmlMatch && closeHtml && closeHtml.index! > (htmlMatch.index || 0)) {
        result = result.substring(htmlMatch.index || 0, closeHtml.index! + 7);
        for (const sig2 of parentAppSignatures) {
          if (result.includes(sig2)) {
            return generateSafePlaceholder();
          }
        }
        return result;
      }

      // 无法安全清理，返回占位
      return generateSafePlaceholder();
    }
  }
  return result;
}

/**
 * 生成安全占位 HTML（当检测到生成的代码包含父 App 结构时使用）
 */
function generateSafePlaceholder(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>应用预览</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #0f0f1a;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    color: #fff;
  }
  .container {
    text-align: center;
    padding: 3rem;
  }
  .icon {
    width: 80px; height: 80px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 1.5rem;
    font-size: 2rem;
  }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  p { color: #8b8b9e; font-size: 0.9rem; }
  .retry {
    margin-top: 1.5rem;
    padding: 0.6rem 1.5rem;
    background: #6366f1;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 0.9rem;
    cursor: pointer;
  }
</style>
</head>
<body>
<div class="container">
  <div class="icon">🔄</div>
  <h1>生成结果异常</h1>
  <p>AI 生成的代码格式不正确，请尝试重新生成</p>
</div>
</body>
</html>`;
}

// 4 个分类（展示类、AI 应用、内容社区暂不开放）
const BASE_CATEGORIES = [
  { key: "tool", label: "工具类", icon: "" },
  { key: "dashboard", label: "数据看板", icon: "📊" },
  { key: "ecommerce", label: "电商类", icon: "" },
  { key: "game", label: "小游戏", icon: "🎮" },
];

// 每次随机变化分类描述方式
const CATEGORY_PRESENTATIONS = [
  // 方式1：按功能描述
  () => BASE_CATEGORIES.map((c) => ({ ...c, desc: getDescByFunction(c.key) })),
  // 方式2：按场景描述
  () => BASE_CATEGORIES.map((c) => ({ ...c, desc: getDescByScene(c.key) })),
  // 方式3：按用户角色描述
  () => BASE_CATEGORIES.map((c) => ({ ...c, desc: getDescByRole(c.key) })),
  // 方式4：按价值描述
  () => BASE_CATEGORIES.map((c) => ({ ...c, desc: getDescByValue(c.key) })),
];

function getDescByFunction(key: string): string {
  const map: Record<string, string> = {
    tool: "实用小工具，提升效率",
    showcase: "精美页面，展示内容",
    dashboard: "数据可视化，一目了然",
    community: "用户互动，内容分享",
    ecommerce: "商品交易，在线购买",
    game: "趣味互动，休闲娱乐",
    ai: "智能对话，AI 赋能",
  };
  return map[key] || "";
}

function getDescByScene(key: string): string {
  const map: Record<string, string> = {
    tool: "办公、学习、生活场景",
    showcase: "个人品牌、产品推广场景",
    dashboard: "运营监控、数据分析场景",
    community: "社交、知识分享场景",
    ecommerce: "零售、电商运营场景",
    game: "娱乐、休闲放松场景",
    ai: "智能助手、自动化场景",
  };
  return map[key] || "";
}

function getDescByRole(key: string): string {
  const map: Record<string, string> = {
    tool: "适合效率控、工具爱好者",
    showcase: "适合设计师、创业者",
    dashboard: "适合数据分析师、运营人员",
    community: "适合内容创作者、社区运营",
    ecommerce: "适合电商卖家、品牌方",
    game: "适合游戏爱好者、独立开发者",
    ai: "适合 AI 爱好者、产品经理",
  };
  return map[key] || "";
}

function getDescByValue(key: string): string {
  const map: Record<string, string> = {
    tool: "帮你省时间",
    showcase: "帮你秀出来",
    dashboard: "帮你看得清",
    community: "帮你连起来",
    ecommerce: "帮你卖出去",
    game: "帮你玩得爽",
    ai: "帮你变聪明",
  };
  return map[key] || "";
}

function getRandomCategories() {
  const presentationFn = CATEGORY_PRESENTATIONS[Math.floor(Math.random() * CATEGORY_PRESENTATIONS.length)];
  return presentationFn();
}

// 7 个分类 Agent 的 system prompt
const CATEGORY_PROMPTS: Record<string, string> = {
  tool: `你是一个专业的 Web 工具开发工程师。用户需要你构建一个工具类 Web 应用（如计算器、待办清单、转换器、编辑器等）。
请生成一个完整的、可直接在浏览器中运行的单 HTML 文件（内嵌 CSS 和 JavaScript）。

要求：
- 【最高优先级】必须是真正可用的工具：所有功能完整实现并真实有效（计算准确、计时真实走动、数据可增删并保存到 localStorage），绝不是产品介绍页/推广页/展示页
- **声明安全（重要）**：页面内联事件（onclick 等）用到的全局对象必须用 var 声明——先 \`var app;\`，等类定义完成后再 \`app = new App();\` 赋值；构造函数和初始化逻辑里不要引用这个全局变量本身，否则会报 "Cannot access before initialization" 错误
- **视觉设计必须精美**：使用现代渐变色背景、柔和阴影、圆角卡片、微动效（hover/transition）
- 配色方案协调，推荐使用 indigo/purple/blue 渐变或深色高级感配色
- 字体层级清晰（大标题/正文/辅助文字），行距舒适
- 功能完整，交互流畅，操作有即时反馈（动画/颜色变化）
- 代码结构清晰，必须完整，不要省略任何部分
- 必须包含完整的 HTML 结构：<!DOCTYPE html><html><head>...</head><body>...</body></html>
- 所有 CSS 和 JavaScript 必须内嵌在 HTML 文件中
- **严禁使用任何外部 CDN**（包括 Tailwind CDN、Font Awesome、Google Fonts 等），所有样式必须用原生 CSS 写在 <style> 标签内
- 不要使用 markdown 代码块（不要用 \`\`\`html），直接输出纯 HTML 代码
- 开头必须是 <!DOCTYPE html>，结尾必须是 </html>
- 确保所有功能都能正常工作，不要只写框架
- **交互元素必须有完整的事件处理**：所有按钮、标签页、分类筛选等可点击元素，必须绑定 onclick 或 addEventListener 事件，点击后要有明确的视觉反馈（样式变化/内容切换），绝不能只有外观没有功能
- **数据存储**：如果需要保存用户数据（如待办事项、设置、历史记录等），必须使用 localStorage 实现，确保刷新页面后数据不丢失
- **图标和图片**：使用 emoji 或 SVG 内联图标；如果需要图片，使用 CSS 渐变背景 + emoji 作为占位图（例如：div 设置渐变背景色，中间放 emoji），绝不要使用外部图片 URL`,

  showcase: `你是一个专业的 Web 前端开发工程师。用户需要你构建一个展示类网页（如作品集、公司介绍、产品落地页等）。
请生成一个完整的、可直接在浏览器中运行的单 HTML 文件（内嵌 CSS 和 JavaScript）。

要求：
- **视觉设计必须高端精美**：
  * Hero 区域使用全屏大图/渐变背景 + 大标题 + CTA 按钮 + 滚动动效
  * 使用视差滚动、淡入动画、悬停放大等高级效果
  * 每个 section 之间有视觉节奏感（交替背景色、留白充足）
  * 字体排版讲究，使用大字号标题、优雅行距
  * 响应式布局，适配桌面和移动端
- 内容结构清晰，代码必须完整，不要省略
- 必须包含完整的 HTML 结构：<!DOCTYPE html><html><head>...</head><body>...</body></html>
- 所有 CSS 和 JavaScript 必须内嵌在 HTML 文件中
- **严禁使用任何外部 CDN**（包括 Tailwind CDN、Font Awesome、Google Fonts 等），所有样式必须用原生 CSS 写在 <style> 标签内
- 不要使用 markdown 代码块（不要用 \`\`\`html），直接输出纯 HTML 代码
- 开头必须是 <!DOCTYPE html>，结尾必须是 </html>
- **图片处理（极其重要）**：
  * 用户消息中可能会提供【可用商品图片库】，包含真实图片 URL
  * 如果提供了真实图片 URL，必须使用这些真实图片
  * 如果没有提供，使用 CSS 渐变背景 + emoji 作为图片占位，绝不允许留空或使用灰色占位块`,

  dashboard: `你是一个专业的数据可视化工程师。用户需要你构建一个数据看板（数据统计、图表展示、监控面板等）。
请生成一个完整的、可直接在浏览器中运行的单 HTML 文件（内嵌 CSS 和 JavaScript）。

要求：
- **视觉设计必须专业精美**：
  * 深色高级感背景（#0f172a / #1e293b 渐变）
  * 数据卡片带毛玻璃效果（backdrop-filter）、柔和发光边框
  * 关键指标用大字号 + 颜色区分（绿色上涨、红色下跌）
  * 图表区域有充足留白，标题清晰
- 使用 Chart.js 生成图表（通过 CDN 引入：<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>）
- 代码必须完整，不要省略任何部分
- 必须包含完整的 HTML 结构：<!DOCTYPE html><html><head>...</head><body>...</body></html>
- 所有 CSS 和 JavaScript 必须内嵌在 HTML 文件中
- **严禁使用任何外部 CDN**（包括 Tailwind CDN、Font Awesome、Google Fonts 等），所有样式必须用原生 CSS 写在 <style> 标签内（Chart.js 通过 CDN 引入除外）
- 不要使用 markdown 代码块（不要用 \`\`\`html），直接输出纯 HTML 代码
- 开头必须是 <!DOCTYPE html>，结尾必须是 </html>
- 确保图表能正常渲染和显示
- **数据存储**：使用 JavaScript 对象模拟数据，或使用 localStorage 保存用户配置和筛选条件
- **图标**：使用 emoji 或 SVG 作为指标图标，不要留空`,

  community: `你是一个专业的 Web 全栈开发工程师。用户需要你构建一个内容社区（论坛、博客、问答社区等）。
请生成一个完整的、可直接在浏览器中运行的单 HTML 文件（内嵌 CSS 和 JavaScript）。

要求：
- **视觉设计必须精美**：现代卡片布局、柔和阴影、圆角、舒适行距、悬停微动效
- 包含帖子列表、详情页、发帖功能等核心交互
- 配色温暖友好，阅读体验好
- **数据存储（必须实现）**：使用 localStorage 实现完整的数据持久化：
  * 用户发布的帖子必须保存到 localStorage，刷新页面后仍然存在
  * 支持点赞、评论等交互的数据保存
  * 初始化时预置 5-8 个示例帖子数据
- **用户头像**：使用圆形 div + 渐变色背景 + 姓名首字作为头像，不要使用外部头像服务
- **帖子图片**：使用 CSS 渐变背景 + emoji 作为图片占位，不要留空，不要使用外部图片 URL
- 代码必须完整，不要省略任何部分
- 必须包含完整的 HTML 结构：<!DOCTYPE html><html><head>...</head><body>...</body></html>
- 所有 CSS 和 JavaScript 必须内嵌在 HTML 文件中
- **严禁使用任何外部 CDN**（包括 Tailwind CDN、Font Awesome、Google Fonts 等），所有样式必须用原生 CSS 写在 <style> 标签内
- 不要使用 markdown 代码块（不要用 \`\`\`html），直接输出纯 HTML 代码
- 开头必须是 <!DOCTYPE html>，结尾必须是 </html>
- 确保所有交互功能都能正常工作`,

  ecommerce: `你是一个专业的电商开发工程师。用户需要你构建一个电商类网站（商品展示、购物车、订单管理等）。
请生成一个完整的、可直接在浏览器中运行的单 HTML 文件（内嵌 CSS 和 JavaScript）。

要求：
- **视觉设计必须高端精美**：
  * 顶部导航栏带 logo、搜索框、购物车图标
  * Hero 区域使用大图 + 渐变遮罩 + 醒目标语
  * 商品卡片带悬停放大效果、柔和阴影、圆角
  * 价格用红色/橙色突出显示，原价用删除线
  * 底部有品牌信息栏
  * 整体配色专业（推荐黑金风、白净风、或品牌色）
  * **风格优先规则**：如果用户指定了视觉风格（颜色、样式、类似某网站，如"类似苹果官网"、"粉色少女风"、"黑金高端"），必须严格按用户指定的风格设计主题色、布局氛围和字体气质，禁止套用默认配色；只有用户未指定时才自行选择适合商品气质的配色
- 包含商品列表、详情页、购物车等核心页面
- **数据存储（必须实现）**：使用 localStorage 实现完整的数据持久化：
  * 购物车数据（商品、数量、总价）必须保存，刷新后不丢失
  * 购物车图标上的数字徽章必须显示商品总件数（所有商品 quantity 之和），不是商品种类数。例如：苹果×2 + 香蕉×3 = 显示 5，不是 2
  * 用户收藏/心愿单功能
  * 订单历史记录
  * 初始化时预置 8-12 个示例商品数据
- **商品图片（极其重要）**：
  * 用户消息中会提供【可用商品图片库】，包含真实商品图片 URL
  * 你必须使用这些真实图片 URL 作为商品图片，绝不允许使用占位图或灰色方块
  * 每个商品使用不同的图片 URL
  * 如果提供的图片不够，可以重复使用或用 CSS 渐变作为补充
- 代码必须完整，不要省略任何部分
- 必须包含完整的 HTML 结构：<!DOCTYPE html><html><head>...</head><body>...</body></html>
- 所有 CSS 和 JavaScript 必须内嵌在 HTML 文件中
- **严禁使用任何外部 CDN**（包括 Tailwind CDN、Font Awesome、Google Fonts 等），所有样式必须用原生 CSS 写在 <style> 标签内
- 不要使用 markdown 代码块（不要用 \`\`\`html），直接输出纯 HTML 代码
- 开头必须是 <!DOCTYPE html>，结尾必须是 </html>
- 确保所有功能都能正常工作，不要只写框架
- **交互元素必须有完整的事件处理**：所有按钮、标签页、分类筛选等可点击元素，必须绑定 onclick 或 addEventListener 事件，点击后要有明确的视觉反馈（样式变化/内容切换），绝不能只有外观没有功能`,

  game: `你是一个专业的游戏开发工程师。用户需要你构建一个浏览器小游戏。
请生成一个完整的、可直接在浏览器中运行的单 HTML 文件（内嵌 CSS 和 JavaScript）。

【最高优先级】你要生成的是「真正可以玩的游戏」（类似贪吃蛇、超级玛丽、水果忍者这种），绝不是游戏介绍页/游戏官网/展示网站：
- 必须有真实的游戏循环（requestAnimationFrame 或 setInterval 驱动画面持续更新）
- 必须有真实的操作控制（键盘方向键/WASD，或鼠标/手指滑动，按下后立即有反应）
- 必须有完整规则闭环：开始界面 → 点击开始真正进入游戏 → 操作得分/连击 → 失败或通关 → 结算界面展示成绩并可再来一局
- 用户打开页面就能直接上手玩，而不是浏览静态内容

要求：
- **视觉设计必须精美**：
  * 开始界面有大标题、动画背景、开始按钮带发光效果
  * 游戏界面布局清晰，分数/生命值显示醒目
  * 结束界面有成绩展示、再来一次按钮
  * 整体配色活泼，适合游戏氛围
- 游戏有趣，玩法清晰，操作响应灵敏
- 使用 Canvas 或 DOM 实现
- **健壮性要求**：游戏主循环和绘制函数必须先判断当前游戏状态（菜单/进行中/暂停/结束），未开始时不能访问未初始化的对象，任何状态下都不得抛出错误
- **声明安全（重要）**：页面内联事件（onclick 等）用到的全局对象必须用 var 声明——先 \`var app;\`，等类定义完成后再 \`app = new App();\` 赋值；构造函数和初始化逻辑里不要引用这个全局变量本身，否则会报 "Cannot access before initialization" 错误
- 代码必须完整，不要省略任何部分
- 必须包含完整的 HTML 结构：<!DOCTYPE html><html><head>...</head><body>...</body></html>
- 所有 CSS 和 JavaScript 必须内嵌在 HTML 文件中
- **严禁使用任何外部 CDN**（包括 Tailwind CDN、Font Awesome、Google Fonts 等），所有样式必须用原生 CSS 写在 <style> 标签内
- 不要使用 markdown 代码块（不要用 \`\`\`html），直接输出纯 HTML 代码
- 开头必须是 <!DOCTYPE html>，结尾必须是 </html>
- 确保游戏逻辑完整，能够正常游玩
- **数据存储**：使用 localStorage 保存最高分、游戏设置和进度
- **游戏图形**：使用 Canvas 绘制游戏元素，或使用 emoji 作为游戏角色和道具`,

  ai: `你是一个专业的 AI 应用开发工程师。用户需要你构建一个 AI 应用（聊天机器人、写作助手、翻译工具等）。
请生成一个完整的、可直接在浏览器中运行的单 HTML 文件（内嵌 CSS 和 JavaScript）。

要求：
- **视觉设计必须精美现代**：
  * 聊天气泡带头像、时间戳、发送动画
  * 渐变背景 + 毛玻璃效果输入框
  * 消息有进入动画（从下方淡入）
  * 整体科技感强，使用 indigo/purple 配色
- 界面现代，交互流畅，打字机效果展示 AI 回复
- 模拟 AI 交互体验（可用预设回复演示）
- 代码必须完整，不要省略任何部分
- 必须包含完整的 HTML 结构：<!DOCTYPE html><html><head>...</head><body>...</body></html>
- 所有 CSS 和 JavaScript 必须内嵌在 HTML 文件中
- **严禁使用任何外部 CDN**（包括 Tailwind CDN、Font Awesome、Google Fonts 等），所有样式必须用原生 CSS 写在 <style> 标签内
- 不要使用 markdown 代码块（不要用 \`\`\`html），直接输出纯 HTML 代码
- 开头必须是 <!DOCTYPE html>，结尾必须是 </html>
- 确保所有交互功能都能正常工作
- **数据存储**：使用 localStorage 保存对话历史、用户设置和偏好
- **头像**：AI 头像和用户头像都使用圆形 div + 渐变色背景 + emoji 或姓名首字，不要使用外部头像服务`,
};

// 从合并的 HTML 中智能提取多文件项目结构（模拟真实项目，15+ 文件）
function extractSourceFiles(html: string, category: string): Record<string, string> {
  const files: Record<string, string> = {};
  const catLabel = getCategoryLabel(category);

  // —— 多文件应用：结构 / 样式 / 脚本分离，复制整个文件夹后双击 index.html 即可运行 ——
  let indexHtml = html;

  // 1) 抽出所有 <style> → styles/main.css
  const cssParts: string[] = [];
  indexHtml = indexHtml.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => {
    cssParts.push(String(css).trim());
    return "";
  });
  const mainCss = cssParts.filter(Boolean).join("\n\n");

  // 2) 抽出内联 <script>：带 src 的外部脚本与 tailwind.config 保留在原位，其余合并 → scripts/main.js
  const jsParts: string[] = [];
  indexHtml = indexHtml.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, body) => {
    if (/\bsrc\s*=/i.test(attrs)) return match; // 外部脚本（如 Tailwind CDN）原地保留
    if (/tailwind\.config/.test(body)) return match; // tailwind 配置需尽早加载，保留内联
    jsParts.push(String(body).trim());
    return "";
  });
  const mainJs = jsParts.filter(Boolean).join("\n\n;\n\n");

  // 3) index.html 注入资源引用（样式 + 图标进 <head>，主脚本放 </body> 前）
  if (/<\/head>/i.test(indexHtml)) {
    const headInjections =
      `  <link rel="stylesheet" href="styles/main.css">\n` +
      `  <link rel="icon" type="image/svg+xml" href="public/favicon.svg">\n`;
    indexHtml = indexHtml.replace(/<\/head>/i, headInjections + `</head>`);
  }
  if (mainJs) {
    const mainScriptTag = `  <script src="scripts/main.js"></script>\n`;
    if (/<\/body>/i.test(indexHtml)) {
      indexHtml = indexHtml.replace(/<\/body>/i, mainScriptTag + `</body>`);
    } else {
      indexHtml += "\n" + mainScriptTag;
    }
  }

  // 4) 网站图标
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#6366f1"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="14" font-family="Arial">${catLabel.charAt(0)}</text></svg>`;

  files["index.html"] = indexHtml.trim();
  files["styles/main.css"] = `/* ${catLabel} · 全部样式 */\n${mainCss}\n`;
  files["scripts/main.js"] = `/* ${catLabel} · 交互逻辑 */\n${mainJs}\n`;
  files["public/favicon.svg"] = faviconSvg;
  files[".gitignore"] = ".DS_Store\n*.log\nnode_modules/\n";

  files["README.md"] = `# ${catLabel}

> 多文件网页应用

## 🚀 如何运行

无需安装任何软件、无需任何命令。

**复制整个文件夹后，直接双击 \`index.html\`**，即可在浏览器中打开并使用。

> 提示：页面样式通过在线 CDN 加载，首次打开时需要联网；请保持文件夹完整。

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| \`index.html\` | 页面结构（引用下面的样式与脚本） |
| \`styles/main.css\` | 全部样式 |
| \`scripts/main.js\` | 全部交互逻辑 |
| \`public/favicon.svg\` | 网站图标 |
| \`.gitignore\` | 版本控制忽略规则（可选） |
| \`README.md\` | 本说明文档 |
`;

  return files;
}

// 辅助：按正则提取 JS 段落
function extractSection(js: string, pattern: RegExp): string | null {
  const match = js.match(pattern);
  return match ? match[0].trim() : null;
}

// 辅助：获取分类中文名
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    ecommerce: "电商类应用",
    community: "社区类应用",
    tool: "工具类应用",
    showcase: "展示类网页",
    dashboard: "数据看板",
    game: "小游戏",
    ai: "AI 应用",
  };
  return labels[category] || "Web 应用";
}

// 意图识别：判断用户请求属于哪种类型
function detectIntent(prompt: string): "webapp" | "qa" {
  const p = prompt.toLowerCase();
  const webappKeywords = ["网站", "app", "应用", "系统", "平台", "商城", "论坛",
    "小程序", "网页", "做个", "做一个", "帮我做", "创建", "开发", "搭建",
    "写一个", "写个", "做一个网页", "做一个网站", "做一个app",
    // 小游戏也是要做产品，不是问答
    "游戏", "小游戏", "贪吃蛇", "贪食蛇", "超级玛丽", "马里奥", "玛丽",
    "水果忍者", "俄罗斯方块", "消消乐", "跑酷", "扫雷", "五子棋", "象棋",
    "围棋", "打砖块", "飞机大战", "2048", "flappy", "game", "来一局",
    // 小工具也是要做产品，不是问答
    "工具", "计算器", "计算", "番茄钟", "番茄工作法", "倒计时", "待办", "清单",
    "打卡", "记账", "账单", "换算", "换算器", "密码生成", "抽签", "选择器",
    "吃什么", "房贷", "计时器", "提醒", "笔记", "转换器",
    // 数据看板也是要做产品，不是问答
    "看板", "仪表盘", "数据大屏", "大屏", "报表", "统计图", "图表", "运营监控", "监控看板"];
  if (webappKeywords.some(k => p.includes(k))) return "webapp";
  return "qa";
}

// 根据用户需求和分类，从数据库动态查询匹配的商品图片
async function fetchProductImages(prompt: string, category: string): Promise<string> {
  // 分类关键词映射：用户可能说的词 → 数据库中的分类
  const categoryMap: Record<string, string[]> = {
    electronics: ["电子", "数码", "手机", "电脑", "耳机", "相机", "平板", "智能", "科技", "3c"],
    clothing: ["服装", "衣服", "鞋", "包", "时尚", "穿搭", "女装", "男装", "搭配"],
    home: ["家居", "家具", "家装", "装饰", "生活", "居家", "灯", "厨房", "卧室"],
    food: ["食品", "食物", "零食", "水果", "饮料", "咖啡", "茶", "蛋糕", "餐饮", "美食"],
    sports: ["运动", "健身", "体育", "跑步", "瑜伽", "球", "骑行", "户外"],
  };

  // 1. 根据分类名直接匹配
  let dbCategory = category;
  if (category === "ecommerce") {
    // 电商分类：根据用户需求关键词确定具体的商品分类
    const promptLower = prompt.toLowerCase();
    for (const [dbCat, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(k => promptLower.includes(k))) {
        dbCategory = dbCat;
        break;
      }
    }
    // 如果没匹配到具体关键词，就用通用的 ecommerce
    if (dbCategory === "ecommerce") {
      dbCategory = "electronics"; // 默认电子产品
    }
  } else if (category === "showcase") {
    dbCategory = "clothing";
  }

  // 2. 从数据库获取该分类的图片
  let images: any[] = [];
  try {
    // 先尝试按关键词匹配
    const keywords: string[] = [];
    for (const [dbCat, kws] of Object.entries(categoryMap)) {
      if (dbCat === dbCategory || dbCategory === category) {
        keywords.push(...kws.slice(0, 3));
      }
    }

    if (keywords.length > 0) {
      images = await prisma.productImage.findByTags({ tags: keywords, category: dbCategory });
    }

    // 如果按标签没找到或数量不够，按分类随机补充
    if (images.length < 6) {
      const randomImages = await prisma.productImage.getRandom({ category: dbCategory, count: 8 });
      const existUrls = new Set(images.map(i => i.url));
      for (const img of randomImages) {
        if (!existUrls.has(img.url)) {
          images.push(img);
        }
        if (images.length >= 8) break;
      }
    }
  } catch (e) {
    console.error("获取商品图片失败:", e);
  }

  if (images.length === 0) return "";

  // 3. 格式化为 LLM 可用的文本
  const imageList = images.map((img, i) =>
    `${i + 1}. ${img.name}（${img.category}）: ${img.url}`
  ).join("\n");

  return `\n\n【可用商品图片库 - 必须使用以下真实图片 URL】\n请在生成的代码中使用以下真实图片 URL（根据商品类型选择合适的图片）：\n${imageList}\n\n注意：\n- 每个商品必须使用不同的图片 URL\n- 图片 URL 必须完整复制，不要修改\n- 根据商品名称和分类选择最匹配的图片`;
}

// 调用通义万相 API 生成图片
async function generateImage(prompt: string): Promise<string | null> {
  try {
    // 提交异步任务（通义万相专用端点）
    const submitRes = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: "wanx2.1-t2i-turbo",
        input: { prompt },
        parameters: {
          n: 1,
          size: "1024*1024",
        },
      }),
    });
    const submitData = await submitRes.json();
    const taskId = submitData.output?.task_id;
    if (!taskId) {
      console.error("Image submit failed:", submitData);
      return null;
    }

    // 轮询任务状态（最多 60 秒）
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      const statusData = await statusRes.json();
      if (statusData.output?.task_status === "SUCCEEDED") {
        return statusData.output?.results?.[0]?.url || null;
      }
      if (statusData.output?.task_status === "FAILED") {
        console.error("Image generation failed:", statusData);
        return null;
      }
    }
    return null;
  } catch (e) {
    console.error("Image generation error:", e);
    return null;
  }
}

// 把 LLM 流式输出按批转成 SSE 事件，让前端聊天区实时显示"AI 的行动"（像 AI 对话一样）
function makeLiveChunker(send: (o: any) => void, type: "code_chunk" | "thinking_chunk") {
  let buf = "";
  let last = Date.now();
  const flush = () => {
    if (buf) {
      send({ type, content: buf });
      buf = "";
      last = Date.now();
    }
  };
  const push = (chunk: string) => {
    buf += chunk;
    const now = Date.now();
    if (buf.length >= 200 || now - last > 200) flush();
  };
  return { push, flush };
}

// 检测用户是否在需求中指定了视觉风格（颜色 / 样式 / 类似某网站）
function detectCustomStyle(text: string): boolean {
  if (!text) return false;
  const styleKeywords = [
    "风格", "样式", "色调", "配色", "主题色", "颜色",
    "类似", "类似于", "仿", "同款", "参考",
    "极简", "简约", "复古", "科技感", "商务", "可爱", "少女", "高级感", "暗黑", "小清新", "国潮", "日系", "欧美", "轻奢", "炫酷",
    "红色", "橙色", "黄色", "绿色", "蓝色", "紫色", "粉色", "黑色", "白色", "金色", "银色", "莫兰迪", "马卡龙", "渐变色",
    "苹果官网", "Apple", "apple", "淘宝", "京东", "网易严选", "无印良品", "拼多多", "亚马逊", "得物", "Nike", "nike",
  ];
  return styleKeywords.some((k) => text.includes(k));
}

// ==================== 小游戏主题选择 ====================
// 小游戏必须是真正可玩的游戏。用户没指定做什么游戏时，从三款经典游戏中随机抽一个；
// 用户指定了（贪吃蛇/玛丽/水果忍者或其他游戏）则严格按用户需求来。
const GAME_PRESETS = [
  {
    key: "snake",
    name: "贪吃蛇",
    requirement: "经典贪吃蛇：网格地图，蛇身持续移动，方向键/WASD 控制，吃食物变长加分，撞墙或咬到自己结束，分数越高速度越快，用 localStorage 记录最高分",
  },
  {
    key: "mario",
    name: "超级玛丽风格的平台跳跃游戏",
    requirement: "超级玛丽风格的横版平台跳跃闯关游戏：角色左右移动和跳跃，有平台、管道和障碍物，踩敌人可消灭它们，吃金币加分，到达终点旗帜通关，有生命数和计分，可爱卡通画风",
  },
  {
    key: "fruit",
    name: "水果忍者",
    requirement: "水果忍者切水果游戏：水果从屏幕底部抛起按抛物线落下，鼠标/手指滑动出现刀光切开水果，切中后果实分裂并有果汁飞溅粒子效果，切到炸弹会扣命或结束，有连击加分和倒计时模式",
  },
];

// 检测文本是否明确提到了某款游戏（提到就按用户的来）
function detectGameTheme(text: string): { key: string; name: string; requirement: string } | null {
  if (!text) return null;
  if (/贪吃蛇|贪食蛇|吃豆蛇|snake/i.test(text)) return GAME_PRESETS[0];
  if (/玛丽|马里奥|顶蘑菇|踩怪|吃金币|平台跳跃|横版(跳跃|闯关|冒险)|跳跃闯关|跳跃冒险|跳台游戏|库巴|碧琪|耀西|mario/i.test(text)) return GAME_PRESETS[1];
  if (/水果忍者|切水果|忍者切|水果切割|削水果|fruit\s*ninja/i.test(text)) return GAME_PRESETS[2];
  return null;
}

// 判断用户是否给出了具体游戏需求（去掉"做个好玩的小游戏"这类泛泛表达后还有实质内容）
function hasSpecificGameRequest(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  const stripped = t.replace(/请|帮我|帮忙|给我|我想|我要|我需要|需要|你|我们|一个|一款|一种|做个|做|制作|开发|实现|生成|写|创建|搭建|弄|来|吧|呀|啊|哦|哈|嘛|。|，|！|？|!|\?|,|\.|、|随便|随意|都行|都可以|自由发挥|小游戏|网页游戏|浏览器游戏|网页|浏览器|在线|休闲|简单|好玩|有趣|游戏|小|的|地|得|一下|玩玩|可以|能|希望|想|很|非常|特别|比较|最好|带|有|和|与|及|或者|还是|因为|所以|但|但是|如果|虽然|然后|而且|【[^】]*】/g, "");
  return stripped.trim().length > 0;
}

// 没指定游戏时随机抽一个
function randomGamePreset() {
  return GAME_PRESETS[Math.floor(Math.random() * GAME_PRESETS.length)];
}

// ==================== 小工具主题选择 ====================
// 用户没指定做什么工具时，从灵感库随机抽一个具体工具；用户指定了就严格按用户需求来。
const TOOL_PRESETS = [
  {
    key: "pomodoro",
    name: "番茄钟",
    requirement: "番茄工作法计时器：25 分钟专注 + 5 分钟休息循环，大数字倒计时实时走动，开始/暂停/重置按钮，完成 4 个番茄钟自动进入 15 分钟长休息，统计今日已完成番茄数（localStorage 保存），阶段切换有明显视觉提示",
  },
  {
    key: "mortgage",
    name: "房贷计算器",
    requirement: "房贷计算器：输入房屋总价、首付比例、贷款年限、年利率，支持等额本息/等额本金两种方式切换，实时计算月供、总利息、总还款额，并展示逐年还款明细表（每年还多少本金多少利息）",
  },
  {
    key: "todo",
    name: "待办清单",
    requirement: "待办清单：添加/删除/勾选完成任务，支持标记重要程度，按全部/未完成/已完成筛选，显示剩余任务计数，数据存 localStorage 刷新不丢失",
  },
  {
    key: "habit",
    name: "习惯打卡",
    requirement: "习惯打卡：可添加多个习惯（如喝水、运动、阅读），每天点击打卡，显示每个习惯的连续打卡天数和本周打卡日历格（七天格子点亮），数据存 localStorage",
  },
  {
    key: "ledger",
    name: "记账本",
    requirement: "记账本：记录收入/支出的金额、分类、备注，顶部显示本月收入/支出/结余汇总，按分类统计支出占比条形图，账单列表按时间倒序，数据存 localStorage",
  },
  {
    key: "dinner",
    name: "今天吃什么",
    requirement: "今天吃什么随机选择器：内置常见菜品列表，点击开始按钮滚动抽奖动画，随机抽出结果并大字展示，可以\"换一个\"，支持自己添加/删除选项，自定义选项存 localStorage",
  },
  {
    key: "password",
    name: "密码生成器",
    requirement: "强密码生成器：长度滑块（8-32 位），勾选是否包含大写字母/小写字母/数字/特殊符号，一键生成随机密码，一键复制并提示\"已复制\"，显示密码强度等级条",
  },
  {
    key: "unit",
    name: "单位换算器",
    requirement: "单位换算器：支持长度（米/厘米/千米/英尺等）、重量（千克/克/斤/磅等）、温度（摄氏/华氏/开尔文）三大类，选择单位输入数值后实时换算出其他所有单位的结果",
  },
];

// 判断用户是否给出了具体工具需求（去掉"做个实用的小工具"这类泛泛表达后还有实质内容）
function hasSpecificToolRequest(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  const stripped = t.replace(/请|帮我|帮忙|给我|我想|我要|我需要|需要|你|我们|一个|一款|一种|做个|做|制作|开发|实现|生成|写|创建|搭建|弄|来|吧|呀|啊|哦|哈|嘛|。|，|！|？|!|\?|,|\.|、|随便|随意|都行|都可以|自由发挥|灵感|小工具|工具|应用|网页|浏览器|在线|休闲|简单|好用|实用|有趣|日常|的|地|得|一下|可以|能|希望|想|很|非常|特别|比较|最好|带|有|和|与|及|或者|还是|因为|所以|但|但是|如果|虽然|然后|而且|【[^】]*】/g, "");
  return stripped.trim().length > 0;
}

// 没指定工具时从灵感库随机抽一个
function randomToolPreset() {
  return TOOL_PRESETS[Math.floor(Math.random() * TOOL_PRESETS.length)];
}

// ==================== 数据看板主题选择 ====================
// 用户没指定具体看板时，默认按「电商运营数据看板」来做；用户指定了就严格按用户需求来。
const DASHBOARD_PRESET = {
  name: "电商运营数据看板",
  requirement: "电商运营数据看板：顶部 4 张核心经营指标卡片（销售额、订单数、访客数、转化率，每张带涨跌幅），近 7 天销售额趋势柱状图，各销售渠道占比进度条，最新订单明细表（商品/状态/数量/金额/日期），左侧导航菜单（概览/分析/订单/商品/设置）。深色高级感风格，数据要真实可信、贴近现实电商场景",
};

// 判断用户是否给出了具体看板需求（去掉"做个数据看板"这类泛泛表达后还有实质内容）
function hasSpecificDashboardRequest(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  const stripped = t.replace(/请|帮我|帮忙|给我|我想|我要|我需要|需要|你|我们|一个|一款|一种|做个|做|制作|开发|实现|生成|写|创建|搭建|弄|来|吧|呀|啊|哦|哈|嘛|。|，|！|？|!|\?|,|\.|、|随便|随意|都行|都可以|自由发挥|灵感|数据看板|看板|仪表盘|大屏|报表|数据|可视化|图表|统计|页面|网页|浏览器|在线|休闲|简单|好看|漂亮|美观|专业|的|地|得|一下|可以|能|希望|想|很|非常|特别|比较|最好|带|有|和|与|及|或者|还是|因为|所以|但|但是|如果|虽然|然后|而且|【[^】]*】/g, "");
  return stripped.trim().length > 0;
}

// 构造「需要注册登录」的完整实现要求（纯前端应用用 localStorage 模拟）
function buildAuthRequirement(categoryKey: string): string {
  const loginOps: Record<string, string> = {
    ecommerce: "加入购物车结算、提交订单、收藏商品",
    community: "发布帖子、发表评论、点赞",
    dashboard: "保存看板配置、导出数据",
    tool: "保存个人数据、同步记录",
    showcase: "提交表单、预约咨询",
    game: "保存游戏进度、提交排行榜成绩",
    ai: "保存对话记录、收藏结果",
  };
  const ops = loginOps[categoryKey] || "提交数据、保存个人内容";
  return `

【用户注册登录要求（勾选了"需要用户注册登录"，必须完整实现，极其重要）】
本应用为纯前端应用，请用 localStorage 模拟用户数据库，实现完整、真实可用的注册登录流程：
1. 注册：弹窗表单包含用户名、密码、确认密码；校验用户名不能重复、两次密码必须一致、不能为空；注册成功后自动登录。所有注册用户保存到 localStorage 的 atoms_users（JSON 数组）。
2. 登录：校验用户名和密码是否匹配，错误时给出友好的红色错误提示；登录成功后把当前用户存到 localStorage 的 atoms_current_user。
3. 退出登录：清除 atoms_current_user，页面立即恢复未登录状态。
4. 顶部导航栏状态：未登录时显示"登录/注册"按钮；已登录时显示圆形头像（渐变背景 + 用户名首字）和用户名，点击出现下拉菜单，可退出登录。
5. 需要登录才能操作的功能：${ops}。未登录用户触发这些操作时，自动弹出登录弹窗并提示"请先登录"，登录成功后自动继续刚才的操作。浏览类功能不需要登录。
6. 登录/注册弹窗必须美观：居中圆角卡片、半透明模糊遮罩、"登录/注册"标签页切换、输入框样式精致、主按钮使用应用主题色。
7. 刷新页面后登录状态必须保持（从 localStorage 读取）。`;
}

export async function POST(request: Request) {
  // 密钥未配置时直接返回明确错误，绝不回退到硬编码
  if (!API_KEY) {
    const msg = (o: Record<string, unknown>) => `data: ${JSON.stringify(o)}\n\n`;
    return new Response(
      msg({ type: "error", message: "服务端未配置 DASHSCOPE_API_KEY，请在 .env 文件中设置后重启" }) + msg({ type: "done" }),
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }
  const { prompt, category, plan, style, detail, version, needsAuth } = await request.json();

  // 检测是否为增量开发（prompt 中包含"已有代码"）
  const isIncremental = prompt && prompt.includes("基于以下已有代码") && prompt.includes("已有代码：\n");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        if (isIncremental) {
          // ===== 增量开发：基于已有代码添加新功能 =====
          const versionNum = version || 2; // 使用传入的版本号，默认为 2

          // 从 prompt 中提取已有代码和新需求
          const codeMatch = prompt.match(/已有代码：\n([\s\S]*)$/);
          const existingCode = codeMatch ? codeMatch[1].trim() : "";
          const requirementMatch = prompt.match(/基于以下已有代码，添加新功能：([\s\S]+?)。需求：([\s\S]+?)\n\n已有代码/);
          const featureTitle = requirementMatch ? requirementMatch[1].trim() : "新功能";
          const featureDesc = requirementMatch ? requirementMatch[2].trim() : "";

          const categoryKey = category === "custom" ? "tool" : (category || "tool");
          const catLabel = getCategoryLabel(categoryKey);

          // 发送工作流开始
          send({ type: "workflow_panel" });
          await new Promise(resolve => setTimeout(resolve, 500));

          // 定义详细的增量开发步骤（每步包含：文字描述、文件操作、AI 思考内容）
          const allSteps: { text: string; actions: { type: "read_file" | "write_file"; label: string; detail: string }[]; thinking: string }[] = [
            {
              text: "读取现有项目文件",
              actions: [
                { type: "read_file", label: "读取入口文件", detail: "index.html" },
                { type: "read_file", label: "读取项目配置", detail: "package.json" },
              ],
              thinking: "开始分析现有项目...\n\n先读取项目的主文件，看看整体结构。\n\n这是一个单页应用，所有结构、样式和逻辑都集中在一个文件里。\n\n再看一下项目配置，了解用了哪些技术和依赖。",
            },
            {
              text: "分析现有页面结构和组件",
              actions: [
                { type: "read_file", label: "解析页面结构", detail: "index.html" },
                { type: "read_file", label: "检查自定义组件", detail: "index.html" },
              ],
              thinking: "解析页面的结构...\n\n发现包含以下区域：\n- 顶部导航区域\n- 主内容容器\n- 多个功能组件（卡片、列表、表单等）\n- 底部区域\n\n组件通过类名区分，使用了语义化的标签，结构比较清晰。",
            },
            {
              text: "检查现有样式定义",
              actions: [
                { type: "read_file", label: "分析全局样式", detail: "index.html" },
                { type: "read_file", label: "检查组件样式", detail: "index.html" },
                { type: "read_file", label: "检查响应式适配", detail: "index.html" },
              ],
              thinking: "分析现有的样式规则...\n\n全局定义了主题变量，包括颜色、间距、字体等。\n\n现有组件样式：\n- 容器使用弹性/网格布局\n- 卡片采用卡片式设计\n- 按钮提供多种尺寸\n\n已经做了平板和手机两种尺寸的响应式适配。",
            },
            {
              text: "分析现有交互逻辑",
              actions: [
                { type: "read_file", label: "检查状态管理", detail: "index.html" },
                { type: "read_file", label: "分析事件绑定", detail: "index.html" },
                { type: "read_file", label: "检查数据渲染", detail: "index.html" },
              ],
              thinking: "分析交互逻辑...\n\n状态管理：用数据对象存储应用状态，通过渲染函数把状态同步到页面。\n\n事件绑定：通过监听器处理用户操作，操作完成后更新状态并触发重新渲染。\n\n数据渲染：根据当前状态更新页面内容，采用直接操作页面元素的方式。",
            },
            {
              text: `理解增量需求：${featureTitle}`,
              actions: [],
              thinking: `理解新功能需求...\n\n用户希望在现有应用上添加：「${featureTitle}」\n详细描述：${featureDesc || "用户未提供详细描述，需要基于标题推断实现方向"}\n\n分析这个需求需要：\n- 哪些新的 DOM 元素\n- 哪些新的 CSS 样式\n- 哪些新的 JS 函数和事件\n- 对现有功能的影响范围`,
            },
            {
              text: "设计新功能的技术方案",
              actions: [],
              thinking: `制定技术实现方案...\n\n1. HTML 结构：在合适的位置添加新的容器/组件\n2. CSS 样式：使用现有设计系统（:root 变量）定义新样式\n3. JavaScript：\n   - 新增状态字段到 data 对象\n   - 新增渲染函数 handleFeature()\n   - 绑定事件监听器\n   - 在 init() 中调用初始化\n\n评估对现有代码的侵入性，确保不影响原有功能。`,
            },
            {
              text: "规划 HTML 结构修改",
              actions: [
                { type: "write_file", label: "新增 DOM 节点", detail: "index.html → 添加功能容器" },
                { type: "write_file", label: "调整布局结构", detail: "index.html → 修改 flex/grid 布局" },
              ],
              thinking: "规划 HTML 修改...\n\n确定新功能需要插入的位置：在 <main> 容器内，紧接现有内容之后。\n\n创建新的 <section class=\"feature-container\"> 作为功能入口，内部包含：\n- 功能标题 <h2>\n- 功能内容区 <div class=\"feature-content\">\n- 操作按钮区 <div class=\"feature-actions\">\n\n使用 flex/grid 保持与现有布局的一致性。",
            },
            {
              text: "添加新的 CSS 样式规则",
              actions: [
                { type: "write_file", label: "定义新组件样式", detail: "index.html → .new-feature { ... }" },
                { type: "write_file", label: "添加交互动画", detail: "index.html → @keyframes / transition" },
              ],
              thinking: "设计 CSS 样式...\n\n基于 :root 中的现有变量，为新组件定义样式：\n- 使用 var(--card-bg)、var(--card-border) 保持一致\n- 添加 hover 过渡效果\n- 添加 @keyframes 动画增强交互反馈\n- 在 @media 查询中添加响应式适配\n\n注意避免与现有样式冲突，使用 BEM 命名或组件前缀。",
            },
            {
              text: "实现新功能 JavaScript 逻辑",
              actions: [
                { type: "write_file", label: "编写核心功能函数", detail: "index.html → function handleFeature()" },
                { type: "write_file", label: "添加数据处理逻辑", detail: "index.html → data transformation" },
              ],
              thinking: "编写 JavaScript 逻辑...\n\n1. 在 data 对象中新增功能状态字段\n2. 实现 handleFeature() 函数处理核心逻辑\n3. 实现 renderFeature() 函数渲染 UI\n4. 添加数据转换/格式化辅助函数\n5. 确保异步操作有合适的错误处理\n\n代码风格与现有保持一致：函数命名、注释、缩进。",
            },
            {
              text: "集成新功能到现有代码",
              actions: [
                { type: "write_file", label: "注册新事件监听器", detail: "index.html → 绑定 click/input 事件" },
                { type: "write_file", label: "整合到初始化流程", detail: "index.html → init() 中调用" },
              ],
              thinking: "集成新功能...\n\n1. 在 DOMContentLoaded 事件中绑定新功能的事件监听器\n2. 在 init() 函数中调用 renderFeature() 初始化渲染\n3. 确保新功能的状态纳入统一的状态管理流程\n4. 在 render() 中同步调用 renderFeature() 保持 UI 更新\n\n关键点：保证新功能的生命周期与现有代码同步。",
            },
            {
              text: "更新事件监听器绑定",
              actions: [
                { type: "write_file", label: "连接新旧事件处理", detail: "index.html → 统一事件管理" },
                { type: "read_file", label: "验证无冲突绑定", detail: "index.html → 检查重复监听器" },
              ],
              thinking: "检查事件监听器...\n\n确认新功能的事件不会与现有事件冲突：\n- 检查是否有相同元素上的重复监听\n- 确认事件冒泡/捕获行为不会干扰现有功能\n- 验证事件移除逻辑（组件销毁时清理）\n\n必要时使用事件委托（在父元素上监听）减少监听器数量。",
            },
            {
              text: "优化样式兼容性和响应式",
              actions: [
                { type: "write_file", label: "适配移动端布局", detail: "index.html → @media (max-width: 768px)" },
                { type: "write_file", label: "修复暗色模式样式", detail: "index.html → .dark-mode 兼容" },
              ],
              thinking: "检查响应式兼容性...\n\n在 768px 和 480px 断点测试新功能：\n- 移动端改为垂直布局\n- 按钮和输入框适配触摸操作尺寸\n- 暗色模式下颜色对比度检查\n\n修复发现的问题：在小屏幕上堆叠布局、调整字体大小。",
            },
            {
              text: "测试新功能交互逻辑",
              actions: [
                { type: "read_file", label: "模拟用户操作", detail: "index.html → 点击/输入/切换" },
                { type: "read_file", label: "检查状态一致性", detail: "index.html → state vs DOM" },
              ],
              thinking: "测试新功能...\n\n模拟用户操作：\n1. 点击触发功能\n2. 输入数据验证\n3. 状态切换检查\n4. 边界情况测试（空输入、重复操作）\n\n验证 state 和 DOM 的一致性：操作后 data 对象和渲染的 UI 是否同步。",
            },
            {
              text: "验证现有功能未被破坏",
              actions: [
                { type: "read_file", label: "回归测试原有流程", detail: "index.html → 原有功能路径" },
                { type: "read_file", label: "检查全局变量冲突", detail: "index.html → 命名空间检查" },
              ],
              thinking: "回归测试现有功能...\n\n逐一验证原有功能：\n- 原有交互是否仍能正常工作\n- 原有样式是否受到影响\n- 数据流是否完整\n\n检查全局命名空间：新功能是否引入了与现有变量/函数同名的标识符。",
            },
            {
              text: "代码质量检查和优化",
              actions: [
                { type: "write_file", label: "清理冗余代码", detail: "index.html → 移除未使用变量" },
                { type: "write_file", label: "统一代码风格", detail: "index.html → 格式化 / 注释" },
              ],
              thinking: "代码质量审查...\n\n- 删除未使用的变量和函数\n- 添加功能注释和 JSDoc 说明\n- 统一缩进和格式化\n- 检查 console.log 调试代码并移除\n- 优化性能（减少 DOM 操作次数、避免重复渲染）\n\n最终代码通过质量检查，准备输出。",
            },
          ];

          // 逐步发送每个工作流步骤
          let stepNum = 0;
          for (let i = 0; i < allSteps.length; i++) {
            const step = allSteps[i];
            stepNum = i + 1;

            // 发送步骤（未完成）- 包含 actions 以便前端显示具体文件操作
            send({
              type: "workflow_item",
              number: stepNum,
              text: step.text,
              done: false,
              actions: step.actions,
            });

            // 标记步骤完成
            send({
              type: "workflow_item",
              number: stepNum,
              text: step.text,
              done: true,
              actions: step.actions,
            });

            await new Promise(resolve => setTimeout(resolve, 200));
          }

          // 调用 LLM 修改现有代码
          send({ type: "workflow_item", number: stepNum + 1, text: "Alex 正在生成修改后的完整代码", done: false });

          const systemPrompt = CATEGORY_PROMPTS[categoryKey] || CATEGORY_PROMPTS.tool;

          // 长代码生成期间定时发心跳，防止 SSE 连接被客户端/代理切断
          const incHeartbeat = setInterval(() => {
            send({ type: "heartbeat" });
          }, 15000);
          let modifiedCode = "";
          const incLive = makeLiveChunker(send, "code_chunk");
          try {
            modifiedCode = await callLLMStreaming(
              [
                {
                  role: "system",
                  content: `${systemPrompt}

你现在需要对已有的 HTML 代码进行修改，添加新功能。

**重要规则：**
1. 保留现有代码的所有功能和样式
2. 在现有代码基础上添加新功能
3. 确保新功能与现有代码风格一致
4. 返回完整的 HTML 代码（包含新增功能）
5. 不要返回 markdown 格式，只返回纯 HTML 代码

新功能需求：${featureTitle}
详细描述：${featureDesc}`
                },
                {
                  role: "user",
                  content: `以下是现有代码，请在此基础上添加新功能：\n\n${existingCode}`
                }
              ],
              { max_tokens: 16384, temperature: 0.3, enableThinking: false },
              incLive.push
            );
          } catch (e) {
            console.error("[incremental] LLM 调用失败：", e);
          } finally {
            incLive.flush();
            clearInterval(incHeartbeat);
          }

          const finalCode = extractHtml(modifiedCode);
          const sanitized = sanitizeGeneratedHtml(finalCode);

          // 代码生成失败时直接报错，避免产出空项目
          if (!sanitized || sanitized.length < 2000) {
            send({ type: "workflow_item", number: stepNum + 1, text: "Alex 正在生成修改后的完整代码（失败）", done: true });
            send({ type: "error", message: "代码生成失败，请稍后重试" });
            send({ type: "done" });
            controller.close();
            return;
          }

          // 发送修改后的代码文件（多文件结构：拆分为 index.html / styles / scripts）
          const reactProject = await produceReactProject(sanitized);
          if (reactProject) {
            for (const [incName, incContent] of Object.entries(reactProject.files)) {
              send({ type: "source_file", filename: incName, content: incContent });
            }
            send({ type: "built_preview", html: reactProject.previewHtml });
          } else {
            const incFiles = extractSourceFiles(sanitized, categoryKey);
            for (const [incName, incContent] of Object.entries(incFiles)) {
              send({ type: "source_file", filename: incName, content: incContent });
            }
          }          // 标记 AI 生成步骤完成
          send({ type: "workflow_item", number: stepNum + 1, text: "Alex 正在生成修改后的完整代码", done: true });

          // 静默更新 README.md（不显示在工作流中）
          const updatedReadme = `# ${catLabel}

> 版本 ${versionNum}.0.0 · React + TypeScript + Vite

## 项目简介

${featureTitle} - ${featureDesc}

## 🚀 如何运行

- 方式一（零门槛）：**双击 \`dist/index.html\`**，直接在浏览器使用（服务器已自动构建）。
- 方式二（开发模式）：安装 Node.js 后运行 \`pnpm install && pnpm dev\`。

## 文件说明

- \`src/App.tsx\` — 应用组件（页面结构与交互）
- \`src/main.tsx\` — React 入口
- \`src/index.css\` — Tailwind 指令与自定义样式
- \`tailwind.config.ts\` / \`vite.config.ts\` / \`tsconfig*.json\` — 工程配置
- \`dist/\` — 构建产物（双击 dist/index.html 运行）
- \`README.md\` — 本说明文档

## 版本历史

### v${versionNum}.0.0
- 新增功能：${featureTitle}
- ${featureDesc}

### v1.0.0
- 初始版本
- 基础功能
`;

          send({ type: "source_file", filename: "README.md", content: updatedReadme });

          // 发送最终步骤
          send({ type: "workflow_item", number: stepNum + 2, text: `✓ 版本 ${versionNum} 开发完成：${featureTitle}`, done: true });

          // 发送修改后的代码
          send({ type: "code", content: sanitized });

          // 发送版本完成信息，带增量建议
          const incrementalSuggestions = [
            { title: "优化样式", description: "调整新功能的视觉效果，使其更美观" },
            { title: "添加动画", description: "为新功能添加交互动画效果" },
            { title: "增强功能", description: "进一步完善新功能的细节" },
          ];

          send({
            type: "version_complete",
            version: versionNum,
            category: categoryKey,
            suggestions: incrementalSuggestions
          });

          send({ type: "done" });
          controller.close();
          return;
        }

        if (category && !plan) {
          // ===== 阶段 2a：生成开发计划（待办清单） =====
          const categoryKey = category === "custom" ? "tool" : category;

          const styleInfo = style ? `用户偏好的视觉风格：${style}。` : "";
          const detailInfo = detail ? `用户补充的详情：${detail}。` : "";
          const authInfo = needsAuth ? `\n【用户已勾选「需要用户注册登录」】计划中必须包含「用户注册登录」功能模块（注册、登录、退出登录、个人中心），并在相关模块中说明哪些操作需要登录后才能使用。` : "";

          const userMessage = `${prompt}${styleInfo ? "\n" + styleInfo : ""}${detailInfo ? "\n" + detailInfo : ""}${authInfo}`;

          // 小游戏：用户没指定做什么游戏时，随机从 贪吃蛇/超级玛丽/水果忍者 抽一个；指定了就按用户的来
          let gameThemeNote = "";
          if (categoryKey === "game") {
            const rawGameInput = `${prompt || ""} ${detail || ""}`;
            const detected = detectGameTheme(rawGameInput);
            const preset = detected ?? (hasSpecificGameRequest(rawGameInput) ? null : randomGamePreset());
            if (preset) {
              gameThemeNote = `\n【本次游戏主题】${detected ? "用户指定" : "用户没有指定具体游戏，本次随机抽取"}了「${preset.name}」。计划必须完全围绕这款游戏设计。\n游戏玩法要求：${preset.requirement}\n注意：这是要做成真正可玩的游戏，不是游戏介绍网站。`;
              console.log(`[game] 计划阶段游戏主题：${preset.name}（${detected ? "用户指定" : "随机抽取"}）`);
            }
          }

          // 小工具：用户没指定做什么工具时，从灵感库随机抽一个具体工具；指定了就按用户的来
          let toolThemeNote = "";
          if (categoryKey === "tool") {
            const rawToolInput = `${prompt || ""} ${detail || ""}`;
            if (!hasSpecificToolRequest(rawToolInput)) {
              const preset = randomToolPreset();
              toolThemeNote = `\n【本次工具主题】用户没有指定具体做什么工具，本次随机抽取了「${preset.name}」。计划必须完全围绕这个工具设计。\n工具功能要求：${preset.requirement}\n注意：这是要做成真正能上手使用的工具，不是工具介绍/推广页面。`;
              console.log(`[tool] 计划阶段工具主题：${preset.name}（随机抽取）`);
            } else {
              console.log(`[tool] 用户指定了工具需求，按用户需求设计`);
            }
          }

          // 数据看板：用户没指定具体看板时，默认按「电商运营数据看板」来；指定了就按用户的来
          let dashboardThemeNote = "";
          if (categoryKey === "dashboard") {
            const rawDashInput = `${prompt || ""} ${detail || ""}`;
            if (!hasSpecificDashboardRequest(rawDashInput)) {
              dashboardThemeNote = `\n【本次看板主题】用户没有指定具体做什么看板，本次默认制作「${DASHBOARD_PRESET.name}」。计划必须完全围绕这个看板设计。\n看板内容要求：${DASHBOARD_PRESET.requirement}`;
              console.log(`[dashboard] 计划阶段：默认电商运营数据看板`);
            } else {
              console.log(`[dashboard] 用户指定了看板需求，按用户需求设计`);
            }
          }

          // 计划阶段不发送 workflow_item（避免显示工作流程面板）
          // 只依靠前端的 "Alex 正在分析需求，制定开发计划..." workflow 消息

          const planRes = await callLLM([
            {
              role: "system",
              content: `你是产品规划专家。根据用户的需求和应用类型，生成一份详细的业务功能开发计划。

**重要：这是业务功能需求列表，不是编码步骤！用户看到的是要开发哪些功能模块。**

每个功能项必须包含：
- title: 功能模块标题（如"首页（Apple 风格）"、"产品列表页"、"购物车"）
- description: 该功能模块的详细描述（50-150字，说明具体要实现什么功能）

请以 JSON 数组格式返回，格式如下：
[
  {
    "title": "首页（Apple 风格）",
    "description": "顶部导航栏、全屏产品主视觉轮播、iPhone/Mac/iPad/Watch/AirPods 分类入口、新品推荐与热销榜，采用黑白极简风格 + 大字体 + 滚动动效"
  },
  {
    "title": "产品列表页",
    "description": "按品类浏览全部商品，支持分类筛选、价格区间筛选、关键词搜索与排序（价格/新品/热度）"
  },
  {
    "title": "产品详情页",
    "description": "多图切换、颜色/容量/版本规格选择（不同规格对应不同价格）、参数表、库存状态、加入购物车与立即购买"
  },
  {
    "title": "购物车",
    "description": "增删商品、修改数量、规格展示、小计与总价实时计算，数据持久化到数据库（未登录时本地暂存，登录后合并）"
  },
  {
    "title": "用户账户",
    "description": "基于平台内置认证的注册/登录/登出，个人中心查看账号信息"
  }
]

要求：
${categoryKey === "game"
  ? "- 【这是小游戏】功能模块必须是游戏本身的功能（如：开始界面、核心玩法与操作控制、计分与连击、暂停、结算界面、最高分记录等），而且必须是真正可玩的游戏；绝不要生成\"游戏介绍/官网/下载页/资讯\"这类网站模块"
  : categoryKey === "tool"
    ? "- 【这是小工具】功能模块必须是工具本身的实用功能（单页应用，围绕工具的核心功能设计 4-6 个模块，如：主操作区、结果展示、设置选项、历史记录/统计等）；绝不要生成\"产品介绍/推广/下载/定价\"这类营销模块"
    : categoryKey === "dashboard"
      ? "- 【这是数据看板】功能模块必须是看板本身的数据展示组件（如：核心指标概览卡片、趋势图、排行榜、占比图、明细表、时间范围筛选等），围绕数据设计 4-6 个模块；绝不要生成\"产品介绍/推广\"这类营销模块"
      : "- 生成 6-9 个功能模块，覆盖完整的产品生命周期"}
- 标题要简洁明确，描述要详细具体
- 按用户使用的逻辑顺序排列（首页→列表→详情→购物车→支付→订单→管理）
- 内容必须与用户的具体需求高度相关
- **如果用户需求描述为空或非常简短**：你必须自由发挥，自行确定一个具体的、符合该应用类型特征的项目主题（起一个真实可信的项目名称），功能设计贴近现实生活、内容具体（例如电商要有真实的商品品类和场景，工具要有明确的用途），整体定位美观、实用，绝不用空泛笼统的内容凑数，也不要反问用户
- **如果用户提到了视觉风格**（如颜色、样式、类似某个网站）：每个相关功能模块的描述中都要体现该风格（如"采用 XX 风格/XX 配色"）
- 只返回 JSON 数组，不要其他内容。`,
            },
            { role: "user", content: `用户需求：${userMessage}${gameThemeNote}${toolThemeNote}${dashboardThemeNote}\n应用类型：${categoryKey}` },
          ], { max_tokens: 4096, temperature: 0.7 });

          let planItems: { title: string; description: string; steps?: any[] }[] = [];
          try {
            const jsonMatch = planRes.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
              planItems = JSON.parse(jsonMatch[0]);
            }
          } catch { /* 使用默认 */ }

          if (planItems.length === 0) {
            planItems = [
              {
                title: "首页",
                description: "顶部导航栏、全屏产品主视觉轮播、产品分类入口、新品推荐与热销榜，采用现代极简风格"
              },
              {
                title: "产品列表页",
                description: "按品类浏览全部商品，支持分类筛选、价格区间筛选、关键词搜索与排序"
              },
              {
                title: "产品详情页",
                description: "多图切换、规格选择、参数表、库存状态、加入购物车与立即购买"
              },
              {
                title: "购物车",
                description: "增删商品、修改数量、规格展示、小计与总价实时计算"
              },
              {
                title: "用户账户",
                description: "注册/登录/登出，个人中心查看账号信息"
              },
              {
                title: "订单管理",
                description: "订单列表与订单详情，订单号、商品明细、金额、支付状态"
              },
            ];
          }

          send({ type: "plan", items: planItems, category: categoryKey });
          send({ type: "done" });
          controller.close();
        } else if (plan) {
          // ===== 阶段 2b：用户批准计划，生成代码 =====
          const categoryKey = category === "custom" ? "tool" : category;
          const systemPrompt = CATEGORY_PROMPTS[categoryKey] || CATEGORY_PROMPTS.tool;

          const styleInfo = style ? `用户偏好的视觉风格：${style}。` : "";
          const detailInfo = detail ? `用户补充的详情：${detail}。` : "";
          const authRequirement = needsAuth ? buildAuthRequirement(categoryKey) : "";
          const userMessage = `${prompt}${styleInfo ? "\n" + styleInfo : ""}${detailInfo ? "\n" + detailInfo : ""}`;

          // 是否走「自由生成」路径（不套固定模板）：
          // 1) 用户勾选了注册登录（模板里没有登录流程）
          // 2) 用户指定了视觉风格（颜色/样式/类似某网站），必须按用户风格定制
          // 3) 小游戏分类（固定模板是展示型页面，做不出可玩游戏，必须自由生成）
          // 4) 小工具分类（固定模板是推广页，做不出真正可用的工具，必须自由生成）
          const hasCustomStyle = detectCustomStyle(userMessage);
          const useFreeForm = !!needsAuth || hasCustomStyle || categoryKey === "game" || categoryKey === "tool";

          // 将计划转化为功能要求（支持 steps 字段）
          const planText = plan.map((item: { title: string; description: string; checked?: boolean; steps?: any[] }) =>
            `${item.title}：${item.description}${item.checked === false ? "（用户取消了此功能）" : ""}`
          ).join("\n");

          // 小游戏：确定游戏主题 —— 用户指定了就按用户的来；没指定就随机从 贪吃蛇/超级玛丽/水果忍者 抽一个
          let gameRequirement = "";
          if (categoryKey === "game") {
            const rawGameInput = `${prompt || ""} ${detail || ""} ${planText}`;
            const detected = detectGameTheme(rawGameInput);
            const preset = detected ?? (hasSpecificGameRequest(rawGameInput) ? null : randomGamePreset());
            if (preset) {
              gameRequirement = `\n\n【本次游戏主题（必须遵守）】本次制作「${preset.name}」。玩法要求：${preset.requirement}`;
            }
            gameRequirement += `\n\n【最高优先级：必须可玩】生成的是真正能上手玩的小游戏（Canvas 或 DOM 实现，有游戏循环、真实操作响应、计分、失败/通关判定、再来一局），绝不是游戏介绍页/官网/展示页面。打开页面就是游戏开始界面，点击开始后必须能真正操作游玩。`;
            console.log(`[game] 代码阶段游戏主题：${preset ? preset.name : "用户自定义"}（${detected ? "用户指定" : preset ? "随机抽取" : "按用户需求"}）`);
          }

          // 小工具：用户指定了就按用户的来；没指定就沿用计划阶段随机抽到的工具（保证计划与代码一致）
          let toolRequirement = "";
          if (categoryKey === "tool") {
            const rawToolInput = `${prompt || ""} ${detail || ""} ${planText}`;
            // 计划阶段随机抽到的工具名会写进计划文本，优先沿用
            const inPlan = TOOL_PRESETS.find((p) => rawToolInput.includes(p.name));
            const preset = inPlan ?? (hasSpecificToolRequest(rawToolInput) ? null : randomToolPreset());
            if (preset) {
              toolRequirement = `\n\n【本次工具主题（必须遵守）】本次制作「${preset.name}」。功能要求：${preset.requirement}`;
            }
            toolRequirement += `\n\n【最高优先级：必须真正可用】生成的是真正能上手使用的工具（所有按钮、计算、计时、增删操作都有真实功能），绝不是工具介绍页/推广页/展示页面。`;
            console.log(`[tool] 代码阶段工具主题：${preset ? preset.name : "按用户需求"}（${inPlan ? "沿用计划" : preset ? "随机抽取" : "用户指定"}）`);
          }

          // 数据看板：用户没指定时默认「电商运营数据看板」；指定了就按用户的来
          let dashboardRequirement = "";
          if (categoryKey === "dashboard") {
            const rawDashInput = `${prompt || ""} ${detail || ""}`;
            if (!hasSpecificDashboardRequest(rawDashInput)) {
              dashboardRequirement = `\n\n【本次看板主题（必须遵守）】本次制作「${DASHBOARD_PRESET.name}」。看板内容要求：${DASHBOARD_PRESET.requirement}`;
              console.log(`[dashboard] 代码阶段：默认电商运营数据看板`);
            } else {
              console.log(`[dashboard] 代码阶段：按用户指定的看板需求`);
            }
          }

          // ===== 立刻创建完整项目文件结构（不等 LLM） =====
          const catLabel = getCategoryLabel(categoryKey);
          const activePlanItems = plan.filter((item: any) => item.checked !== false);

          // 标准编码工作流（React + TypeScript + Vite 工程结构，服务器自动构建，dist 双击可运行）
          const allSteps: { text: string; actions: { type: "read_file" | "write_file"; label: string; detail: string }[]; thinking: string }[] = [
            {
              text: "分析需求，规划 React 工程结构",
              actions: [{ type: "write_file", label: "创建项目清单", detail: "package.json" }],
              thinking: `分析需求...\n\n正在规划 ${catLabel} 的工程结构：React 18 + TypeScript + Tailwind CSS + Vite，与主流前端工程保持一致。\n\n核心功能：${plan.slice(0, 3).map((p: any) => p.title).join("、")}`,
            },
            {
              text: "搭建 Vite + TypeScript 脚手架",
              actions: [
                { type: "write_file", label: "写入构建配置", detail: "vite.config.ts" },
                { type: "write_file", label: "写入 TS 配置", detail: "tsconfig.json" },
              ],
              thinking: `搭建脚手架...\n\n生成 vite.config.ts、tsconfig 三件套、tailwind.config.ts、postcss 与 eslint 配置，对齐标准 Vite React-TS 模板。`,
            },
            {
              text: "生成 React 入口与全局样式",
              actions: [
                { type: "write_file", label: "写入入口挂载", detail: "src/main.tsx" },
                { type: "write_file", label: "写入全局样式", detail: "src/index.css" },
              ],
              thinking: `生成入口...\n\nsrc/main.tsx 负责挂载根组件；src/index.css 包含 Tailwind 指令与自定义样式。`,
            },
            {
              text: "实现页面组件与交互逻辑",
              actions: [{ type: "write_file", label: "写入应用组件", detail: "src/App.tsx" }],
              thinking: `实现组件...\n\n把页面结构与交互逻辑写入 src/App.tsx，保留全部功能与动效。`,
            },
            {
              text: "生成网站图标与配置文件",
              actions: [
                { type: "write_file", label: "写入图标", detail: "public/favicon.svg" },
                { type: "write_file", label: "写入 .gitignore", detail: ".gitignore" },
              ],
              thinking: `生成图标与配置...\n\n网站图标会显示在浏览器标签页；.gitignore 排除 node_modules 与 dist。`,
            },
            {
              text: "编写项目说明文档",
              actions: [{ type: "write_file", label: "写入 README", detail: "README.md" }],
              thinking: `编写文档...\n\nREADME.md 说明两种运行方式：双击 dist/index.html 立即使用；或 pnpm install && pnpm dev 本地开发。`,
            },
            {
              text: "服务器自动构建验证（esbuild + Tailwind）",
              actions: [{ type: "read_file", label: "验证构建产物", detail: "dist/index.html" }],
              thinking: `构建验证...\n\n服务器用 esbuild 打包 src/main.tsx、编译 Tailwind 样式，产出 dist/。双击 dist/index.html 即可运行，无需安装任何软件。`,
            },
          ];

          // 收集所有需要生成的文件路径
          const allFilePaths: string[] = [];
          for (const step of allSteps) {
            for (const action of step.actions) {
              if (action.type === "write_file") {
                const filename = action.detail.split(" → ")[0].trim();
                if (!allFilePaths.includes(filename)) allFilePaths.push(filename);
              }
            }
          }

          function genFile(filename: string): string {
            const base = filename.split("/").pop() || filename;
            if (base === "package.json") return `{\n  "name": "atoms-app",\n  "private": true,\n  "version": "1.0.0",\n  "type": "module"\n}\n`;
            if (base === "vite.config.ts") return `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()], base: "./" });\n`;
            if (base === "tsconfig.json") return `{\n  "files": [],\n  "references": [\n    { "path": "./tsconfig.app.json" },\n    { "path": "./tsconfig.node.json" }\n  ]\n}\n`;
            if (base === "main.tsx") return `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(<App />);\n`;
            if (base === "index.css") return `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
            if (base === "App.tsx") return `export default function App() {\n  return <div className="min-h-screen bg-gray-50" />;\n}\n`;
            if (base === "tailwind.config.ts") return `export default { content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"] };\n`;
            if (base === "README.md") return `# ${catLabel}\n\n> React + TypeScript + Vite`;
            if (base === ".gitignore") return "node_modules/\ndist/\n.env\n";
            if (base === "favicon.svg") return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#6366f1"/></svg>`;
            return `// ${base}`;
          }          // 辅助函数：延迟
          const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

          // 发送初始工作流面板
          send({ type: "workflow_panel" });

          // 逐步发送每个工作流步骤（带思考过程）
          for (let i = 0; i < allSteps.length; i++) {
            const step = allSteps[i];

            // 发送步骤（未完成）
            send({
              type: "workflow_item",
              number: i + 1,
              text: step.text,
              done: false,
              actions: step.actions,
            });

            // 发送该步骤的文件
            for (const action of step.actions) {
              if (action.type === "write_file") {
                const filename = action.detail.split(" → ")[0].trim();
                if (allFilePaths.includes(filename)) {
                  send({ type: "source_file", filename, content: genFile(filename) });
                }
              }
            }

            // 标记步骤完成
            send({
              type: "workflow_item",
              number: i + 1,
              text: step.text,
              done: true,
              actions: step.actions,
            });
            await delay(150);
          }

          // 发送额外文件
          const extraFiles: Record<string, string> = {
            ".gitignore": "node_modules/\ndist/\n.env",
            "public/favicon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#6366f1"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="14">A</text></svg>`,
          };
          const extraStepNum = allSteps.length + 1;
          send({ type: "workflow_item", number: extraStepNum, text: "生成额外配置文件（.gitignore、favicon）", done: false, actions: [{ type: "write_file", label: "写入 .gitignore", detail: ".gitignore" }] });
          for (const [name, content] of Object.entries(extraFiles)) {
            if (!allFilePaths.includes(name)) send({ type: "source_file", filename: name, content });
          }
          send({ type: "workflow_item", number: extraStepNum, text: "生成额外配置文件（.gitignore、favicon）", done: true, actions: [{ type: "write_file", label: "写入 .gitignore", detail: ".gitignore" }] });

          // ===== 阶段 3：生成完整页面代码 =====
          let fullCode = "";
          let stepCounter = extraStepNum;

          // 路径 A：自由生成 —— 用户指定了风格 / 勾选了注册登录时，完全按需求定制（不套固定模板）
          if (useFreeForm) {
            stepCounter += 1;
            const freeStepText = categoryKey === "game"
              ? "编写小游戏完整玩法代码（可操作游玩）"
              : categoryKey === "tool"
                ? "编写小工具完整功能代码（真实可用）"
                : hasCustomStyle && needsAuth
                  ? "按用户指定风格定制页面，并实现注册登录流程"
                  : hasCustomStyle
                    ? "按用户指定风格定制页面（不使用固定模板）"
                    : "实现完整注册登录流程，生成页面代码";
            send({ type: "workflow_item", number: stepCounter, text: freeStepText, done: false });

            const styleRule = hasCustomStyle
              ? `\n\n【最高优先级：用户指定了视觉风格】用户在需求中明确指定了视觉风格（颜色/样式/参考网站等）。你必须严格按用户描述的风格设计整体视觉：主题色、背景氛围、字体的感觉、布局气质都要与用户描述一致，禁止使用默认或大众化配色。例如用户说"类似苹果官网/Apple 风格"就用黑白极简 + 大字号 + 充足留白；说"粉色/少女风"就整体使用粉色系；说"黑金风"就用深色背景 + 金色点缀。`
              : "";

            let freeRes = "";
            const freeLive = makeLiveChunker(send, "code_chunk");
            // 长代码生成期间定时发心跳，防止 SSE 连接因长时间无数据被客户端/代理切断
            const heartbeat = setInterval(() => {
              send({ type: "heartbeat" });
            }, 15000);
            try {
              // 用流式调用：长代码生成（8192 tokens）非流式会超过 HTTP 头超时
              freeRes = await callLLMStreaming(
                [
                  {
                    role: "system",
                    content: `${systemPrompt}${styleRule}${gameRequirement}${toolRequirement}${dashboardRequirement}\n\n【开发计划（必须逐一实现）】请实现以下全部功能模块（标注"用户取消了此功能"的跳过），功能要完整可用、设计精美：\n${planText}${authRequirement}`,
                  },
                  { role: "user", content: `用户需求：${userMessage}\n应用类型：${categoryKey}${needsAuth ? "\n\n【再次强调】用户勾选了需要注册登录，生成的页面必须包含完整的注册/登录弹窗和登录状态切换，缺少登录功能视为不合格。" : ""}${categoryKey === "game" ? "\n\n【再次强调】必须是真正可玩的游戏：有游戏循环、键盘/鼠标/触摸操作、计分和失败判定，点击开始就能玩；只做介绍页或静态展示页视为不合格。" : ""}${categoryKey === "tool" ? "\n\n【再次强调】必须是真正可用的工具：所有按钮、计算、计时、增删操作都有真实功能，数据能保存；只做介绍页或推广页视为不合格。" : ""}` },
                ],
                { max_tokens: 16384, temperature: 0.5, enableThinking: false },
                freeLive.push
              );
            } catch (e) {
              console.error("[freeform] LLM 调用失败：", e);
            } finally {
              freeLive.flush();
              clearInterval(heartbeat);
            }
            console.log(`[freeform] 生成 ${freeRes.length} 字符 | 含登录: ${freeRes.includes("登录")} | 结尾: ${JSON.stringify(freeRes.slice(-30))}`);

            let freeHtml = "";
            try { freeHtml = sanitizeGeneratedHtml(extractHtml(freeRes)); } catch { /* ignore */ }
            if (freeHtml.length > 2000) {
              // 交付前防线：jsdom 冒烟验证一次，发现运行期错误（如按钮点击无反应、脚本报错）就让 LLM 自动修复一次
              let issues = await validateGeneratedHtml(freeHtml);
              if (issues.length > 0) {
                console.warn(`[freeform] 冒烟验证发现 ${issues.length} 个问题，自动修复：`, issues);
                send({ type: "workflow_item", number: stepCounter, text: "冒烟验证代码，自动修复发现的问题", done: false });
                const fixHeartbeat = setInterval(() => { send({ type: "heartbeat" }); }, 15000);
                try {
                  const fixRes = await callLLMStreaming(
                    [
                      {
                        role: "system",
                        content: `${systemPrompt}\n\n【修复任务】下面这段页面代码运行时存在错误。请保持功能、布局、视觉设计完全不变，只修复列出的错误，然后输出修复后的完整 HTML（从 <!DOCTYPE html> 到 </html>，完整不省略，不要输出任何解释文字）。\n修复提示：如果错误是 "Cannot access 'xxx' before initialization" 或 "xxx is not defined"，通常是全局对象用了 const/let 声明、或构造函数里引用了尚未赋值的全局变量——改为先 var 声明、类定义完成后再赋值，并把依赖该全局变量的初始化逻辑移到实例化之后调用。`,
                      },
                      {
                        role: "user",
                        content: `运行时发现的错误：\n${issues.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n原始代码：\n${freeHtml}`,
                      },
                    ],
                    { max_tokens: 16384, temperature: 0.2, enableThinking: false },
                    freeLive.push
                  );
                  let fixedHtml = "";
                  try { fixedHtml = sanitizeGeneratedHtml(extractHtml(fixRes)); } catch { /* ignore */ }
                  if (fixedHtml.length > 2000) {
                    const issues2 = await validateGeneratedHtml(fixedHtml);
                    if (issues2.length <= issues.length) {
                      freeHtml = fixedHtml;
                      issues = issues2;
                      console.log(`[freeform] 自动修复完成，剩余问题 ${issues2.length} 个`);
                    } else {
                      console.log(`[freeform] 修复后问题变多（${issues2.length}），保留原代码`);
                    }
                  }
                } catch (e) {
                  console.error("[freeform] 自动修复失败：", e);
                } finally {
                  freeLive.flush();
                  clearInterval(fixHeartbeat);
                }
                send({ type: "workflow_item", number: stepCounter, text: "冒烟验证代码，自动修复发现的问题", done: true });
              }
              fullCode = freeHtml;
              send({ type: "workflow_item", number: stepCounter, text: freeStepText, done: true });
            } else {
              send({ type: "workflow_item", number: stepCounter, text: `${freeStepText}（改用备选方案）`, done: true });
            }
          }

          // 小游戏绝不能回退到展示型模板（会变成游戏官网），宁可提示失败
          if (!fullCode && categoryKey === "game") {
            send({ type: "workflow_item", number: stepCounter + 1, text: "游戏生成失败", done: true });
            send({ type: "error", message: "游戏生成失败，请稍后重新点击开始" });
            send({ type: "done" });
            controller.close();
            return;
          }

          // 路径 B：模板渲染 —— 无自定义风格且无登录要求时使用；或自由生成失败时兜底
          if (!fullCode) {
            stepCounter += 1;
            const templateStepNum = stepCounter;
            send({ type: "workflow_item", number: templateStepNum, text: "分析应用类型，选择最合适的模板", done: false });

            // 选择匹配的模板
            const template = getTemplateByCategory(categoryKey) || getTemplateByCategory("general");
            if (!template) {
              send({ type: "error", message: "未找到匹配的模板" });
              send({ type: "done" });
              controller.close();
              return;
            }
            const templateData = getDefaultTemplateData(categoryKey);
            send({ type: "workflow_item", number: templateStepNum, text: "分析应用类型，选择最合适的模板", done: true });

            // 让 LLM 生成内容计划
            stepCounter += 1;
            const contentStepNum = stepCounter;
            send({ type: "workflow_item", number: contentStepNum, text: "调用内容引擎生成与需求匹配的内容方案", done: false });

            let contentPlan: Record<string, any> = {};
            try {
              const contentRes = await callLLM([
                {
                  role: "system",
                  content: `你是一个内容策划专家。根据用户的需求和应用类型，生成一组用于填充网页模板的内容数据。

**最重要：所有内容必须与用户的具体需求高度相关！如果用户说的是水果，所有商品、标题、描述都必须是水果相关的。**

**如果用户的需求描述为空或非常简短**：你必须自由发挥，自行确定一个具体的、符合该应用类型的项目主题，编出真实可信的品牌名、商品/功能内容和文案（内容要贴近现实、具体、有吸引力），绝不使用"示例商品1"这类占位内容。

你需要返回一个 JSON 对象，包含以下字段（根据应用类型调整）：

对于电商（ecommerce）：
- title: 网页标题（与用户需求相关）
- brandName: 品牌/产品名称（2-5个字，好记）
- brandLogo: 品牌标志（取 brandName 的第一个字，只要 1 个字）
- brandDesc: 品牌简介（一句话）
- primaryColor: 主题色，必须贴合商品气质（水果生鲜用清新绿如"#22c55e"、科技数码用蓝紫如"#6366f1"、美食烘焙用暖橙如"#f97316"、服饰美妆用玫红如"#ec4899"，不要总用同一种颜色）
- secondaryColor: 辅助色（与 primaryColor 协调的邻近色）
- badgeText: 主视觉上方的小徽章文案（4-10个字，概括核心卖点，如"产地直采 · 冷链直达"）
- heroTitle: 主标题（一句话，有吸引力）
- heroSubtitle: 副标题（一句话描述）
- sectionTitle: 商品区域标题
- categories: 4个分类对象，每个含 catName, catActive（第一个为 "bg-primary text-white"，其余为 "bg-gray-100 text-gray-600"）。**第一个分类的 catName 固定为"全部"，其余3个分类的 catName 必须与商品的 productCategory 完全一致（一字不差），用于点击筛选商品**
- products: 8个商品对象（每个分类下至少2个商品），每个含：
  - productId: 商品ID（数字，从1开始递增）
  - productName: 商品名称（必须与用户需求相关）
  - productPrice: 价格（数字）
  - originalPrice: 原价（数字，比 productPrice 高）
  - productCategory: 分类（必须等于 categories 中某一个分类按钮的 catName，不能出现分类按钮之外的分类名）
  - productImage: 商品图片（必须使用 SVG data URI 格式，内嵌与商品相关的 emoji。水果用🍎🍊🍌🍇，电子用📱💻🎧⌚，服装用👕👗👟👜）。格式：data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23颜色1'/%3E%3Cstop offset='100%25' stop-color='%23颜色2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23g)'/%3E%3Ctext x='200' y='220' font-size='120' text-anchor='middle' dominant-baseline='middle'%3E商品emoji%3C/text%3E%3C/svg%3E。每个商品用不同的渐变色和对应 emoji。

对于通用落地页（tool/showcase）：
- title, brandName, brandDesc, primaryColor, secondaryColor
- heroTitle, heroSubtitle, ctaTitle, ctaSubtitle, ctaText
- features: 3个功能对象，每个含 featureIcon(emoji), featureTitle, featureDesc, featureColor
- plans: 3个定价方案，每个含 planName, planDesc, planPrice, planUnit, planFeatures(数组), planBtnText
- stats: 4个数据，每个含 statValue, statLabel
- testimonials: 3条评价，每个含 reviewText, reviewerName, reviewerTitle, reviewerInitial

对于仪表盘（dashboard），字段名必须与下方完全一致（模板按这些字段名填充，写错会导致页面显示异常）：
- title: 网页标题
- pageTitle: 页面主标题（如"运营数据概览"）
- pageSubtitle: 副标题（一句话说明数据范围，如"近 7 天经营数据实时更新"）
- brandName: 品牌名（2-5个字）
- brandLogo: 品牌标志（取 brandName 的第一个字，只要 1 个字）
- primaryColor: 主题色（深色看板推荐靛蓝"#6366f1"、青绿"#14b8a6"、科技蓝"#3b82f6"等）
- secondaryColor: 辅助色（与 primaryColor 协调的邻近色）
- stats: 4个统计卡片对象，每个含 statLabel(指标名), statValue(指标值，如"¥128,560"), statChange(涨跌幅文案，如"+12.5%"或"-3.2%"), statTrend(上涨填"text-green-400"，下跌填"text-red-400")
- chart1Title: 柱状图标题
- chart1Bars: 6-7个柱子对象，每个含 barLabel(标签，如"周一"或"1月"), barHeight(柱高百分比，20-80 之间的数字，数值要有高低起伏)
- chart2Title: 占比图标题
- chart2Items: 4-5个条目对象，每个含 itemLabel(名称), itemValue(数值文案，如"35%"), itemPercent(百分比，0-100 的数字，与 itemValue 一致)
- tableTitle: 明细表标题
- tableHeaders: 字符串数组（4-6个列名）
- tableRows: 5-6行对象，每个含 rowCells(字符串数组，个数必须与 tableHeaders 完全一致)
- navItems: 4-6个侧边栏菜单对象，每个含 navIcon(emoji图标), navLabel(菜单名), navActive(第一个菜单填"active"，其余填"")

对于博客（community）：
- brandName, brandDesc
- featuredTag, featuredTitle, featuredDesc, featuredAuthor, featuredDate, featuredEmoji
- articles(文章列表)

要求：
1. **内容必须与用户的具体需求高度相关**
2. 标题要有吸引力，描述要具体
3. 颜色搭配要专业
4. 只返回 JSON 对象，不要其他内容`,
              },
              { role: "user", content: `用户需求：${userMessage}${dashboardRequirement}\n应用类型：${categoryKey}` },
            ], { max_tokens: 4096, temperature: 0.7 });

            const jsonMatch = contentRes.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              contentPlan = JSON.parse(jsonMatch[0]);
              send({ type: "workflow_item", number: contentStepNum, text: "调用内容引擎生成与需求匹配的内容方案", done: true });
            }
          } catch {
            send({ type: "workflow_item", number: contentStepNum, text: "调用内容引擎生成与需求匹配的内容方案（使用默认方案）", done: true });
          }

            // 合并默认数据和 LLM 生成的内容
            const mergedData = { ...templateData, ...contentPlan };

            // 渲染模板
            stepCounter += 1;
            const renderStepNum = stepCounter;
            send({ type: "workflow_item", number: renderStepNum, text: "将内容填充到模板，生成完整代码", done: false });
            fullCode = renderTemplate(template.content, mergedData);
            send({ type: "workflow_item", number: renderStepNum, text: "将内容填充到模板，生成完整代码", done: true });
          }

          send({ type: "code", content: fullCode });

          // 转换为 React + TypeScript 工程并自动构建（失败时回退 HTML 多文件输出）
          const convertStepNum = stepCounter + 1;
          send({ type: "workflow_item", number: convertStepNum, text: "转换为 React + TypeScript 工程并自动构建", done: false });
          const reactProject = await produceReactProject(fullCode);
          if (reactProject) {
            for (const [filename, content] of Object.entries(reactProject.files)) {
              send({ type: "source_file", filename, content });
            }
            send({ type: "built_preview", html: reactProject.previewHtml });
            send({ type: "workflow_item", number: convertStepNum, text: "转换为 React + TypeScript 工程并自动构建", done: true });
          } else {
            const sourceFiles = extractSourceFiles(fullCode, categoryKey);
            for (const [filename, content] of Object.entries(sourceFiles)) {
              send({ type: "source_file", filename, content });
            }
            send({ type: "workflow_item", number: convertStepNum, text: "转换为 React + TypeScript 工程并自动构建（已回退多文件版）", done: true });
          }

          // ===== 阶段 4：代码完成，生成 README.md 项目文档 =====
          const readmeStepNum = convertStepNum + 1;
          send({ type: "workflow_item", number: readmeStepNum, text: "生成项目说明文档 README.md", done: false });

          let readmeRes = "";
          try {
            readmeRes = await callLLM([
            {
              role: "system",
              content: `你是一个技术文档专家。根据已完成的项目代码和需求，生成一份专业、详细的 README.md 项目文档。

README.md 应包含以下部分：

# 项目名称（根据需求起一个合适的名字）

## 📖 项目简介
详细描述项目的用途、目标用户和核心价值（2-3 段）。

## ✨ 功能特性
列出项目的所有主要功能（使用 - 列表格式，每个功能配简短说明）。

## 🛠️ 技术栈
列出使用的技术：
- React 18 + TypeScript
- Tailwind CSS + Vite
- 数据存储方案（localStorage）

## 📁 项目结构
说明项目的文件结构和各部分功能。

## 🚀 使用方法
详细说明如何运行和使用，包括：
- 零门槛：直接双击 dist/index.html 打开使用
- 二次开发：安装 Node.js 后运行 pnpm install && pnpm dev
- 各功能的操作方式
- 数据存储说明

## 📋 开发计划回顾
列出已批准的开发计划及完成情况（使用 - [x] 清单格式）。

## 📝 核心代码说明
简要说明代码的主要模块和实现逻辑。

要求：
- 使用 Markdown 格式，排版美观
- 内容详细、专业、清晰
- 直接输出 Markdown 内容，不要用代码块包裹
- 根据实际生成的代码来写，不要凭空捏造功能`,
            },
            { role: "user", content: `用户需求：${userMessage}\n应用类型：${categoryKey}\n开发计划：\n${planText}\n\n【已生成的代码概要】\n代码长度：${fullCode.length} 字符\n包含标签：${fullCode.match(/<\w+/g)?.slice(0, 20).join(", ") || "N/A"}` },
          ], { max_tokens: 4096, temperature: 0.5 });
          } catch (e) {
            console.error("[readme] LLM 调用失败：", e);
          }

          send({ type: "readme", content: readmeRes || `# 项目\n\n## 简介\n${userMessage}\n\n## 功能\n${planText}` });

          // 获取增量开发建议
          let suggestionsRes = "";
          try {
            suggestionsRes = await callLLM([
            {
              role: "system",
              content: `你是产品规划专家。根据已完成的应用，建议 3 个可以增量开发的功能扩展。

请以 JSON 数组格式返回，格式如下：
[
  {
    "title": "功能名称（简短，4-8 个字）",
    "description": "功能描述（20-50 字）"
  }
]

只返回 JSON 数组，不要其他内容。`,
            },
            { role: "user", content: `已完成的应用类型：${categoryKey}\n用户需求：${userMessage}` },
          ], { max_tokens: 1024, temperature: 0.7 });
          } catch (e) {
            console.error("[suggestions] LLM 调用失败：", e);
          }

          let suggestions = [
            { title: "用户认证", description: "添加用户注册登录功能，支持数据持久化" },
            { title: "数据导出", description: "支持将数据导出为 CSV/Excel 格式" },
            { title: "主题切换", description: "添加深色/浅色主题切换功能" },
          ];

          try {
            const jsonMatch = suggestionsRes.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
              suggestions = JSON.parse(jsonMatch[0]);
            }
          } catch { /* 使用默认建议 */ }

          // 更新 README.md，添加版本完成信息
          const completedReadme = `# ${catLabel}\n\n> 版本 1.0.0 · React + TypeScript + Vite\n\n## 项目简介\n\n${userMessage}\n\n## 🚀 如何运行\n\n- 方式一（零门槛）：**双击 \`dist/index.html\`**，直接在浏览器使用（服务器已自动构建，无需安装任何软件）。\n- 方式二（开发模式）：安装 Node.js 后运行 \`pnpm install && pnpm dev\`，热更新开发。\n\n## 功能模块\n\n${planText.split("\n").map((line: string) => `- ${line.replace(/^.*?：/, "")}`).join("\n")}\n\n## 文件说明\n\n- \`src/App.tsx\` — 应用组件（页面结构与交互）\n- \`src/main.tsx\` — React 入口\n- \`src/index.css\` — Tailwind 指令与自定义样式\n- \`index.html\` — Vite 入口页面\n- \`vite.config.ts\` / \`tsconfig*.json\` — 工程配置\n- \`tailwind.config.ts\` / \`postcss.config.js\` — 样式配置\n- \`eslint.config.js\` — 代码规范配置\n- \`dist/\` — 构建产物（双击 dist/index.html 运行）\n- \`public/favicon.svg\` — 网站图标\n- \`README.md\` — 本说明文档\n\n## 版本历史\n\n### v1.0.0 ✅\n- 初始版本开发完成\n- 所有功能模块已实现\n- ${planText.split("\n").map((line: string) => line.replace(/^.*?：/, "")).slice(0, 3).join("\n- ")}\n`;
          send({ type: "source_file", filename: "README.md", content: completedReadme });

          send({
            type: "version_complete",
            version: 1,
            category: categoryKey,
            suggestions,
          });
          send({ type: "done" });
          controller.close();
        } else {
          // ===== 阶段 1：返回表单（随机分类描述） =====
          send({ type: "thinking", text: "Alex 正在分析你的需求..." });

          // 意图识别：判断用户想要什么
          const intent = detectIntent(prompt);

          if (intent === "qa") {
            // ===== 问答对话意图 =====
            send({ type: "thinking", text: "💬 Alex 正在详细解答..." });
            // LLM 流式详细回答
            const qaRes = await fetch(`${BASE_URL}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY}`,
              },
              body: JSON.stringify({
                model: MODEL,
                messages: [
                  { role: "system", content: `你是 Alex，Atoms 平台的全栈工程师。你友好、专业，用中文和用户交流。

当用户向你问好、打招呼或让你介绍自己时，请这样回答：
"你好！我是 Alex，你的全栈工程师。我可以帮你开发网页应用或小游戏。今天想做点什么呢？"

请用简洁友好的语气回答用户问题。如果涉及技术内容，请给出具体示例。回答要有深度但易于理解。` },
                  { role: "user", content: prompt },
                ],
                stream: true,
                max_tokens: 4096,
                temperature: 0.7,
              }),
            });

            // 流式返回答案
            let fullAnswer = "";
            if (qaRes.body) {
              const reader = qaRes.body.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                  if (!line.startsWith("data: ")) continue;
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || "";
                    if (content) {
                      fullAnswer += content;
                      send({ type: "answer_chunk", content });
                    }
                  } catch { /* ignore */ }
                }
              }
            }
            send({ type: "answer", content: fullAnswer });
            send({ type: "done" });
            controller.close();
            return; // 已经 done 了，直接返回
          } else {
            // ===== Web 应用意图 → 显示分类表单 =====
            send({ type: "workflow_step", text: "🚀 Alex 已启动，正在分析你的需求..." });

            const randomCategories = getRandomCategories();

            send({
              type: "form",
              categories: randomCategories,
              prompt,
            });

            send({ type: "done" });
            controller.close();
          }
        }
      } catch (e) {
        console.error("[agent] 流程异常：", e);
        send({ type: "error", message: "服务异常，请稍后重试" });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
