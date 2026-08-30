import type { Metadata } from "next";
import "./globals.css";

// 强制动态渲染，避免页面被静态缓存（否则部署后浏览器会一直用旧页面，出现"访问不了/白屏"）
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Atoms-Demo",
  description: "把想法变成可销售的产品",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
      }}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
