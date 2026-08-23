"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, Copy, Check, RotateCcw, Brain, Image, FileText, Download } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/store";

export default function AppPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [contentType, setContentType] = useState<"text" | "svg">("text");
  const [intent, setIntent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const autoGenerateRef = useRef<string | null>(null);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.push("/login");
      return;
    }
    setUser(u);
    const urlPrompt = searchParams.get("prompt");
    if (urlPrompt) {
      // 用 replace 去掉 URL 中的 prompt 参数，防止刷新时重复触发
      router.replace("/app");
      setPrompt(urlPrompt);
      autoGenerateRef.current = urlPrompt;
    }
  }, [router, searchParams]);

  // 当用户加载完成且有 URL prompt 时，自动触发
  useEffect(() => {
    if (user && autoGenerateRef.current && !hasStarted && !loading) {
      handleGenerate(autoGenerateRef.current);
      autoGenerateRef.current = null;
    }
  }, [user]);

  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [result]);

  // SVG 安全清理：去除 markdown 代码块包裹 + 危险标签
  const sanitizeSVG = (svg: string) => {
    // 去除 ```svg ... ``` 包裹
    let cleaned = svg.replace(/^```svg\s*/i, "").replace(/\s*```$/i, "").trim();
    // 去除 script 标签和事件处理器
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/on\w+\s*=/gi, "");
    return cleaned;
  };

  const handleGenerate = async (overridePrompt?: string) => {
    const text = (typeof overridePrompt === "string" ? overridePrompt : null) || prompt;
    if (!text.trim()) return;
    setPrompt(text);
    setLoading(true);
    setResult("");
    setContentType("text");
    setIntent("");
    setHasStarted(false);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
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
                setThinkingText(data.text);
              } else if (data.type === "intent") {
                setIntent(data.intent);
                setThinkingText(
                  data.intent === "image"
                    ? "🎨 Alex 正在绘制图像..."
                    : data.intent === "plan"
                    ? "📝 Alex 正在生成文字方案..."
                    : "💬 Alex 正在回答你的问题..."
                );
              } else if (data.type === "content") {
                if (!hasStarted) {
                  setHasStarted(true);
                  setContentType(data.contentType || "text");
                }
                if (data.contentType === "svg") {
                  // SVG 一次性设置，用 dangerouslySetInnerHTML 渲染
                  setResult(sanitizeSVG(data.content));
                } else {
                  fullContent += data.content;
                  setResult(fullContent);
                }
              } else if (data.type === "error") {
                setResult(`❌ ${data.message}`);
              } else if (data.type === "done") {
                // 完成
              }
            } catch { /* ignore */ }
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

  const handleDownload = () => {
    if (!result) return;
    // 下载 SVG 文件
    const blob = new Blob([result], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alex-design-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = () => {
    setResult("");
    handleGenerate();
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold text-white mt-8 mb-4">{line.replace("# ", "")}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold text-white mt-6 mb-3">{line.replace("## ", "")}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold text-indigo-300 mt-5 mb-2">{line.replace("### ", "")}</h3>;
      if (line.startsWith("- ")) return <div key={i} className="flex gap-2 ml-4 mb-1"><span className="text-indigo-400">•</span><span className="text-gray-300">{line.replace("- ", "")}</span></div>;
      if (line.match(/^\d+\.\s/)) { const n = line.match(/^(\d+)\./)?.[1] || ""; return <div key={i} className="flex gap-2 ml-4 mb-1"><span className="text-indigo-400 font-medium min-w-[1.5rem]">{n}.</span><span className="text-gray-300">{line.replace(/^\d+\.\s/, "")}</span></div>; }
      if (line.startsWith("|")) return <div key={i} className="font-mono text-sm text-gray-300 my-0.5 bg-white/5 px-3 py-1 rounded">{line}</div>;
      if (line.startsWith("```")) return <div key={i} className="my-4 px-4 py-3 bg-black/50 rounded-lg font-mono text-sm text-gray-300 overflow-x-auto">{line.replace("```", "")}</div>;
      if (line.startsWith(">")) return <div key={i} className="border-l-4 border-indigo-500 pl-4 py-1 my-2 text-gray-400 italic">{line.replace(/^>\s?/, "")}</div>;
      if (line.startsWith("---")) return <hr key={i} className="border-[var(--card-border)] my-6" />;
      if (line.trim() === "") return <div key={i} className="h-3" />;
      return <p key={i} className="text-gray-300 leading-relaxed mb-2">{line}</p>;
    });
  };

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回首页
          </Link>
        </div>

        {user && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">你好，{user.name}</h1>
          </div>
        )}

        {/* 输入区域 */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 mb-8">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想构建的产品，或说 &quot;画一个xxx&quot;..."
            rows={4}
            className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none mb-4"
          />
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-medium transition-colors"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />生成中...</> : <><Sparkles className="w-4 h-4" />生成</>}
            </button>
          </div>
        </div>

        {/* 结果区域 */}
        {(loading || result) && (
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-3">
                {intent === "image" ? <Image className="w-4 h-4 text-purple-400" /> : <FileText className="w-4 h-4 text-indigo-400" />}
                <span className="text-white font-medium">
                  {loading && !hasStarted ? "Alex 思考中..." : intent === "image" ? "🎨 AI 绘图" : intent === "plan" ? "📝 AI 文字方案" : "💬 AI 回答"}
                </span>
                {intent && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${intent === "image" ? "bg-purple-500/20 text-purple-300" : intent === "plan" ? "bg-indigo-500/20 text-indigo-300" : intent === "question" ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-300"}`}>
                    {intent === "image" ? "画图" : intent === "plan" ? "方案" : intent === "question" ? "问答" : "其他"}
                  </span>
                )}
              </div>
              {result && !loading && (
                <div className="flex gap-2">
                  {contentType === "svg" && (
                    <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-white border border-[var(--card-border)] rounded-lg hover:bg-white/10 transition-colors">
                      <Download className="w-3.5 h-3.5" />下载图片
                    </button>
                  )}
                  <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-white border border-[var(--card-border)] rounded-lg hover:bg-white/10 transition-colors">
                    {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />已复制</> : <><Copy className="w-3.5 h-3.5" />复制</>}
                  </button>
                  <button onClick={handleRegenerate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-white border border-[var(--card-border)] rounded-lg hover:bg-white/10 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" />重新生成
                  </button>
                </div>
              )}
            </div>

            {/* 思考状态 */}
            {loading && thinkingText && (
              <div className="px-6 py-3 border-b border-[var(--card-border)] bg-indigo-500/5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-sm text-indigo-300">{thinkingText}</span>
              </div>
            )}

            {/* 内容区域 */}
            <div ref={resultRef} className="p-6 max-h-[600px] overflow-y-auto" style={{ scrollBehavior: "smooth" }}>
              {loading && !result ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span className="ml-3 text-[var(--text-muted)]">正在连接 AI...</span>
                </div>
              ) : contentType === "svg" ? (
                <div className="flex justify-center">
                  <div
                    dangerouslySetInnerHTML={{ __html: result }}
                    className="w-full max-w-2xl [&>svg]:w-full [&>svg]:h-auto [&>svg]:rounded-xl"
                  />
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  {renderMarkdown(result)}
                  {loading && hasStarted && <span className="inline-block w-2 h-5 bg-indigo-400 animate-pulse ml-1" />}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
