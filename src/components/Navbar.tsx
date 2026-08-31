"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, logoutUser } from "@/lib/store";
import { useState, useEffect } from "react";
import {
  Atom,
  ChevronDown,
  LogOut,
  User,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, [pathname]);

  const handleLogout = () => {
    // 先更新界面状态，再清除本地存储，确保即使存储操作异常界面也能立即切换
    setCurrentUser(null);
    setUserMenuOpen(false);
    logoutUser();
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-[var(--nav-bg)] backdrop-blur-md border-b border-[var(--card-border)]/50">
      {/* 左侧：Logo + 导航 */}
      <div className="flex items-center gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
          <Atom className="w-6 h-6 text-indigo-400" />
          <span>Atoms</span>
        </Link>
      </div>

      {/* 右侧：登录/注册 或 用户菜单 */}
      <div className="flex items-center gap-3">
        {!currentUser ? (
          <>
            <Link
              href="/login"
              className="px-5 py-2 text-sm text-gray-300 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors font-medium"
            >
              注册
            </Link>
          </>
        ) : (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full hover:bg-white/10 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>{currentUser.name}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[var(--card-border)]">
                    <p className="text-sm font-medium text-white">
                      {currentUser.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {currentUser.email}
                    </p>
                  </div>
                  <a
                    href="/app"
                    className="block px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    AI 生成
                  </a>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
