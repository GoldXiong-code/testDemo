"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/store";
import { ArrowRight, Sparkles } from "lucide-react";

// 卡通头像组件
function Avatar({ color, delay }: { color: string; delay: number }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg border-2 border-white/20"
      style={{
        backgroundColor: color,
        animation: `bounce 1s ease ${delay}s infinite alternate`,
      }}
    >
      {["🧑‍", "👩‍🎨", "👨‍🔬", "🚀", "🍎", "", "👩‍", "🐻"][delay % 8]}
    </div>
  );
}

const avatarColors = [
  "#f97316", // orange
  "#eab308", // yellow
  "#a8a29e", // stone
  "#ec4899", // pink
  "#6366f1", // indigo
  "#06b6d4", // cyan
  "#22c55e", // green
  "#a855f7", // purple
];

export default function Hero() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getCurrentUser());
  }, []);

  const handleStart = () => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    // 统一跳转到 /app，由 /app 做意图识别和回答
    if (inputValue.trim()) {
      router.push(`/app?prompt=${encodeURIComponent(inputValue.trim())}&fresh=1`);
    } else {
      router.push("/app?fresh=1");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 pt-16">
      {/* 公告栏 */}
      <div className="mb-8 flex items-center gap-3 px-5 py-2 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] text-sm">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <span className="text-[var(--text-muted)]">Notice</span>
        <span className="text-white font-medium">New models are live in Atoms</span>
        <button className="text-[var(--text-muted)] hover:text-white ml-1">✕</button>
      </div>

      {/* 卡通头像 */}
      <div className="flex gap-[-4px] mb-8">
        {avatarColors.map((color, i) => (
          <Avatar key={color} color={color} delay={i} />
        ))}
      </div>

      {/* 主标题 */}
      <h1 className="text-5xl md:text-6xl font-bold text-white text-center mb-4 tracking-tight">
        把想法变成可销售的 产品
      </h1>

      {/* 副标题 */}
      <p className="text-lg md:text-xl text-[var(--text-muted)] text-center max-w-2xl mb-12 leading-relaxed">
        AI 员工用于验证想法、构建产品并获取客户。几分钟内完成。无需编码。
      </p>

      {/* 输入框 */}
      <div className="w-full max-w-2xl input-glow rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] overflow-hidden">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="请 Alex 构建一个 Web 应用..."
          rows={3}
          className="w-full px-6 py-5 bg-transparent text-white placeholder:text-[var(--text-muted)] text-base resize-none focus:outline-none"
        />
        <div className="flex items-center justify-end px-4 pb-4">
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium transition-colors"
          >
            开始
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
