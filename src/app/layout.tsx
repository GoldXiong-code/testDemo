import type { Metadata } from "next";
import "./globals.css";

// 用 ISR 短周期重新验证：既避免部署后旧页面被长期缓存（1年），又保持静态渲染（不流式输出，避免浏览器"连接被终断"）
export const revalidate = 60;

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
