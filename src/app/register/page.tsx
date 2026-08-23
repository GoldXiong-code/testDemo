"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Atom, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { setCurrentUser } from "@/lib/store";

// Zod 表单校验
const registerSchema = z.object({
  name: z
    .string()
    .min(2, "用户名至少 2 个字符")
    .max(20, "用户名最多 20 个字符"),
  email: z
    .string()
    .min(1, "请输入邮箱地址")
    .email("请输入有效的邮箱地址（例如：user@example.com）"),
  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .max(32, "密码最多 32 个字符")
    .regex(/[A-Za-z]/, "密码必须包含至少一个字母")
    .regex(/[0-9]/, "密码必须包含至少一个数字"),
  confirmPassword: z.string().min(1, "请确认密码"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [nameStatus, setNameStatus] = useState<"" | "checking" | "available" | "taken">("");
  const nameCheckTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 实时检查用户名可用性
  const checkUsername = (name: string) => {
    if (name.length < 2) {
      setNameStatus("");
      return;
    }
    if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current);
    nameCheckTimer.current = setTimeout(async () => {
      setNameStatus("checking");
      try {
        const res = await fetch(`/api/auth/check-username?name=${encodeURIComponent(name)}`);
        const data = await res.json();
        setNameStatus(data.available ? "available" : "taken");
      } catch {
        setNameStatus("");
      }
    }, 500);
  };

  const validate = () => {
    const result = registerSchema.safeParse(form);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        newErrors[field] = issue.message;
      });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");

    if (nameStatus === "taken") {
      setApiError("该用户名已被使用，请换一个");
      return;
    }

    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // 注册成功，保存用户信息
        setCurrentUser(data.user);
        router.push("/login");
      } else {
        setApiError(data.message);
      }
    } catch {
      setApiError("网络错误，请稍后重试");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-2xl">
            <Atom className="w-8 h-8 text-indigo-400" />
            <span>Atoms</span>
          </Link>
        </div>

        {/* 表单卡片 */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-2">创建账户</h1>
          <p className="text-[var(--text-muted)] mb-8">注册你的 Atoms 账户，开始构建产品</p>

          {apiError && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                用户名
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (errors.name) setErrors({ ...errors, name: "" });
                    checkUsername(e.target.value);
                  }}
                  onBlur={() => checkUsername(form.name)}
                  placeholder="输入你的用户名"
                  className={`w-full px-4 py-3 bg-[var(--input-bg)] border rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors pr-10 ${
                    errors.name ? "border-red-500" : nameStatus === "taken" ? "border-red-500" : nameStatus === "available" ? "border-green-500" : "border-[var(--card-border)]"
                  }`}
                />
                {nameStatus === "checking" && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400 animate-spin" />
                )}
                {nameStatus === "available" && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                )}
                {nameStatus === "taken" && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-400" />
                )}
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
              {nameStatus === "taken" && !errors.name && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  该用户名已被使用，请换一个
                </p>
              )}
              {nameStatus === "available" && (
                <p className="mt-1 text-sm text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  用户名可用
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                邮箱地址
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
                placeholder="name@example.com"
                className={`w-full px-4 py-3 bg-[var(--input-bg)] border rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors ${
                  errors.email ? "border-red-500" : "border-[var(--card-border)]"
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    if (errors.password) setErrors({ ...errors, password: "" });
                  }}
                  placeholder="至少 8 位，包含字母和数字"
                  className={`w-full px-4 py-3 bg-[var(--input-bg)] border rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors pr-12 ${
                    errors.password ? "border-red-500" : "border-[var(--card-border)]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                确认密码
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => {
                  setForm({ ...form, confirmPassword: e.target.value });
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: "" });
                }}
                placeholder="再次输入密码"
                className={`w-full px-4 py-3 bg-[var(--input-bg)] border rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors ${
                  errors.confirmPassword ? "border-red-500" : "border-[var(--card-border)]"
                }`}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || nameStatus === "taken" || nameStatus === "checking"}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  注册中...
                </>
              ) : (
                "注册"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
            已有账户？{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              立即登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
