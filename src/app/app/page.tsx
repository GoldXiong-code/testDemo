"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, Code, RotateCcw, Download, Eye, CheckCircle2, Plus } from "lucide-react";
import Link from "next/link";
import { getCurrentUser, getClientId } from "@/lib/store";

interface FileAction {
  type: "read" | "write";
  filename: string;
}

interface WorkflowStepItem {
  text: string;
  files: FileAction[];
}

interface WorkflowTimelineItem {
  number: number;
  text: string;
  done: boolean;
  actions?: { type: "read_file" | "write_file" | "run_command"; label: string; detail?: string }[];
}

interface ChatMessage {
  id: string;
  role: "user" | "alex";
  content: string;
  type: "text" | "workflow" | "form" | "code" | "workflow_steps" | "workflow_timeline" | "version_complete" | "plan" | "stop" | "thinking";
  categories?: { key: string; label: string; icon: string; desc?: string }[];
  prompt?: string;
  code?: string;
  workflowSteps?: WorkflowStepItem[];
  workflowTimeline?: WorkflowTimelineItem[];
  version?: number;
  category?: string;
  suggestions?: { title: string; description: string }[];
  planItems?: { title: string; description: string; checked: boolean; steps?: { text: string; files: { type: string; filename: string }[] }[] }[];
  groupId?: number;
  _isStreamingAnswer?: boolean;
  _isTyping?: boolean;
  _isThinking?: boolean;
  _liveMark?: boolean;
}

// 从代码流中实时推导"AI 行动解说"（保持既有的简洁小字行 UI 风格，不用气泡）
function describeCodeMarks(tail: string, totalLen: number, shown: Set<string>): string[] {
  const out: string[] = [];
  const tryMark = (key: string, re: RegExp, label: string) => {
    if (!shown.has(key) && re.test(tail)) {
      shown.add(key);
      out.push(label);
    }
  };
  if (!shown.has("start")) {
    shown.add("start");
    out.push("开始编写代码，行动实时可见…");
  }
  tryMark("style", /<style[\s>]/i, "正在编写页面样式…");
  tryMark("canvas", /<canvas[\s>]/i, "正在创建游戏画布…");
  tryMark("logic", /function\s+\w+\s*\(|addEventListener\(|onclick\s*=/, "正在编写交互逻辑…");
  tryMark("storage", /localStorage\./, "正在接入本地存储…");
  const counts: [string, number][] = [["c1", 10000], ["c2", 20000], ["c3", 30000]];
  for (const [key, n] of counts) {
    if (!shown.has(key) && totalLen >= n) {
      shown.add(key);
      out.push(`已编写约 ${n.toLocaleString()} 字符，继续中…`);
    }
  }
  return out;
}

const WORKFLOW_STEPS = [
  { key: "start", label: "🚀 Alex 已启动，正在分析你的需求..." },
  { key: "analyze", label: "🔍 需求分析中，正在确认应用类型和功能范围..." },
  { key: "form", label: "📋 请选择应用方向，并补充具体需求细节：" },
  { key: "plan", label: "📐 Alex 正在制定开发计划..." },
  { key: "build", label: "⚙️ Alex 正在按计划开发你的应用..." },
  { key: "done", label: "✅ 开发完成！你可以在右侧预览和编辑代码。" },
];

function AppContent() {
  const router = useRouter();
  // 直接读 window.location 的查询参数，替代 useSearchParams。
  // 原因：useSearchParams 会让页面在静态/ISR 渲染时触发 "bailout to client-side rendering"，
  // 该 bailout 在客户端迟迟不 resolve，导致 /app 页面永远卡在「加载中...」。
  // 改用 window.location 后，页面可完全静态渲染（响应带 Content-Length、不流式），
  // 既避免「加载中」卡死，也避免流式响应在部分网络下被「连接被终断」。
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  // 检查是否"从首页新进入"（URL 参数 fresh=1）
  const isFreshStart = searchParams.get("fresh") === "1";

  // 从 localStorage 恢复项目状态
  const getStoredProject = () => {
    if (typeof window === "undefined") return {};
    const u = getCurrentUser();
    if (!u) return {};
    if (isFreshStart) {
      // 从首页新进入 → 清除旧数据
      localStorage.removeItem(`atoms_project_${u.name}`);
      return {};
    }
    // 刷新浏览器 → 恢复之前的工作
    try {
      const stored = localStorage.getItem(`atoms_project_${u.name}`);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  };
  const storedProject = getStoredProject();

  const [user, setUser] = useState<{ name: string } | null>(null);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(storedProject.messages || []);
  const [loading, setLoading] = useState(false);
  const [planPending, setPlanPending] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [previewCode, setPreviewCode] = useState<string>(storedProject.previewCode || "");
  const [editorFiles, setEditorFiles] = useState<Record<string, string>>(storedProject.editorFiles || {});
  const [activeFile, setActiveFile] = useState<string>(storedProject.activeFile || "README.md");
  const [showPreview, setShowPreview] = useState<boolean>(storedProject.showPreview || false);
  const [activeView, setActiveView] = useState<"preview" | "editor" | "cloud">(storedProject.activeView || "preview");
  const [currentStep, setCurrentStep] = useState<number>(storedProject.currentStep || 0);
  const [currentVersion, setCurrentVersion] = useState<number>(storedProject.currentVersion || 1); // 跟踪当前版本号（刷新页面后从 localStorage 恢复）
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["src", "src/styles", "src/components", "src/utils", "src/data"]));
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(new Set());

  // 表单状态
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [detailInput, setDetailInput] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [approvedPlanIds, setApprovedPlanIds] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const triggeredRef = useRef(false);
  const stoppedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  const nextGroupId = useRef(1);
  const currentPromptRef = useRef(""); // 记录最新的用户输入（供 handleFormSubmit 使用）
  // 代码基线：记录每次生成时的文件内容，用于判断"用户是否改过代码"和"丢弃更改"还原
  const baselineFilesRef = useRef<Record<string, string>>({ ...(storedProject.editorFiles || {}) });

  // 项目持久化身份：userId（登录用户）/ clientId（未登录设备 ID）/ projectId（当前项目，增量开发时复用）
  const identityRef = useRef<{ userId: string; clientId: string; projectId: string }>({ userId: "", clientId: "", projectId: storedProject.currentProjectId || "" });
  const [currentProjectId, setCurrentProjectId] = useState<string>(storedProject.currentProjectId || "");
  // 历史项目列表（Atoms 云面板）
  const [historyProjects, setHistoryProjects] = useState<{ id: string; title: string; category: string; prompt: string; updatedAt: string; _count?: { versions: number } }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 持久化项目状态到 localStorage
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(`atoms_project_${user.name}`, JSON.stringify({
        messages,
        previewCode,
        editorFiles,
        activeFile,
        showPreview,
        activeView,
        currentStep,
        currentVersion,
        currentProjectId,
      }));
    } catch { /* storage full or unavailable */ }
  }, [user, messages, previewCode, editorFiles, activeFile, showPreview, activeView, currentStep, currentVersion, currentProjectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.push("/login");
      return;
    }
    setUser(u);
    identityRef.current.userId = u.id;
    identityRef.current.clientId = getClientId();

    const urlPrompt = searchParams.get("prompt");
    const urlFresh = searchParams.get("fresh");
    // 清理 URL 参数（去掉 fresh 和 prompt，保持干净的 /app 路径）
    if (urlPrompt || urlFresh) {
      router.replace("/app");
    }
    if (urlPrompt && !triggeredRef.current) {
      triggeredRef.current = true;
      setTimeout(() => handleSend(urlPrompt), 300);
    }
  }, []);

  // 当当前任务完成时，处理队列中的下一个
  const handleSendRef = useRef<((text: string) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!loading && !planPending && queue.length > 0) {
      const next = queue[0];
      setQueue((prev) => prev.slice(1));
      setTimeout(() => {
        handleSendRef.current?.(next);
      }, 500);
    }
  }, [loading, planPending, queue]);

  const handleSend = async (overridePrompt?: string) => {
    const text = overridePrompt || inputText;
    if (!text.trim()) return;
    // 防重入：如果正在流式处理，忽略新请求
    if (isStreamingRef.current) return;
    isStreamingRef.current = true;
    setInputText("");
    currentPromptRef.current = text; // 记录用户输入，供 handleFormSubmit 使用

    const lowerText = text.toLowerCase();
    const isResume = !loading && (text === "开始" || text === "继续" || lowerText.includes("继续") || lowerText.includes("接着做"));
    const isNewTask = lowerText.includes("重新生成") || lowerText.includes("重新做") || lowerText.includes("新的") || lowerText.includes("换一个");

    // 重新生成 → 清空状态，开始全新工作
    if (isNewTask) {
      abortControllerRef.current?.abort();
      setMessages([]);
      setPreviewCode("");
      setEditorFiles({});
      baselineFilesRef.current = {};
      setCurrentVersion(1); // 新项目从版本 1 重新开始
      setActiveFile("index.html");
      setCurrentStep(0);
      setSelectedCategory("");
      setCustomCategory("");
      setDetailInput("");
      setNeedsAuth(false);
        setApprovedPlanIds(new Set());
      setQueue([]);
      nextGroupId.current = 1;
    }

    // 如果正在生成中或计划等待批准中（且不是继续/新任务），加入队列
    if ((loading || planPending) && !isResume && !isNewTask) {
      setQueue((prev) => [...prev, text]);
      return;
    }

    // 已有应用 → 后续输入视为"修改/修复当前应用"（修 Bug 闭环），而不是新建项目
    const hasExistingApp = !!previewCode && previewCode.length > 100;
    if (hasExistingApp && !isNewTask) {
      handleModify(text);
      return;
    }

    // 中断之前的请求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setCurrentStep(0);
    stoppedRef.current = false;

    // 先做意图识别
    let detectedIntent = "webapp";
    try {
      const intentRes = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
        signal: controller.signal,
      });
      const intentData = await intentRes.json();
      detectedIntent = intentData.intent || "webapp";
    } catch {
      if (controller.signal.aborted) { setLoading(false); isStreamingRef.current = false; return; }
      detectedIntent = "webapp";
    }

    // 非 webapp 意图 → 简化流程，直接显示回答
    if (detectedIntent !== "webapp") {
      const gid = nextGroupId.current;
      nextGroupId.current += 1;

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", content: text, type: "text", groupId: gid },
      ]);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "alex", content: "工程师", type: "text", groupId: gid },
      ]);

      // 添加流式回答占位消息（显示"正在输入"提示）
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "alex",
          content: "Alex 正在输入...",
          type: "text",
          groupId: gid,
          _isStreamingAnswer: true,
          _isTyping: true,
        },
      ]);

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
          signal: controller.signal,
        });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answerAccum = "";  // 用 ref 累加回答内容

        while (true) {
          if (stoppedRef.current) break;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "answer_chunk") {
                answerAccum += data.content;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  const last = newMsgs[newMsgs.length - 1];
                  if (last?._isStreamingAnswer) {
                    last.content = answerAccum;
                    delete last._isTyping;
                  }
                  return newMsgs;
                });
              } else if (data.type === "answer") {
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  const last = newMsgs[newMsgs.length - 1];
                  if (last?._isStreamingAnswer) {
                    delete last._isStreamingAnswer;
                  }
                  return newMsgs;
                });
              } else if (data.type === "error") {
                setMessages((prev) => [
                  ...prev,
                  { id: (Date.now() + Math.random()).toString(), role: "alex", content: data.message, type: "text", groupId: gid },
                ]);
              }
            } catch { /* ignore */ }
          }
        }
      } catch {
        if (controller.signal.aborted) {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + Math.random()).toString(), role: "alex", content: "用户要求停止，已停止。", type: "stop", groupId: gid },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + Math.random()).toString(), role: "alex", content: "❌ 服务异常，请稍后重试。", type: "text" },
          ]);
        }
      }
      setLoading(false);
      isStreamingRef.current = false;
      return;
    }

    // webapp 意图 → 先尝试从 prompt 自动识别分类
    setSelectedCategory("");
    setCustomCategory("");
    setDetailInput("");
    setNeedsAuth(false);

    // 从 prompt 关键词自动识别分类
    const categoryMap: { key: string; keywords: string[] }[] = [
      { key: "ecommerce", keywords: ["电商", "商城", "卖", "商店", "购物", "商品", "店铺", "淘宝", "京东"] },
      { key: "game", keywords: ["游戏", "小游戏", "玩耍", "对战", "贪吃蛇", "贪食蛇", "超级玛丽", "马里奥", "玛丽", "水果忍者", "切水果", "俄罗斯方块", "消消乐", "跑酷", "扫雷", "五子棋", "象棋", "围棋", "打砖块", "飞机大战", "2048", "flappy", "来一局"] },
      { key: "social", keywords: ["社交", "聊天", "论坛", "社区", "交友", "博客"] },
      { key: "education", keywords: ["教育", "学习", "课程", "培训", "教学", "考试"] },
      { key: "content", keywords: ["内容", "资讯", "新闻", "视频", "音乐", "阅读"] },
      { key: "tool", keywords: ["工具", "计算", "转换", "换算", "待办", "清单", "记录", "效率", "番茄钟", "倒计时", "计时器", "房贷", "记账", "打卡", "密码生成", "吃什么", "选择器", "抽签"] },
      { key: "dashboard", keywords: ["看板", "仪表盘", "大屏", "报表", "统计图", "图表", "运营监控", "监控看板"] },
    ];
    let autoCategory = "";
    for (const cat of categoryMap) {
      if (cat.keywords.some(k => lowerText.includes(k))) {
        autoCategory = cat.key;
        break;
      }
    }

    // 如果识别到分类，直接开始构建，跳过表单（同时识别文字中的登录需求）
    if (autoCategory) {
      const wantsAuth = /登录|注册/.test(text);
      if (wantsAuth) setNeedsAuth(true);
      handleFormSubmit(autoCategory, text, wantsAuth);
      return;
    }

    // 没有识别到分类 → 显示表单让用户选择

    // 重置停止标记
    stoppedRef.current = false;

    // 当前分组的 groupId（表单相关消息共享同一组）
    const gid = nextGroupId.current;

    // 添加用户消息
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: text, type: "text", groupId: gid },
    ]);

    // 添加 Alex 头像和身份
    setMessages((prev) => [
      ...prev,
      { id: (Date.now() + 1).toString(), role: "alex", content: "工程师", type: "text", groupId: gid },
    ]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
        signal: controller.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answerBuffer = "";
      let thinkingBuffer = "";

      while (true) {
        if (stoppedRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "workflow_panel") {
                // 创建新工作流时间线（清除旧时间线，修复增量开发不显示工作流的 bug）
                setMessages((prev) => {
                  const filtered = prev.filter((m) => m.type !== "workflow_timeline");
                  return [
                    ...filtered,
                    {
                      id: (Date.now() + Math.random()).toString(),
                      role: "alex",
                      content: "",
                      type: "workflow_timeline",
                      groupId: gid,
                      workflowTimeline: [{ number: 0, text: "I'm getting started.", done: false }],
                    },
                  ];
                });
                setCurrentStep(1);
              } else if (data.type === "workflow_item") {
                // 逐步添加工作流步骤（修复：done:true 时更新而非追加重复项）
                const newItem: WorkflowTimelineItem = {
                  number: data.number,
                  text: data.text,
                  done: data.done,
                  actions: data.actions,
                };
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  const timelineIdx = newMsgs.findLastIndex((m) => m.type === "workflow_timeline");
                  if (timelineIdx >= 0) {
                    const items = [...(newMsgs[timelineIdx].workflowTimeline || [])];
                    if (items.length === 1 && items[0].text === "I'm getting started.") {
                      items[0] = newItem;
                    } else if (newItem.done && items.length > 0 && items[items.length - 1].number === newItem.number) {
                      items[items.length - 1] = newItem;
                    } else {
                      items.push(newItem);
                    }
                    newMsgs[timelineIdx] = { ...newMsgs[timelineIdx], workflowTimeline: items };
                  } else {
                    newMsgs.push({
                      id: (Date.now() + Math.random()).toString(),
                      role: "alex",
                      content: "",
                      type: "workflow_timeline",
                      groupId: gid,
                      workflowTimeline: [newItem],
                    });
                  }
                  return newMsgs;
                });
              } else if (data.type === "thinking_chunk") {
                thinkingBuffer += data.content;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  const lastIdx = newMsgs.length - 1;
                  if (lastIdx >= 0 && newMsgs[lastIdx]._isThinking) {
                    newMsgs[lastIdx] = { ...newMsgs[lastIdx], content: thinkingBuffer };
                  } else {
                    newMsgs.push({
                      id: (Date.now() + Math.random()).toString(),
                      role: "alex",
                      content: thinkingBuffer,
                      type: "thinking",
                      groupId: gid,
                      _isThinking: true,
                    });
                  }
                  return newMsgs;
                });
              } else if (data.type === "thinking_end") {
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  for (let i = newMsgs.length - 1; i >= 0; i--) {
                    if (newMsgs[i]._isThinking) {
                      newMsgs[i] = { ...newMsgs[i], _isThinking: false };
                      break;
                    }
                  }
                  thinkingBuffer = "";
                  return newMsgs;
                });
              } else if (data.type === "form") {
                setCurrentStep(2);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: (Date.now() + Math.random()).toString(),
                    role: "alex",
                    content: "请从下方推荐的 Web 应用方向中选择一个，并详细描述您的具体需求（也可以不填，Alex 会自由发挥）。如需用户注册登录功能，请勾选下方选项。",
                    type: "form",
                    groupId: gid,
                    categories: data.categories,
                    prompt: data.prompt,
                  },
                ]);
              } else if (data.type === "image") {
                // 图像生成结果
                setMessages((prev) => [
                  ...prev,
                  { id: (Date.now() + Math.random()).toString(), role: "alex", content: `🎨 已为你生成图片：\n\n![生成图片](${data.url})\n\n**提示词**：${data.prompt}`, type: "code", groupId: gid },
                ]);
                setShowPreview(false);
                setActiveView("editor");
                setEditorFiles((prev) => ({ ...prev, "generated-image.md": `# 生成的图片\n\n![${data.prompt}](${data.url})\n\n**生成时间**：${new Date().toLocaleString("zh-CN")}\n**提示词**：${data.prompt}` }));
                setActiveFile("generated-image.md");
              } else if (data.type === "proposal") {
                // 方案生成结果
                setMessages((prev) => [
                  ...prev,
                  { id: (Date.now() + Math.random()).toString(), role: "alex", content: "📝 方案已生成完成！请查看右侧文档。", type: "code", groupId: gid },
                ]);
                setEditorFiles((prev) => ({ ...prev, "方案.md": data.content }));
                setActiveFile("方案.md");
                setShowPreview(false);
                setActiveView("editor");
              } else if (data.type === "answer_chunk") {
                // 流式回答块（用于 Q&A）
                answerBuffer += data.content;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  const lastMsg = newMsgs[newMsgs.length - 1];
                  if (lastMsg && lastMsg._isStreamingAnswer) {
                    lastMsg.content = answerBuffer;
                  } else {
                    newMsgs.push({
                      id: (Date.now() + Math.random()).toString(),
                      role: "alex",
                      content: answerBuffer,
                      type: "text",
                      groupId: gid,
                      _isStreamingAnswer: true,
                    } as any);
                  }
                  return newMsgs;
                });
              } else if (data.type === "answer") {
                // 最终回答（Q&A）- 只清除流式标记，不覆盖内容
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  const lastMsg = newMsgs[newMsgs.length - 1];
                  if (lastMsg && lastMsg._isStreamingAnswer) {
                    delete lastMsg._isStreamingAnswer;
                  } else {
                    newMsgs.push({
                      id: (Date.now() + Math.random()).toString(),
                      role: "alex",
                      content: data.content,
                      type: "text",
                      groupId: gid,
                    });
                  }
                  return newMsgs;
                });
              } else if (data.type === "error") {
                setMessages((prev) => [
                  ...prev,
                  { id: (Date.now() + Math.random()).toString(), role: "alex", content: data.message, type: "text", groupId: gid },
                ]);
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch {
      if (controller.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + Math.random()).toString(), role: "alex", content: "用户要求停止，已停止。", type: "stop", groupId: gid },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + Math.random()).toString(), role: "alex", content: "❌ 服务异常，请稍后重试。", type: "text" },
        ]);
      }
    }
    setLoading(false);
    isStreamingRef.current = false;
  };
  handleSendRef.current = handleSend;

  const handleFormSubmit = (overrideCategory?: string, userText?: string, overrideNeedsAuth?: boolean) => {
    // 防御：按钮 onClick 会把点击事件对象当成第一个参数传入，这里过滤掉非字符串值
    if (overrideCategory != null && typeof overrideCategory !== "string") overrideCategory = undefined as any;
    const category = overrideCategory || (selectedCategory === "custom" ? customCategory : selectedCategory);
    if (!category) return;
    const authFlag = overrideNeedsAuth ?? needsAuth;

    // 中断之前的请求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    stoppedRef.current = false;

    // 新分组（autoCategory 路径需要新分组，表单 UI 路径复用当前分组）
    if (userText) {
      nextGroupId.current += 1;
    }
    const gid = nextGroupId.current;

    setCurrentStep(3);
    setLoading(true);

    // 添加用户消息（仅在 autoCategory 路径中添加，表单 UI 路径的用户消息已由 handleSend 添加）
    if (userText) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", content: userText, type: "text", groupId: gid },
      ]);
    }

    setMessages((prev) => [
      ...prev,
      { id: (Date.now() + 1).toString(), role: "alex", content: "工程师", type: "text", groupId: gid },
    ]);

    setMessages((prev) => [
      ...prev,
      { id: (Date.now() + 2).toString(), role: "alex", content: "Alex 正在分析需求，制定开发计划...", type: "workflow", groupId: gid },
    ]);

    (async () => {
      stoppedRef.current = false;
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: userText || currentPromptRef.current,
            category,
            style: "",
            detail: detailInput,
            needsAuth: authFlag,
          }),
          signal: controller.signal,
        });

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let thinkingBuffer = "";

        while (true) {
          if (stoppedRef.current) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "workflow_panel") {
                  setMessages((prev) => {
                    const filtered = prev.filter((m) => m.type !== "workflow_timeline");
                    return [
                      ...filtered,
                      {
                        id: (Date.now() + Math.random()).toString(),
                        role: "alex",
                        content: "",
                        type: "workflow_timeline",
                        groupId: gid,
                        workflowTimeline: [{ number: 0, text: "I'm getting started.", done: false }],
                      },
                    ];
                  });
                } else if (data.type === "workflow_item") {
                  const newItem: WorkflowTimelineItem = {
                    number: data.number,
                    text: data.text,
                    done: data.done,
                    actions: data.actions,
                  };
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const lastIdx = newMsgs.length - 1;
                    if (lastIdx >= 0 && newMsgs[lastIdx].type === "workflow_timeline") {
                      const items = [...(newMsgs[lastIdx].workflowTimeline || [])];
                      if (items.length === 1 && items[0].text === "I'm getting started.") {
                        items[0] = { ...newItem, done: false };
                      } else if (newItem.done && items.length > 0 && items[items.length - 1].number === newItem.number) {
                        setTimeout(() => {
                          setMessages((p) => {
                            const msgs = [...p];
                            const tIdx = msgs.findLastIndex((m) => m.type === "workflow_timeline");
                            if (tIdx >= 0) {
                              const its = [...(msgs[tIdx].workflowTimeline || [])];
                              const idx = its.findIndex((it) => it.number === newItem.number);
                              if (idx >= 0 && !its[idx].done) {
                                its[idx] = { ...its[idx], done: true };
                                msgs[tIdx] = { ...msgs[tIdx], workflowTimeline: its };
                              }
                            }
                            return msgs;
                          });
                        }, 300);
                      } else {
                        items.push({ ...newItem });
                      }
                      newMsgs[lastIdx] = { ...newMsgs[lastIdx], workflowTimeline: items };
                    } else {
                      newMsgs.push({
                        id: (Date.now() + Math.random()).toString(),
                        role: "alex",
                        content: "",
                        type: "workflow_timeline",
                        groupId: gid,
                        workflowTimeline: [newItem],
                      });
                    }
                    return newMsgs;
                  });
                } else if (data.type === "thinking_chunk") {
                  thinkingBuffer += data.content;
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const lastIdx = newMsgs.length - 1;
                    if (lastIdx >= 0 && newMsgs[lastIdx]._isThinking) {
                      newMsgs[lastIdx] = { ...newMsgs[lastIdx], content: thinkingBuffer };
                    } else {
                      newMsgs.push({
                        id: (Date.now() + Math.random()).toString(),
                        role: "alex",
                        content: thinkingBuffer,
                        type: "thinking",
                        groupId: gid,
                        _isThinking: true,
                      });
                    }
                    return newMsgs;
                  });
                } else if (data.type === "thinking_end") {
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    for (let i = newMsgs.length - 1; i >= 0; i--) {
                      if (newMsgs[i]._isThinking) {
                        newMsgs[i] = { ...newMsgs[i], _isThinking: false };
                        break;
                      }
                    }
                    thinkingBuffer = "";
                    return newMsgs;
                  });
                } else if (data.type === "plan") {
                  const items = data.items.map((item: { title: string; description: string }) => ({
                    ...item,
                    checked: true,
                  }));
                  // 将"Alex 正在分析需求..."标记为完成（去掉闪烁）
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    for (let i = newMsgs.length - 1; i >= 0; i--) {
                      if (newMsgs[i].type === "workflow" && newMsgs[i].content.includes("分析需求")) {
                        newMsgs[i] = { ...newMsgs[i], type: "text" };
                        break;
                      }
                    }
                    return [
                      ...newMsgs,
                      {
                        id: (Date.now() + Math.random()).toString(),
                        role: "alex",
                        content: "请审阅这些功能描述，并选择您希望我优先处理或进一步讨论的任务。",
                        type: "plan",
                        groupId: gid,
                        planItems: items,
                        category: data.category,
                      },
                    ];
                  });
                  setPlanPending(true); // 等待用户批准计划
                } else if (data.type === "error") {
                  setMessages((prev) => [
                    ...prev,
                    { id: (Date.now() + Math.random()).toString(), role: "alex", content: data.message, type: "text" },
                  ]);
                }
              } catch { /* ignore */ }
            }
          }
        }
      } catch {
        if (controller.signal.aborted) {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + Math.random()).toString(), role: "alex", content: "用户要求停止，已停止。", type: "stop", groupId: gid },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + Math.random()).toString(), role: "alex", content: "❌ 生成计划失败，请稍后重试。", type: "text" },
          ]);
        }
      }
      setLoading(false);
      isStreamingRef.current = false;
    })();
  };

  // 从 AI 输出中提取纯 HTML 代码
  const stripMarkdown = (code: string) => {
    if (!code || !code.trim()) return "";

    let cleaned = code.trim();

    // 1. 去掉 markdown 代码块标记: ```html ... ``` 或 ``` ... ```
    cleaned = cleaned.replace(/^```[\s\S]*?\n/, "");
    cleaned = cleaned.replace(/```\s*$/, "");

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

    // 6. 最后兜底：返回原始内容
    return cleaned;
  };

  // 安全过滤：检测生成的代码是否包含父 App 结构，防止嵌套渲染
  const SAFE_PARENT_SIGS = [
    "应用查看器", "编辑器", "Atoms云", "Alex 正在构建",
    "请 Alex 构建", "h-screen flex flex-col", "flex-1 flex overflow-hidden",
    "w-1/2 flex flex-col border-r", "atoms_project_", "setActiveView",
    "setPreviewDevice", "expandedFolders", "WorkflowSteps", "PlanPanel",
    "ChatMessage", "handlePlanApprove", "handleSend", "previewCode",
    "srcDoc={previewCode}", "AI 生成的应用将在这里实时展示",
    "atoms-demo.app/preview", "请审阅这些功能描述",
  ];
  const containsParentApp = (html: string) => SAFE_PARENT_SIGS.some(s => html.includes(s));

  // 安全设置 previewCode：如果检测到父 App 特征则拒绝设置
  const safeSetPreviewCode = (code: string) => {
    if (containsParentApp(code)) {
      console.warn("[安全过滤] 检测到生成的代码包含父 App 结构，已拒绝渲染");
      return;
    }
    setPreviewCode(code);
  };

  // 用户批准计划后，开始生成代码
  const handlePlanApprove = (category: string, planItems: { title: string; description: string; checked: boolean; steps?: { text: string; files: { type: string; filename: string }[] }[] }[]) => {
    // 中断之前的请求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    stoppedRef.current = false;

    setPlanPending(false); // 计划已批准
    setCurrentStep(3);
    setLoading(true);
    setActiveView("editor"); // 批准后立即切换到编辑器
    setActiveFile("index.html"); // 默认先显示 index.html，README.md 最后生成

    // 新分组：工作流程
    nextGroupId.current += 1;
    const gid = nextGroupId.current;

    // 找到 Alex 的计划消息内容，构造引用回复
    const alexPlanMsg = [...messages].reverse().find(m => m.type === "plan" && m.role === "alex");
    const planQuote = alexPlanMsg?.content ? alexPlanMsg.content.slice(0, 40) + (alexPlanMsg.content.length > 40 ? "..." : "") : "请审阅上述开发计划";

    // 先添加用户消息（引用回复格式）
    setMessages((prev) => [
      ...prev,
      { id: (Date.now() + Math.random()).toString(), role: "user", content: `回复@Alex: ${planQuote}\n批准计划`, type: "text", groupId: gid },
    ]);

    // 工作流程时间线由 SSE workflow_panel 事件统一创建

    let fullCode = "";
    let readmeContent = "";
    let liveCodeBuffer = "";
    const liveMarksShown = new Set<string>();
    let lastPreviewUpdate = "";
    const previewTimer = setInterval(() => {
      if (fullCode && fullCode !== lastPreviewUpdate) {
        const cleaned = stripMarkdown(fullCode);
        safeSetPreviewCode(cleaned);
        setShowPreview(true);
        lastPreviewUpdate = fullCode;
      }
    }, 1000);

    (async () => {
      stoppedRef.current = false;
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt:
              currentPromptRef.current ||
              messages.filter((m) => m.role === "user" && !(m.content || "").includes("批准计划")).pop()?.content ||
              "",
            category,
            plan: planItems,
            style: "",
            detail: detailInput,
            needsAuth,
            userId: identityRef.current.userId,
            clientId: identityRef.current.clientId,
            projectId: identityRef.current.projectId,
          }),
          signal: controller.signal,
        });

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let thinkingBuffer = "";

        while (true) {
          if (stoppedRef.current) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "workflow_panel") {
                  setMessages((prev) => {
                    const filtered = prev.filter((m) => m.type !== "workflow_timeline");
                    return [
                      ...filtered,
                      {
                        id: (Date.now() + Math.random()).toString(),
                        role: "alex",
                        content: "",
                        type: "workflow_timeline",
                        groupId: gid,
                        workflowTimeline: [{ number: 0, text: "I'm getting started.", done: false }],
                      },
                    ];
                  });
                } else if (data.type === "workflow_item") {
                  const newItem: WorkflowTimelineItem = {
                    number: data.number,
                    text: data.text,
                    done: data.done,
                    actions: data.actions,
                  };
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const lastIdx = newMsgs.length - 1;
                    if (lastIdx >= 0 && newMsgs[lastIdx].type === "workflow_timeline") {
                      const items = [...(newMsgs[lastIdx].workflowTimeline || [])];
                      if (items.length === 1 && items[0].text === "I'm getting started.") {
                        items[0] = { ...newItem, done: false };
                      } else if (newItem.done && items.length > 0 && items[items.length - 1].number === newItem.number) {
                        setTimeout(() => {
                          setMessages((p) => {
                            const msgs = [...p];
                            const tIdx = msgs.findLastIndex((m) => m.type === "workflow_timeline");
                            if (tIdx >= 0) {
                              const its = [...(msgs[tIdx].workflowTimeline || [])];
                              const idx = its.findIndex((it) => it.number === newItem.number);
                              if (idx >= 0 && !its[idx].done) {
                                its[idx] = { ...its[idx], done: true };
                                msgs[tIdx] = { ...msgs[tIdx], workflowTimeline: its };
                              }
                            }
                            return msgs;
                          });
                        }, 300);
                      } else {
                        items.push({ ...newItem });
                      }
                      newMsgs[lastIdx] = { ...newMsgs[lastIdx], workflowTimeline: items };
                    } else {
                      newMsgs.push({
                        id: (Date.now() + Math.random()).toString(),
                        role: "alex",
                        content: "",
                        type: "workflow_timeline",
                        groupId: gid,
                        workflowTimeline: [newItem],
                      });
                    }
                    return newMsgs;
                  });
                } else if (data.type === "thinking_chunk") {
                  thinkingBuffer += data.content;
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const lastIdx = newMsgs.length - 1;
                    if (lastIdx >= 0 && newMsgs[lastIdx]._isThinking) {
                      newMsgs[lastIdx] = { ...newMsgs[lastIdx], content: thinkingBuffer };
                    } else {
                      newMsgs.push({
                        id: (Date.now() + Math.random()).toString(),
                        role: "alex",
                        content: thinkingBuffer,
                        type: "thinking",
                        groupId: gid,
                        _isThinking: true,
                      });
                    }
                    return newMsgs;
                  });
                } else if (data.type === "thinking_end") {
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    for (let i = newMsgs.length - 1; i >= 0; i--) {
                      if (newMsgs[i]._isThinking) {
                        newMsgs[i] = { ...newMsgs[i], _isThinking: false };
                        break;
                      }
                    }
                    thinkingBuffer = "";
                    return newMsgs;
                  });
                } else if (data.type === "readme") {
                  // 收到 README.md 内容（项目完成后生成）
                  readmeContent = data.content;
                  baselineFilesRef.current["README.md"] = readmeContent;
                  setEditorFiles((prev) => ({ ...prev, "README.md": readmeContent }));
                  setActiveFile("README.md"); // 自动生成后切换到 README
                } else if (data.type === "source_file") {
                  // 收到源文件，添加到编辑器，并记录为基线（未修改状态）
                  baselineFilesRef.current[data.filename] = data.content;
                  setEditorFiles((prev) => ({ ...prev, [data.filename]: data.content }));
                  setActiveFile(data.filename); // 切换到最新文件
                  setCompletedFiles((prev) => new Set([...prev, data.filename])); // 标记文件已完成
                } else if (data.type === "code_chunk") {
                  fullCode += data.content;
                  // 流式累积仅用于预览，不覆盖编辑器文件
                  // 实时"行动解说"：从代码流推导进度行，沿用既有简洁行风格
                  liveCodeBuffer += data.content;
                  const freshMarks = describeCodeMarks(liveCodeBuffer.slice(-400), liveCodeBuffer.length, liveMarksShown);
                  if (freshMarks.length) {
                    setMessages((prev) => {
                      const nm = prev.map(m => (m._liveMark && m.type === "workflow" ? { ...m, type: "text" as const } : m));
                      for (const label of freshMarks) {
                        nm.push({ id: (Date.now() + Math.random()).toString(), role: "alex", content: label, type: "workflow", groupId: gid, _liveMark: true });
                      }
                      return nm;
                    });
                  }
                } else if (data.type === "code") {
                  fullCode = data.content;
                  const cleaned = stripMarkdown(fullCode);
                  safeSetPreviewCode(cleaned);
                  // 编辑器保持源文件（styles.css/app.js/index.html），预览用完整 HTML
                  setShowPreview(true);
                  setCurrentStep(4);
                  // 实时行动行收尾：停止闪烁
                  setMessages((prev) => prev.map(m => (m._liveMark && m.type === "workflow" ? { ...m, type: "text" as const } : m)));
                  // 将"Alex 正在分析需求..."标记为完成（去掉闪烁）
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    for (let i = newMsgs.length - 1; i >= 0; i--) {
                      if (newMsgs[i].type === "workflow" && newMsgs[i].content.includes("分析需求")) {
                        newMsgs[i] = { ...newMsgs[i], type: "text" };
                        break;
                      }
                    }
                    return [
                      ...newMsgs,
                      {
                        id: (Date.now() + Math.random()).toString(),
                        role: "alex",
                        content: "应用已生成完成！你可以在右侧预览效果。",
                        type: "code",
                        code: fullCode,
                      },
                    ];
                  });
                } else if (data.type === "built_preview") {
                  // 服务器构建完成的 React 应用预览（替换流式 HTML 预览）
                  safeSetPreviewCode(data.html);
                  setShowPreview(true);
                } else if (data.type === "version_complete") {
                  // 完整构建完成 → 当前版本就是该次构建的版本（首次构建为版本 1）
                  setCurrentVersion(data.version || 1);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: (Date.now() + Math.random()).toString(),
                      role: "alex",
                      content: "",
                      type: "version_complete",
                      version: data.version,
                      category: data.category,
                      suggestions: data.suggestions,
                    },
                  ]);
                } else if (data.type === "project_saved") {
                  // 服务端已把项目持久化到数据库 → 记录项目 ID（后续增量开发复用）
                  identityRef.current.projectId = data.projectId;
                  setCurrentProjectId(data.projectId);
                } else if (data.type === "error") {
                  setMessages((prev) => [
                    ...prev,
                    { id: (Date.now() + Math.random()).toString(), role: "alex", content: data.message, type: "text" },
                  ]);
                }
              } catch { /* ignore */ }
            }
          }
        }
      } catch {
        if (controller.signal.aborted) {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + Math.random()).toString(), role: "alex", content: "用户要求停止，已停止。", type: "stop", groupId: gid },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + Math.random()).toString(), role: "alex", content: "❌ 生成失败，请稍后重试。", type: "text" },
          ]);
        }
      }
      clearInterval(previewTimer);
      if (fullCode) {
        const cleaned = stripMarkdown(fullCode);
        safeSetPreviewCode(cleaned);
      }
      setLoading(false);
      isStreamingRef.current = false;
    })();
  };

  const handleDownload = () => {
    const content = editorFiles[activeFile];
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 将多文件项目重新拼装成一份完整 HTML（样式/脚本内联回去），供预览使用
  const assemblePreviewFromFiles = (files: Record<string, string>): string => {
    let html = files["index.html"] || "";
    if (!html) return "";
    const css = files["styles/main.css"] || "";
    const js = files["scripts/main.js"] || "";
    if (css) html = html.replace(/<link[^>]*href=["']styles\/main\.css["'][^>]*>/i, "<style>\n" + css + "\n</style>");
    if (js) html = html.replace(/<script[^>]*src=["']scripts\/main\.js["'][^>]*>\s*<\/script>/i, "<script>\n" + js + "\n<" + "/script>");
    return html;
  };

  // 拉取历史项目列表（登录按 userId，未登录按设备 ID）
  const loadHistory = async () => {
    const userId = identityRef.current.userId;
    const clientId = identityRef.current.clientId;
    const q = userId ? `userId=${userId}` : clientId ? `clientId=${clientId}` : "";
    if (!q) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/projects?${q}`);
      const data = await res.json();
      setHistoryProjects(data.projects || []);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  };

  // 打开历史项目 → 恢复预览与编辑器
  const openProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      const p = data.project;
      if (!p || !p.version) return;
      identityRef.current.projectId = p.id;
      setCurrentProjectId(p.id);
      const files: Record<string, string> = p.version.sourceFiles || {};
      if (Object.keys(files).length) {
        setEditorFiles(files);
        baselineFilesRef.current = { ...files };
        setActiveFile(files["README.md"] !== undefined ? "README.md" : Object.keys(files)[0]);
      }
      const preview = p.version.previewHtml || (Object.keys(files).length ? assemblePreviewFromFiles(files) : p.version.fullCode || "");
      if (preview) { safeSetPreviewCode(preview); setShowPreview(true); }
      setActiveView("preview");
    } catch { /* ignore */ }
  };

  // 删除历史项目
  const removeProject = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setHistoryProjects((prev) => prev.filter((p) => p.id !== id));
      if (identityRef.current.projectId === id) {
        identityRef.current.projectId = "";
        setCurrentProjectId("");
      }
    } catch { /* ignore */ }
  };

  // 预览：把用户改过的代码重新构建/拼装，跳到"应用查看器"查看效果
  const handlePreviewEdits = async () => {
    if (editorFiles["src/App.tsx"] !== undefined) {
      // React 工程：调用服务器重新构建后预览
      try {
        const res = await fetch("/api/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: editorFiles }),
        });
        const data = await res.json();
        if (data.ok && data.previewHtml) {
          safeSetPreviewCode(data.previewHtml);
          if (data.distFiles) setEditorFiles((prev) => ({ ...prev, ...data.distFiles }));
        } else {
          alert("构建失败：" + (data.error || "未知错误"));
          return;
        }
      } catch {
        alert("构建服务不可用，请稍后重试");
        return;
      }
      setShowPreview(true);
      setActiveView("preview");
      return;
    }
    // 旧版 HTML 多文件项目：本地拼装预览
    const assembled = assemblePreviewFromFiles(editorFiles);
    if (!assembled) return;
    safeSetPreviewCode(assembled);
    setShowPreview(true);
    setActiveView("preview");
  };

  // 丢弃更改：把当前文件还原到上一次生成时（未修改）的内容
  const handleDiscardChanges = () => {
    const baseline = baselineFilesRef.current[activeFile];
    if (baseline === undefined) return;
    setEditorFiles((prev) => ({ ...prev, [activeFile]: baseline }));
  };

  // 当前文件是否被用户修改过（与上次生成的基线不一致）
  const isFileModified =
    baselineFilesRef.current[activeFile] !== undefined &&
    editorFiles[activeFile] !== undefined &&
    editorFiles[activeFile] !== baselineFilesRef.current[activeFile];

  // 增量修改：基于已有代码做修改 / 修复 Bug / 添加功能（统一入口）
  const runIncremental = (requirement: string) => {
    if (!previewCode || loading) return;

    // 中断之前的请求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    stoppedRef.current = false;

    // 计算新版本号（真正写入 state 在收到 version_complete 之后，避免失败/停止时空耗版本号）
    const newVersion = currentVersion + 1;

    setLoading(true);
    setActiveView("editor");
    setActiveFile("index.html");

    // 新分组
    nextGroupId.current += 1;
    const gid = nextGroupId.current;

    const userMsg = requirement;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: userMsg, type: "text", groupId: gid }]);
    setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "alex", content: "工程师", type: "text", groupId: gid }]);

    let fullCode = previewCode;
    let liveCodeBuffer = "";
    const liveMarksShown = new Set<string>();
    let lastPreviewUpdate = previewCode;
    const previewTimer = setInterval(() => {
      if (fullCode && fullCode !== lastPreviewUpdate) {
        const cleaned = stripMarkdown(fullCode);
        safeSetPreviewCode(cleaned);
        setShowPreview(true);
        lastPreviewUpdate = fullCode;
      }
    }, 1000);

    (async () => {
      stoppedRef.current = false;
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `基于以下已有代码，请按要求修改：${requirement}\n\n已有代码：\n${previewCode}`,
            category: selectedCategory || "tool",
            plan: [{ title: requirement.slice(0, 30), description: requirement }],
            style: "",
            detail: "",
            version: newVersion, // 传递新版本号
            userId: identityRef.current.userId,
            clientId: identityRef.current.clientId,
            projectId: identityRef.current.projectId,
          }),
          signal: controller.signal,
        });

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let thinkingBuffer = "";

        while (true) {
          if (stoppedRef.current) break;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "workflow_panel") {
                  // 创建新工作流时间线（清除旧时间线，修复增量开发不显示工作流的 bug）
                  setMessages((prev) => {
                    const filtered = prev.filter((m) => m.type !== "workflow_timeline");
                    return [...filtered, {
                      id: (Date.now() + Math.random()).toString(), role: "alex", content: "",
                      type: "workflow_timeline", groupId: gid,
                      workflowTimeline: [{ number: 0, text: "I'm getting started.", done: false }],
                    }];
                  });
                } else if (data.type === "workflow_item") {
                  // 逐步添加工作流步骤（done:true 延迟300ms确保蓝色闪烁可见）
                  const newItem: WorkflowTimelineItem = {
                    number: data.number, text: data.text, done: data.done, actions: data.actions,
                  };
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const timelineIdx = newMsgs.findLastIndex((m) => m.type === "workflow_timeline");
                    if (timelineIdx >= 0) {
                      const items = [...(newMsgs[timelineIdx].workflowTimeline || [])];
                      if (items.length === 1 && items[0].text === "I'm getting started.") {
                        items[0] = { ...newItem, done: false };
                      } else if (newItem.done && items.length > 0 && items[items.length - 1].number === newItem.number) {
                        setTimeout(() => {
                          setMessages((p) => {
                            const msgs = [...p];
                            const tIdx = msgs.findLastIndex((m) => m.type === "workflow_timeline");
                            if (tIdx >= 0) {
                              const its = [...(msgs[tIdx].workflowTimeline || [])];
                              const idx = its.findIndex((it) => it.number === newItem.number);
                              if (idx >= 0 && !its[idx].done) {
                                its[idx] = { ...its[idx], done: true };
                                msgs[tIdx] = { ...msgs[tIdx], workflowTimeline: its };
                              }
                            }
                            return msgs;
                          });
                        }, 300);
                      } else {
                        items.push({ ...newItem });
                      }
                      newMsgs[timelineIdx] = { ...newMsgs[timelineIdx], workflowTimeline: items };
                    } else {
                      newMsgs.push({ id: (Date.now() + Math.random()).toString(), role: "alex", content: "", type: "workflow_timeline", groupId: gid, workflowTimeline: [{ ...newItem, done: false }] });
                    }
                    return newMsgs;
                  });
                } else if (data.type === "thinking_chunk") {
                  thinkingBuffer += data.content;
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const lastIdx = newMsgs.length - 1;
                    if (lastIdx >= 0 && newMsgs[lastIdx]._isThinking) {
                      newMsgs[lastIdx] = { ...newMsgs[lastIdx], content: thinkingBuffer };
                    } else {
                      newMsgs.push({
                        id: (Date.now() + Math.random()).toString(),
                        role: "alex",
                        content: thinkingBuffer,
                        type: "thinking",
                        groupId: gid,
                        _isThinking: true,
                      });
                    }
                    return newMsgs;
                  });
                } else if (data.type === "thinking_end") {
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    for (let i = newMsgs.length - 1; i >= 0; i--) {
                      if (newMsgs[i]._isThinking) {
                        newMsgs[i] = { ...newMsgs[i], _isThinking: false };
                        break;
                      }
                    }
                    thinkingBuffer = "";
                    return newMsgs;
                  });
                } else if (data.type === "source_file") {
                  baselineFilesRef.current[data.filename] = data.content;
                  setEditorFiles((prev) => ({ ...prev, [data.filename]: data.content }));
                  setActiveFile(data.filename);
                } else if (data.type === "code_chunk") {
                  fullCode += data.content;
                  // 实时"行动解说"：从代码流推导进度行，沿用既有简洁行风格
                  liveCodeBuffer += data.content;
                  const freshMarks = describeCodeMarks(liveCodeBuffer.slice(-400), liveCodeBuffer.length, liveMarksShown);
                  if (freshMarks.length) {
                    setMessages((prev) => {
                      const nm = prev.map(m => (m._liveMark && m.type === "workflow" ? { ...m, type: "text" as const } : m));
                      for (const label of freshMarks) {
                        nm.push({ id: (Date.now() + Math.random()).toString(), role: "alex", content: label, type: "workflow", groupId: gid, _liveMark: true });
                      }
                      return nm;
                    });
                  }
                } else if (data.type === "code") {
                  fullCode = data.content;
                  const cleaned = stripMarkdown(fullCode);
                  safeSetPreviewCode(cleaned);
                  setShowPreview(true);
                  // 实时行动行收尾：停止闪烁
                  setMessages((prev) => prev.map(m => (m._liveMark && m.type === "workflow" ? { ...m, type: "text" as const } : m)));
                  setMessages((prev) => [...prev, {
                    id: (Date.now() + Math.random()).toString(), role: "alex",
                    content: "修改已完成，预览已更新。", type: "code", groupId: gid, code: fullCode,
                  }]);
                } else if (data.type === "built_preview") {
                  // 服务器构建完成的 React 应用预览（替换流式 HTML 预览）
                  safeSetPreviewCode(data.html);
                  setShowPreview(true);
                } else if (data.type === "version_complete") {
                  // 增量开发成功完成 → 正式确认新版本号（第一个增量 = 版本 2，第二个 = 版本 3……）
                  setCurrentVersion(data.version || newVersion);
                  setMessages((prev) => [...prev, {
                    id: (Date.now() + Math.random()).toString(), role: "alex", content: "",
                    type: "version_complete", groupId: gid, version: data.version, category: data.category,
                    suggestions: data.suggestions,
                  }]);
                } else if (data.type === "project_saved") {
                  identityRef.current.projectId = data.projectId;
                  setCurrentProjectId(data.projectId);
                } else if (data.type === "error") {
                  setMessages((prev) => [...prev, {
                    id: (Date.now() + Math.random()).toString(), role: "alex", content: data.message, type: "text", groupId: gid,
                  }]);
                }
              } catch { /* ignore */ }
            }
          }
        }
      } catch {
        if (controller.signal.aborted) {
          setMessages((prev) => [...prev, {
            id: (Date.now() + Math.random()).toString(), role: "alex", content: "⏹ 用户要求停止，已停止。", type: "text", groupId: gid,
          }]);
        } else {
          setMessages((prev) => [...prev, {
            id: (Date.now() + Math.random()).toString(), role: "alex", content: "❌ 修改失败，请稍后重试。", type: "text", groupId: gid,
          }]);
        }
      }
      clearInterval(previewTimer);
      if (fullCode) {
        safeSetPreviewCode(fullCode);
      }
      setLoading(false);
      isStreamingRef.current = false;
    })();
  };

  // 建议按钮：在现有应用上继续加功能
  const handleIncremental = (suggestion: { title: string; description: string }) =>
    runIncremental(`添加功能「${suggestion.title}」：${suggestion.description}`);

  // 输入框：修复 Bug / 调整现有应用
  const handleModify = (text: string) =>
    runIncremental(`请对当前应用做如下修改：${text}`);

  const handleReset = () => {
    setMessages([]);
    setPreviewCode("");
    setEditorFiles({});
    baselineFilesRef.current = {};
    setCurrentVersion(1); // 重置后从版本 1 开始
    setActiveFile("README.md");
    setShowPreview(false);
    setActiveView("preview");
    setSelectedCategory("");
    setCustomCategory("");
    setDetailInput("");
    setNeedsAuth(false);
    setCurrentStep(0);
    setPlanPending(false);
    setQueue([]);
    stoppedRef.current = false;
    // 清除 localStorage 中的项目数据
    if (user) {
      localStorage.removeItem(`atoms_project_${user.name}`);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* 主内容区域：左右分栏 */}
      <div className="flex-1 flex overflow-hidden">
      {/* 左侧：聊天区域 */}
      <div className="w-1/2 flex flex-col border-r border-[var(--card-border)] overflow-hidden">
        {/* 聊天内容 */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">请 Alex 构建一个 Web 应用</h2>
                <p className="text-[var(--text-muted)] text-sm">
                  描述你想做的应用，Alex 会帮你完成
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, msgIdx) => {
            const isEngineerMarker = msg.role === "alex" && msg.content === "工程师";
            // 跳过"工程师"标记，找到真正的前一条有效消息
            let realPrev: ChatMessage | undefined;
            for (let i = msgIdx - 1; i >= 0; i--) {
              if (!(messages[i].role === "alex" && messages[i].content === "工程师")) {
                realPrev = messages[i];
                break;
              }
            }
            // 分组判断：groupId 不同则为新组；无 groupId 时按索引 fallback（兼容旧缓存）
            const curGid = msg.groupId ?? msgIdx;
            const prevGid = realPrev?.groupId ?? (msgIdx > 0 ? msgIdx - 1 : -1);
            const isGroupStart = msg.role === "alex" && (realPrev?.role !== "alex" || prevGid !== curGid);

            return (
            <div key={msg.id} className={`flex gap-3 py-2 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "alex" && !isEngineerMarker && (
                <>
                  {isGroupStart && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">A</span>
                    </div>
                  )}
                  {!isGroupStart && <div className="w-10 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    {isGroupStart && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-medium">Alex</span>
                        <span className="text-[var(--text-muted)] text-sm">|</span>
                        <span className="text-[var(--text-muted)] text-sm">工程师</span>
                      </div>
                    )}
                    {msg.type === "workflow" && (
                      <div className="flex items-center gap-2 text-gray-300 text-sm workflow-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 workflow-pulse" />
                        <span>{msg.content}</span>
                      </div>
                    )}
                    {msg.type === "code" && (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{msg.content}</span>
                      </div>
                    )}
                    {msg.type === "stop" && (
                      <div className="text-red-500 text-sm font-medium">{msg.content}</div>
                    )}
                    {msg.type === "thinking" && (
                      <ThinkingBubble text={msg.content} streaming={!!msg._isThinking} />
                    )}
                    {msg.type === "workflow_timeline" && msg.workflowTimeline && (
                      <WorkflowTimeline items={msg.workflowTimeline} />
                    )}
                    {msg.type === "version_complete" && (
                      <div className="flex flex-col gap-3 max-w-md">
                        <VersionCard version={msg.version || 1} category={msg.category || ""} />
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <SuggestionsPanel suggestions={msg.suggestions} onSelect={handleIncremental} />
                        )}
                      </div>
                    )}
                    {msg.type === "plan" && msg.planItems && (
                      <PlanPanel
                        items={msg.planItems}
                        category={msg.category || "tool"}
                        readOnly={approvedPlanIds.has(msg.id)}
                        onApprove={(items) => {
                          setApprovedPlanIds((prev) => new Set([...prev, msg.id]));
                          handlePlanApprove(msg.category || "tool", items);
                        }}
                      />
                    )}
                    {msg.type === "form" && (
                      <FormPanel
                        categories={msg.categories || []}
                        selectedCategory={selectedCategory}
                        onSelectCategory={(k) => {
                          setSelectedCategory(k);
                          // 注册登录只属于电商类：切到其他分类时清掉勾选，避免隐藏后仍然生效
                          if (k !== "ecommerce") setNeedsAuth(false);
                        }}
                        customCategory={customCategory}
                        onCustomCategory={setCustomCategory}
                        detailInput={detailInput}
                        onDetailInput={setDetailInput}
                        needsAuth={needsAuth}
                        onNeedsAuth={setNeedsAuth}
                        onSubmit={handleFormSubmit}
                        loading={loading}
                      />
                    )}
                    {msg.type !== "form" && msg.type !== "workflow" && msg.type !== "workflow_steps" && msg.type !== "code" && msg.type !== "workflow_timeline" && msg.type !== "plan" && msg.type !== "version_complete" && msg.type !== "stop" && msg.type !== "thinking" && msg.content && (
                      <p className={`text-sm ${msg._isTyping ? "text-[var(--text-muted)] italic animate-pulse" : "text-gray-300"}`}>{msg.content}</p>
                    )}
                  </div>
                </>
              )}
              {msg.role === "user" && msg.type === "text" && (
                <div className="max-w-md space-y-0">
                  {msg.content.includes("\n") && (
                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-t-xl px-4 py-2 text-xs text-[var(--text-muted)]">
                      {msg.content.split("\n")[0]}
                    </div>
                  )}
                  <div className={`${msg.content.includes("\n") ? "border border-[var(--card-border)] border-t-0 rounded-b-xl" : "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl"} px-5 py-3`}>
                    <p className="text-white text-sm font-medium">{msg.content.includes("\n") ? msg.content.split("\n").slice(1).join("\n") : msg.content}</p>
                  </div>
                </div>
              )}
            </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* 底部输入框 + 队列 */}
        <div className="border-t border-[var(--card-border)] bg-[var(--card-bg)]">
          {/* 队列显示 */}
          {queue.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">队列 ({queue.length})</span>
              </div>
              {queue.map((q, i) => (
                <div key={i} className="flex items-center justify-between text-sm text-gray-300 py-1 group">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="truncate">{q}</span>
                  </div>
                  <button
                    onClick={() => setQueue((prev) => prev.filter((_, idx) => idx !== i))}
                    className="ml-2 p-1 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                    title="删除"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-4">
            <div className="flex gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); } }}
                placeholder={previewCode && previewCode.length > 100 ? "描述要修改的地方，例如：把按钮改成蓝色 / 修复点击没反应的问题..." : "请 Alex 构建一个 Web 应用..."}
                rows={2}
                className="flex-1 px-4 py-3 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none text-sm"
              />
              <div className="self-end flex gap-2">
                <button
                  onClick={() => handleSend()}
                  disabled={!inputText.trim()}
                  className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-medium transition-colors flex items-center gap-2 text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  提交
                </button>
                {loading && (
                  <button
                    onClick={() => { stoppedRef.current = true; abortControllerRef.current?.abort(); setLoading(false); isStreamingRef.current = false; }}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    停止
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：预览区域 */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        {/* 预览头部 - 三个切换按钮 */}
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          {/* 应用查看器 */}
          <button
            onClick={() => setActiveView("preview")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
              activeView === "preview"
                ? "bg-white/15 text-white border border-white/20"
                : "text-[var(--text-muted)] hover:text-white border border-transparent hover:border-white/10"
            }`}
          >
            <Eye className="w-4 h-4" />
            应用查看器
          </button>
          {/* 编辑器 */}
          <button
            onClick={() => setActiveView("editor")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all relative ${
              activeView === "editor"
                ? "bg-white/15 text-white border border-white/20"
                : "text-[var(--text-muted)] hover:text-white border border-transparent hover:border-white/10"
            }`}
          >
            <Code className="w-4 h-4" />
            编辑器
            {Object.keys(editorFiles).length > 0 && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[var(--card-bg)]" />}
          </button>
          {/* Atoms云 */}
          <button
            onClick={() => { setActiveView("cloud"); loadHistory(); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
              activeView === "cloud"
                ? "bg-white/15 text-white border border-white/20"
                : "text-[var(--text-muted)] hover:text-white border border-transparent hover:border-white/10"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            Atoms云
          </button>
        </div>

        {/* 预览内容 */}
        <div className="flex-1 overflow-hidden bg-[#1a1a2e] relative">
          {activeView === "preview" && (
            showPreview && previewCode ? (
              previewCode.length < 100 || (!previewCode.includes("<html") && !previewCode.includes("<!DOCTYPE")) ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md px-6">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">生成结果异常</h3>
                    <p className="text-[var(--text-muted)] text-sm mb-4">
                      AI 生成的代码似乎不完整或格式异常。请尝试重新生成，或修改需求描述使其更具体。
                    </p>
                    <button
                      onClick={() => {
                        const lastUserMsg = [...messages].reverse().find(m => m.role === "user" && m.type === "text");
                        if (lastUserMsg) handleSend(lastUserMsg.content);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      重新生成
                    </button>
                  </div>
                </div>
              ) : (
                /* 简洁的预览显示：顶部工具栏 + 干净的 iframe */
                <div className="w-full h-full flex flex-col">
                  {/* 预览工具栏 */}
                  <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e2e] border-b border-[#2a2a4a]">
                    <div className="flex items-center gap-3">
                      {/* 状态指示灯 */}
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      </div>
                      <span className="text-xs text-gray-400 font-mono">preview</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 设备切换 */}
                      <div className="flex gap-0.5 bg-[#2a2a4a] rounded-md p-0.5">
                        <button
                          onClick={() => setPreviewDevice("desktop")}
                          className={`p-1 rounded transition-all ${previewDevice === "desktop" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
                          title="桌面端"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <path d="M8 21h8M12 17v4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setPreviewDevice("tablet")}
                          className={`p-1 rounded transition-all ${previewDevice === "tablet" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
                          title="平板端"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <rect x="4" y="2" width="16" height="20" rx="2" />
                            <path d="M12 18h.01" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setPreviewDevice("mobile")}
                          className={`p-1 rounded transition-all ${previewDevice === "mobile" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
                          title="移动端"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <rect x="7" y="2" width="10" height="20" rx="2" />
                            <path d="M12 18h.01" />
                          </svg>
                        </button>
                      </div>
                      {/* 刷新按钮 */}
                      <button
                        onClick={() => setPreviewCode(p => p + "")}
                        className="p-1 text-gray-500 hover:text-gray-300 transition-all"
                        title="刷新预览"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* iframe 预览区域 */}
                  <div className="flex-1 flex items-center justify-center bg-[#0f0f1a] overflow-hidden p-4">
                    <div
                      className={`bg-white shadow-2xl overflow-hidden transition-all duration-300 ${
                        previewDevice === "desktop" ? "w-full h-full rounded-lg" :
                        previewDevice === "tablet" ? "w-[768px] rounded-lg" :
                        "w-[375px] rounded-[20px]"
                      }`}
                      style={{ maxHeight: previewDevice === "desktop" ? "100%" : "calc(100% - 16px)" }}
                    >
                      <iframe
                        srcDoc={previewCode}
                        title="应用预览"
                        className="w-full border-0"
                        style={{ height: previewDevice === "desktop" ? "100%" : previewDevice === "tablet" ? "1024px" : "667px" }}
                      />
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <Eye className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">应用预览</p>
                  <p className="text-xs text-gray-500 mt-1">AI 生成的应用将在这里实时展示</p>
                </div>
              </div>
            )
          )}
          {activeView === "editor" && (() => {
            // 将文件名按路径分组为树结构
            const fileTree: Record<string, { type: "folder"; children: string[] } | { type: "file"; content: string }> = {};
            const allFiles = Object.entries(editorFiles);
            const rootFiles: [string, string][] = [];

            for (const [path, content] of allFiles) {
              const parts = path.split("/");
              if (parts.length === 1) {
                rootFiles.push([parts[0], content]);
              } else {
                const dir = parts.slice(0, -1).join("/");
                const filename = parts[parts.length - 1];
                if (!fileTree[dir]) fileTree[dir] = { type: "folder", children: [] };
                if (fileTree[dir].type === "folder" && !fileTree[dir].children.includes(filename)) {
                  fileTree[dir].children.push(filename);
                }
                fileTree[filename] = { type: "file", content };
                // 确保所有父文件夹都存在
                for (let i = 1; i < parts.length - 1; i++) {
                  const parentDir = parts.slice(0, i).join("/");
                  const childDir = parts.slice(0, i + 1).join("/");
                  if (!fileTree[parentDir]) fileTree[parentDir] = { type: "folder", children: [] };
                  if (fileTree[parentDir].type === "folder") {
                    const childName = parts[i];
                    if (!fileTree[parentDir].children.includes(childName)) {
                      fileTree[parentDir].children.push(childName);
                    }
                  }
                }
              }
            }

            // 获取文件图标
            const getFileIcon = (name: string) => {
              if (name.endsWith(".ts") || name.endsWith(".tsx")) return "🟦";
              if (name.endsWith(".js") || name.endsWith(".jsx")) return "🟨";
              if (name.endsWith(".css")) return "🎨";
              if (name.endsWith(".html")) return "🌐";
              if (name.endsWith(".json")) return "📋";
              if (name.endsWith(".md")) return "📝";
              if (name.endsWith(".svg")) return "🖼️";
              if (name.startsWith(".")) return "⚙️";
              return "📄";
            };

            // 获取文件夹图标
            const getFolderIcon = (name: string, isOpen: boolean) => {
              const openIcon = isOpen ? "📂" : "📁";
              if (name === "src") return "📦";
              if (name === "public") return "";
              if (name === "components") return "🧩";
              if (name === "styles") return "🎨";
              if (name === "utils") return "";
              if (name === "data") return "💾";
              return openIcon;
            };

            // 渲染树节点
            const renderTree = (dirPath: string, depth: number): React.ReactNode => {
              const entry = fileTree[dirPath];
              if (!entry || entry.type !== "folder") return null;

              const isOpen = expandedFolders.has(dirPath);
              const dirName = dirPath.split("/").pop() || dirPath;
              const isRoot = dirPath.split("/").length === 1;
              const indent = isRoot ? "pl-2" : `pl-${Math.min(depth * 3 + 2, 14)}`;

              return (
                <div key={dirPath}>
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedFolders);
                      if (isOpen) {
                        // 关闭时也关闭所有子文件夹
                        for (const folder of expandedFolders) {
                          if (folder.startsWith(dirPath + "/")) {
                            newExpanded.delete(folder);
                          }
                        }
                      } else {
                        newExpanded.add(dirPath);
                      }
                      setExpandedFolders(newExpanded);
                    }}
                    className={`w-full ${indent} pr-3 py-1 flex items-center gap-1.5 text-xs transition-colors hover:bg-[#2a2d2e]`}
                  >
                    <svg className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm">{getFolderIcon(dirName, isOpen)}</span>
                    <span className="text-gray-300 font-medium">{dirName}</span>
                  </button>
                  {isOpen && (
                    <div>
                      {entry.children.map((child) => {
                        const childPath = dirPath ? `${dirPath}/${child}` : child;
                        const childEntry = fileTree[child];
                        if (childEntry && childEntry.type === "folder") {
                          return renderTree(childPath, depth + 1);
                        }
                        // 是文件
                        const fullFilePath = dirPath ? `${dirPath}/${child}` : child;
                        const actualPath = allFiles.find(([p]) => p === fullFilePath)?.[0] || fullFilePath;
                        const isActive = activeFile === actualPath;
                        return (
                          <button
                            key={fullFilePath}
                            onClick={() => setActiveFile(actualPath)}
                            className={`w-full ${indent} pl-5 pr-3 py-1 flex items-center gap-1.5 text-xs transition-colors ${
                              isActive ? "bg-[#37373d] text-white" : "text-gray-400 hover:bg-[#2a2d2e] hover:text-white"
                            }`}
                          >
                            <span className="text-sm">{getFileIcon(child)}</span>
                            <span className="truncate">{child}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };

            // 获取顶级文件夹（有子文件夹的）和根文件
            const topLevelDirs = Object.keys(fileTree).filter(k => fileTree[k].type === "folder" && k.split("/").length === 1);
            const standaloneFiles = rootFiles.filter(([name]) => !topLevelDirs.includes(name));

            return (
            <div className="w-full h-full overflow-hidden bg-[#1e1e1e] relative flex">
              {/* 左侧：项目目录 */}
              <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col">
                <div className="px-3 py-2 border-b border-[#3c3c3c] flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">资源管理器</span>
                  {Object.keys(editorFiles).length > 0 && (
                    <button
                      onClick={() => {
                        Object.entries(editorFiles).forEach(([filename, content]) => {
                          const blob = new Blob([content], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        });
                      }}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                      title="下载所有文件"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {Object.keys(editorFiles).length > 0 ? (
                    <div className="py-1">
                      {/* 根文件 */}
                      {standaloneFiles.map(([name, content]) => {
                        const isActive = activeFile === name;
                        return (
                          <button
                            key={name}
                            onClick={() => setActiveFile(name)}
                            className={`w-full px-3 py-1 flex items-center gap-1.5 text-xs transition-colors ${
                              isActive ? "bg-[#37373d] text-white" : "text-gray-400 hover:bg-[#2a2d2e] hover:text-white"
                            }`}
                          >
                            <span className="text-sm">{getFileIcon(name)}</span>
                            <span className="truncate">{name}</span>
                          </button>
                        );
                      })}
                      {/* 文件夹树 */}
                      {topLevelDirs.map(dir => renderTree(dir, 0))}
                    </div>
                  ) : (
                    <div className="px-3 py-8 text-center">
                      <p className="text-xs text-gray-500">等待项目生成...</p>
                    </div>
                  )}
                </div>
                {/* 文件统计 */}
                {Object.keys(editorFiles).length > 0 && (
                  <div className="px-3 py-2 border-t border-[#3c3c3c] text-xs text-gray-500">
                    {Object.keys(editorFiles).length} 个文件
                  </div>
                )}
              </div>

              {/* 右侧：代码编辑区 */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* 面包屑路径 */}
                <div className="flex items-center gap-1 px-4 py-2 bg-[#1e1e1e] border-b border-[#3c3c3c] text-xs text-gray-400">
                  {activeFile.split("/").map((part, i, arr) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-600">/</span>}
                      <span className={i === arr.length - 1 ? "text-white" : ""}>{part}</span>
                    </span>
                  ))}
                  <span className="ml-auto text-gray-600">{editorFiles[activeFile]?.length || 0} 字符</span>
                </div>

                {/* 文件标签页（横向滚动） */}
                <div className="flex items-center gap-0.5 px-2 py-1 bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto">
                  {Object.keys(editorFiles).length > 0 ? (
                    Object.keys(editorFiles).map((filename) => (
                      <button
                        key={filename}
                        onClick={() => setActiveFile(filename)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                          activeFile === filename
                            ? "bg-[#1e1e1e] text-white border border-[#3c3c3c]"
                            : "text-gray-500 hover:text-gray-300 hover:bg-[#2a2d2e]"
                        }`}
                      >
                        <span className="text-sm">{getFileIcon(filename.split("/").pop() || filename)}</span>
                        <span>{filename.split("/").pop()}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500 px-3">暂无文件</span>
                  )}
                </div>

                {/* 文件内容 */}
                <div className="flex-1 flex flex-col overflow-hidden relative bg-[#1e1e1e]">
                  {editorFiles[activeFile] !== undefined ? (
                    <>
                      {/* 操作栏：用户修改代码后出现"预览 / 丢弃更改"按钮 */}
                      <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-[#2a2a2a] bg-[#252526] shrink-0">
                        {isFileModified && (
                          <span className="mr-auto flex items-center gap-1.5 text-xs text-blue-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            已修改
                          </span>
                        )}
                        {isFileModified && (
                          <>
                            <button
                              onClick={handleDiscardChanges}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 border border-[#3c3c3c] rounded-lg hover:bg-[#2a2d2e] hover:text-white transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />丢弃更改
                            </button>
                            <button
                              onClick={handlePreviewEdits}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                            >
                              <Eye className="w-3 h-3" />预览
                            </button>
                          </>
                        )}
                        <button
                          onClick={handleDownload}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                        >
                          <Download className="w-3 h-3" />下载
                        </button>
                      </div>
                      <textarea
                        value={editorFiles[activeFile]}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditorFiles((prev) => ({ ...prev, [activeFile]: v }));
                        }}
                        spellCheck={false}
                        wrap="off"
                        className="flex-1 w-full px-6 py-4 text-sm text-gray-300 font-mono bg-[#1e1e1e] resize-none outline-none leading-relaxed"
                      />
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-4xl mb-3">📄</div>
                        <p className="text-sm text-gray-500">
                          {Object.keys(editorFiles).length === 0 ? "等待代码生成..." : "请选择一个文件"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })()}
          {activeView === "cloud" && (
            <div className="flex flex-col h-full bg-[var(--background)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--card-border)]">
                <div>
                  <h3 className="text-white font-semibold text-sm">历史项目</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">已保存到本机数据库，刷新页面不会丢失</p>
                </div>
                <button
                  onClick={loadHistory}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-colors"
                  title="刷新列表"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {historyLoading ? (
                  <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">加载中…</div>
                ) : historyProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <svg className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                    </svg>
                    <p className="text-sm text-[var(--text-muted)] mb-1">还没有生成记录</p>
                    <p className="text-xs text-[var(--text-muted)]">在左侧输入想法生成应用后，会自动保存到这里</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyProjects.map((p) => (
                      <div
                        key={p.id}
                        className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-indigo-500/40 transition-colors cursor-pointer"
                        onClick={() => openProject(p.id)}
                      >
                        <div className="min-w-0">
                          <div className="text-white font-medium text-sm truncate">{p.title}</div>
                          <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                            {p.category} · {p._count?.versions ?? 1} 个版本 · {new Date(p.updatedAt).toLocaleString("zh-CN", { hour12: false })}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeProject(p.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="删除"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// 版本完成卡片
function VersionCard({ version, category }: { version: number; category: string }) {
  const categoryNames: Record<string, string> = {
    tool: "工具应用",
    showcase: "展示页面",
    dashboard: "数据看板",
    community: "内容社区",
    ecommerce: "电商应用",
    game: "小游戏",
    ai: "AI 应用",
    custom: "自定义应用",
  };

  return (
    <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-bold text-lg">版本 {version}</span>
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-gray-300 text-sm">
            {categoryNames[category] || category} 完成开发
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--text-muted)]">刚刚</div>
        </div>
      </div>
    </div>
  );
}

// 增量开发建议面板
function SuggestionsPanel({
  suggestions,
  onSelect,
}: {
  suggestions: { title: string; description: string }[];
  onSelect: (suggestion: { title: string; description: string }) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState("");

  return (
    <div className="space-y-3">
      <h3 className="text-white font-medium text-sm">💡 增量开发建议</h3>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => setSelectedIndex(selectedIndex === i ? null : i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedIndex === i
                ? "bg-indigo-600 text-white"
                : "bg-[var(--card-bg)] text-gray-300 border border-[var(--card-border)] hover:border-indigo-500/50"
            }`}
          >
            Add {s.title}
          </button>
        ))}
      </div>

      {/* 手动输入框 */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3 space-y-2">
        <textarea
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="或输入自定义需求，描述想添加的功能或要修复的问题..."
          rows={3}
          className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 resize-none"
        />
        <div className="flex justify-end gap-2">
          {(selectedIndex !== null || customInput.trim()) && (
            <button
              onClick={() => {
                if (selectedIndex !== null) {
                  onSelect(suggestions[selectedIndex]);
                  setSelectedIndex(null);
                } else if (customInput.trim()) {
                  onSelect({ title: "自定义需求", description: customInput });
                  setCustomInput("");
                }
              }}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              开始开发
            </button>
          )}
        </div>
      </div>

      {selectedIndex !== null && (
        <div className="bg-[var(--card-bg)] border border-indigo-500/30 rounded-lg p-3">
          <p className="text-sm text-gray-300">{suggestions[selectedIndex].description}</p>
        </div>
      )}
    </div>
  );
}

// AI 思考过程气泡（类似 Claude / DeepSeek 的思考显示）
function ThinkingBubble({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="w-full max-w-lg border border-indigo-500/20 rounded-xl bg-gradient-to-br from-indigo-900/10 to-purple-900/10 overflow-hidden">
      {/* 标题栏 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <svg className="w-3 h-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-xs font-medium text-indigo-200">
            {streaming ? "Alex 正在思考..." : "Alex 的思考过程"}
          </span>
          {streaming && (
            <span className="flex gap-0.5 items-center">
              <span className="w-1 h-1 rounded-full bg-indigo-400 workflow-pulse" />
              <span className="w-1 h-1 rounded-full bg-indigo-400 workflow-pulse" style={{ animationDelay: "0.2s" }} />
              <span className="w-1 h-1 rounded-full bg-indigo-400 workflow-pulse" style={{ animationDelay: "0.4s" }} />
            </span>
          )}
        </div>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 思考内容 */}
      {!collapsed && (
        <div className="px-3 pb-3 pt-0">
          <div className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap font-mono border-l-2 border-indigo-500/30 pl-3">
            {text}
            {streaming && (
              <span className="inline-block w-1.5 h-3 bg-indigo-400 ml-0.5 align-middle workflow-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 工作流时间线组件（逐步显示，带编号圆点、虚线、操作卡片）
function WorkflowTimeline({ items }: { items: WorkflowTimelineItem[] }) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  // 判断是否是初始 "I'm getting started." 状态
  const isInitialState = items.length === 1 && items[0].text === "I'm getting started.";
  const lastIdx = items.length - 1;

  return (
    <div className="w-full max-w-lg">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-white font-medium text-sm">工作流程</span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          {collapsed ? "展开" : "收起"}
          <svg className={`w-3 h-3 transition-transform ${collapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div className="relative pl-5">
          {/* 虚线连接线 */}
          {items.length > 1 && (
            <div className="absolute left-[7px] top-3 bottom-3 w-px border-l border-dashed border-gray-600" />
          )}

          <div className="space-y-4">
            {items.map((item, i) => {
              const isLast = i === lastIdx;
              const isDone = item.done;
              const isFirst = i === 0;

              return (
                <div key={i} className="relative">
                  {/* 圆点：进行中蓝点闪烁，已完成/未开始不闪烁 */}
                  <div className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full z-10 ${
                    isInitialState ? "bg-gray-500" :
                    isDone ? "bg-gray-500" :
                    "bg-indigo-400 workflow-pulse"
                  }`} />

                  {/* 内容 */}
                  <div>
                    {/* 初始高亮 */}
                    {isFirst && isInitialState && (
                      <div className="bg-gray-700/50 rounded-lg px-3 py-2 mb-1">
                        <span className="text-gray-300 text-sm">{item.text}</span>
                      </div>
                    )}

                    {/* 步骤文本 */}
                    {!isInitialState && (
                      <p className={`text-sm leading-relaxed ${isDone ? "text-gray-400" : !isLast ? "text-gray-300" : "text-gray-300 workflow-pulse"}`}>
                        {item.text}
                        {!isDone && isLast && (
                          <span className="inline-block w-1.5 h-3.5 bg-indigo-400 ml-0.5 workflow-pulse align-middle" />
                        )}
                      </p>
                    )}

                    {/* 操作卡片 —— 每步都详细显示 */}
                    {item.actions && item.actions.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {item.actions.map((action, j) => (
                          <div
                            key={j}
                            className="flex items-center gap-2 px-3 py-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg text-xs"
                          >
                            {action.type === "read_file" ? (
                              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            ) : action.type === "run_command" ? (
                              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            )}
                            <span className="text-gray-300">{action.label}</span>
                            {action.detail && (
                              <span className="text-gray-500 ml-auto font-mono text-[10px]">{action.detail}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// 开发计划面板（待办清单 + 编辑/批准）
function PlanPanel({
  items,
  category,
  readOnly = false,
  onApprove,
}: {
  items: { title: string; description: string; checked: boolean; steps?: { text: string; files: { type: string; filename: string }[] }[] }[];
  category: string;
  readOnly?: boolean;
  onApprove: (items: { title: string; description: string; checked: boolean; steps?: { text: string; files: { type: string; filename: string }[] }[] }[]) => void;
}) {
  const [planItems, setPlanItems] = useState(items);
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0])); // 默认展开第一个

  const toggleCheck = (i: number) => {
    setPlanItems((prev) => prev.map((item, idx) => idx === i ? { ...item, checked: !item.checked } : item));
  };

  const removeItem = (i: number) => {
    setPlanItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addItem = () => {
    if (!newTitle.trim()) return;
    setPlanItems((prev) => [...prev, { title: newTitle.trim(), description: newDesc.trim(), checked: true }]);
    setNewTitle("");
    setNewDesc("");
  };

  const startEdit = (i: number) => {
    setEditIndex(i);
    setEditTitle(planItems[i].title);
    setEditDesc(planItems[i].description);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    setPlanItems((prev) => prev.map((item, idx) => idx === editIndex ? { ...item, title: editTitle, description: editDesc } : item));
    setEditIndex(null);
  };

  const toggleExpand = (i: number) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(i)) {
        newSet.delete(i);
      } else {
        newSet.add(i);
      }
      return newSet;
    });
  };

  return (
    <div className="w-full max-w-md">
      <div className={`bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl p-6 space-y-4 ${readOnly ? "opacity-80" : ""}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium text-sm">
            {readOnly ? "已批准的开发计划" : "请审阅这些功能描述，并选择您希望我优先处理或进一步讨论的任务。"}
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full ${readOnly ? "bg-green-500/20 text-green-300" : "text-indigo-300 bg-indigo-500/20"}`}>
            {readOnly ? "已批准" : `${planItems.filter(i => i.checked).length}/${planItems.length} 已完成`}
          </span>
        </div>

        {/* 进度条 */}
        <div className="w-full bg-[var(--card-bg)] rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${(planItems.filter(i => i.checked).length / planItems.length) * 100}%` }}
          />
        </div>

        {/* 功能清单 */}
        <div className="space-y-2">
          {planItems.map((item, i) => (
            <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3 flex items-start gap-3">
              {/* 勾选框 */}
              {!readOnly && (
                <button
                  onClick={() => toggleCheck(i)}
                  className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                    item.checked ? "bg-indigo-600 border-indigo-600" : "border-[var(--card-border)] hover:border-indigo-500"
                  }`}
                >
                  {item.checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}
              {readOnly && item.checked && (
                <div className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-green-600 border border-green-600">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                {editIndex === i ? (
                  <div className="space-y-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                      placeholder="功能标题"
                    />
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 resize-none"
                      placeholder="功能描述"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium">保存</button>
                      <button onClick={() => setEditIndex(null)} className="px-3 py-1 text-gray-400 hover:text-white rounded-lg text-xs">取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={`text-sm font-medium ${item.checked ? "text-white" : "text-gray-500 line-through"}`}>
                      {item.title.match(/^第[一二三四五六七八九十\d]+步/) ? item.title : `${i + 1}. ${item.title}`}
                    </p>
                    <p className={`text-xs mt-0.5 ${item.checked ? "text-gray-400" : "text-gray-600 line-through"}`}>
                      {item.description}
                    </p>
                    {/* 展示具体业务步骤 */}
                    {item.checked && item.steps && item.steps.length > 0 && (
                      <div className="mt-2 pl-2 border-l-2 border-indigo-500/30 space-y-1">
                        {item.steps.map((step, j) => (
                          <div key={j} className="flex items-start gap-1.5">
                            <span className="text-[10px] text-gray-500 mt-0.5 flex-shrink-0">{j + 1}.</span>
                            <span className="text-xs text-gray-400">{step.text}</span>
                            {step.files && step.files.length > 0 && (
                              <div className="flex gap-1 ml-auto flex-shrink-0">
                                {step.files.map((f: any, k) => (
                                  <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded ${f.type === "read" ? "bg-blue-500/20 text-blue-300" : "bg-green-500/20 text-green-300"}`}>
                                    {f.type === "read" ? "读" : "写"} {f.filename.split("/").pop()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 操作按钮 */}
              {!readOnly && !editing && editIndex !== i && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(i)} className="p-1 text-gray-500 hover:text-indigo-400 transition-colors" title="编辑">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => removeItem(i)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="删除">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 添加新功能 */}
        {!readOnly && editing && (
          <div className="space-y-2 border-t border-[var(--card-border)] pt-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              placeholder="新功能标题"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="功能描述"
            />
            <div className="flex gap-2">
              <button onClick={addItem} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium">添加</button>
              <button onClick={() => { setEditing(false); setNewTitle(""); setNewDesc(""); }} className="px-3 py-1.5 text-gray-400 hover:text-white text-xs">取消</button>
            </div>
          </div>
        )}

        {/* 底部按钮 */}
        {!readOnly && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setEditing(!editing)}
              className="flex-1 py-2.5 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/10 rounded-xl font-medium transition-colors text-sm flex items-center justify-center gap-2"
            >
              编辑计划
            </button>
            <button
              onClick={() => onApprove(planItems)}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors text-sm"
            >
              批准
            </button>
          </div>
        )}
        {readOnly && (
          <div className="flex items-center justify-center gap-2 pt-2 pb-1">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-green-400 font-medium">计划已批准，正在执行开发...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// 表单组件
function FormPanel({
  categories,
  selectedCategory,
  onSelectCategory,
  customCategory,
  onCustomCategory,
  detailInput,
  onDetailInput,
  needsAuth,
  onNeedsAuth,
  onSubmit,
  loading,
}: {
  categories: { key: string; label: string; icon: string; desc?: string }[];
  selectedCategory: string;
  onSelectCategory: (key: string) => void;
  customCategory: string;
  onCustomCategory: (v: string) => void;
  detailInput: string;
  onDetailInput: (v: string) => void;
  needsAuth: boolean;
  onNeedsAuth: (v: boolean) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const allCategories = categories;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl p-6 space-y-6">
        {/* 问题 1：选择类别 */}
        <div>
          <h3 className="text-white font-medium mb-3 flex items-start gap-2">
            <span className="text-indigo-400 font-bold">1.</span>
            <span>收集构建 Web 应用所需的核心信息。</span>
            <span className="text-[var(--text-muted)] text-sm font-normal">(单选)</span>
          </h3>
          <div className="space-y-2 ml-6">
            {allCategories.map((cat) => (
              <label key={cat.key} className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer hover:text-white transition-colors">
                <input
                  type="radio"
                  name="category"
                  value={cat.key}
                  checked={selectedCategory === cat.key}
                  onChange={() => onSelectCategory(cat.key)}
                  className="accent-indigo-500 w-4 h-4"
                />
                {cat.key === "custom" ? (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => onCustomCategory(e.target.value)}
                    placeholder=""
                    className="px-3 py-1.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 flex-1"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    {cat.desc && <span className="text-[var(--text-muted)] text-xs">— {cat.desc}</span>}
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* 问题 2：描述需求 */}
        <div>
          <h3 className="text-white font-medium mb-3 flex items-start gap-2">
            <span className="text-indigo-400 font-bold">2.</span>
            <span>请描述您的应用主题及核心功能（可不填，Alex 会自由发挥）；如有喜欢的颜色、样式或类似网站也可以写上。</span>
          </h3>
          <div className="ml-6 space-y-3">
            <textarea
              value={detailInput}
              onChange={(e) => onDetailInput(e.target.value)}
              placeholder=""
              rows={4}
              className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 resize-none"
            />
            {/* 只有电商类需要注册登录，其他类别不显示该选项 */}
            {selectedCategory === "ecommerce" && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsAuth}
                    onChange={(e) => onNeedsAuth(e.target.checked)}
                    className="accent-indigo-500 w-4 h-4"
                  />
                  需要用户注册登录
                </label>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 pt-2">
          <button className="flex-1 py-2.5 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/10 rounded-xl font-medium transition-colors text-sm flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            添加更多
          </button>
          <button
            onClick={() => onSubmit()}
            disabled={loading || !selectedCategory || (selectedCategory === "custom" && !customCategory)}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-medium transition-colors text-sm"
          >
            {loading ? "提交中..." : "提交"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen pt-20 pb-10 px-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <span className="ml-3 text-[var(--text-muted)]">加载中...</span>
      </div>
    }>
      <AppContent />
    </Suspense>
  );
}
