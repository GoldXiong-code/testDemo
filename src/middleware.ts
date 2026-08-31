import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 兜底：任何带 prompt / fresh 等敏感查询参数的 /app 请求，一律重定向到干净的 /app。
// 新版已改用 localStorage 传递输入，URL 不再携带任何内容；这里再拦截旧链接、
// 旧缓存代码发出的带参 URL，保证 prompt 不会停留在地址栏 / 分享链接 / 访问日志里。
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/app" && (searchParams.has("prompt") || searchParams.has("fresh"))) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("prompt");
    url.searchParams.delete("fresh");
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app"],
};
