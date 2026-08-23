"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Brain,
} from "lucide-react";
import Link from "next/link";

const DEFAULT_MODEL = "qwen3.7-flash-2026-07-15";

const THINKING_STAGES = [
  { text: "正在理解你的需求...", icon: "🔍" },
  { text: "分析关键词和上下文...", icon: "" },
  { text: "构建方案框架...", icon: "🏗️" },
  { text: "生成核心内容...", icon: "️" },
  { text: "优化结构和表达...", icon: "✨" },
  { text: "检查内容完整性...", icon: "✅" },
];

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [thinkingStage, setThinkingStage] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(userData));

    const urlPrompt = searchParams.get("prompt");
    if (urlPrompt) {
      setPrompt(urlPrompt);
    }
  }, [router, searchParams]);

  // 自动滚动到底部
  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [result]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");
    setHasStarted(false);

    // 思考阶段动画
    let stage = 0;
    const stageInterval = setInterval(() => {
      if (stage < THINKING_STAGES.length - 1) {
        stage++;
        setThinkingStage(stage);
      }
    }, 600);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
          model: DEFAULT_MODEL,
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "thinking") {
                setThinkingStage(data.stage);
                if (!hasStarted) setHasStarted(true);
              } else if (data.type === "content") {
                if (!hasStarted) {
                  setHasStarted(true);
                  clearInterval(stageInterval);
                }
                fullContent += data.content;
                setResult(fullContent);
              } else if (data.type === "error") {
                setResult(`❌ ${data.message}`);
              } else if (data.type === "done") {
                clearInterval(stageInterval);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch {
      setResult("❌ 生成失败，网络错误，请稍后重试。");
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setResult("");
    handleGenerate();
  };

  // Markdown 简单渲染
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("# ")) {
        return (
          <h1 key={i} className="text-2xl font-bold text-white mt-8 mb-4">
            {line.replace("# ", "")}
          </h1>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={i} className="text-xl font-bold text-white mt-6 mb-3">
            {line.replace("## ", "")}
          </h2>
        );
      }
      if (line.startsWith("### ")) {
        return (
          <h3 key={i} className="text-lg font-semibold text-indigo-300 mt-5 mb-2">
            {line.replace("### ", "")}
          </h3>
        );
      }
      if (line.startsWith("#### ")) {
        return (
          <h4 key={i} className="text-base font-semibold text-indigo-200 mt-4 mb-2">
            {line.replace("#### ", "")}
          </h4>
        );
      }
      if (line.startsWith("- ")) {
        return (
          <div key={i} className="flex gap-2 ml-4 mb-1">
            <span className="text-indigo-400 mt-0.5">•</span>
            <span className="text-gray-300">{line.replace("- ", "")}</span>
          </div>
        );
      }
      if (line.match(/^\d+\.\s/)) {
        const num = line.match(/^(\d+)\./)?.[1] || "";
        return (
          <div key={i} className="flex gap-2 ml-4 mb-1">
            <span className="text-indigo-400 font-medium min-w-[1.5rem]">{num}.</span>
            <span className="text-gray-300">{line.replace(/^\d+\.\s/, "")}</span>
          </div>
        );
      }
      if (line.startsWith("|")) {
        return (
          <div key={i} className="font-mono text-sm text-gray-300 my-0.5 bg-white/5 px-3 py-1 rounded">
            {line}
          </div>
        );
      }
      if (line.startsWith("```")) {
        return (
          <div key={i} className="my-4 px-4 py-3 bg-black/50 rounded-lg font-mono text-sm text-gray-300 overflow-x-auto">
            {line.replace("```", "")}
          </div>
        );
      }
      if (line.startsWith(">")) {
        return (
          <div key={i} className="border-l-4 border-indigo-500 pl-4 py-1 my-2 text-gray-400 italic">
            {line.replace(/^>\s?/, "")}
          </div>
        );
      }
      if (line.startsWith("---")) {
        return <hr key={i} className="border-[var(--card-border)] my-6" />;
      }
      if (line.trim() === "") {
        return <div key={i} className="h-3" />;
      }
      return (
        <p key={i} className="text-gray-300 leading-relaxed mb-2">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 顶部返回 */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
        </div>

        {/* 欢迎信息 */}
        {user && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              你好，{user.name}
            </h1>
            <p className="text-[var(--text-muted)]">
              输入你的想法，AI 将帮你生成产品方案
            </p>
          </div>
        )}

        {/* 输入区域 */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 mb-8">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想构建的产品或想法..."
            rows={4}
            className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none mb-4"
          />

          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-medium transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  生成
                </>
              )}
            </button>
          </div>
        </div>

        {/* 思考过程 + 结果区域 */}
        {(loading || result) && (
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
            {/* 结果头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <Brain className={`w-4 h-4 ${hasStarted ? "text-green-400" : "text-indigo-400"} ${loading && !hasStarted ? "animate-pulse" : ""}`} />
                <span className="text-white font-medium">
                  {loading && !hasStarted ? "AI 思考中" : "AI 生成结果"}
                </span>
              </div>
              {result && !loading && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-white border border-[var(--card-border)] rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        复制
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-white border border-[var(--card-border)] rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    重新生成
                  </button>
                </div>
              )}
            </div>

            {/* 思考阶段指示器 */}
            {loading && !hasStarted && (
              <div className="px-6 py-4 border-b border-[var(--card-border)] bg-indigo-500/5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          thinkingStage >= i ? "bg-indigo-400" : "bg-gray-600"
                        }`}
                        style={{
                          animation: `bounce 0.6s ease ${i * 0.15}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-indigo-300 font-medium">
                    {THINKING_STAGES[thinkingStage].icon}{" "}
                    {THINKING_STAGES[thinkingStage].text}
                  </span>
                </div>
                {/* 进度条 */}
                <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                    style={{
                      width: `${((thinkingStage + 1) / THINKING_STAGES.length) * 60}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* 流式内容区域 */}
            <div
              ref={resultRef}
              className="p-6 max-h-[600px] overflow-y-auto"
              style={{ scrollBehavior: "smooth" }}
            >
              {loading && !result ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span className="ml-3 text-[var(--text-muted)]">
                    正在连接 AI...
                  </span>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  {renderMarkdown(result)}
                  {/* 光标闪烁效果 */}
                  {loading && hasStarted && (
                    <span className="inline-block w-2 h-5 bg-indigo-400 animate-pulse ml-1" />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
