import type { NextConfig } from "next";

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, max-age=0, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      // 所有 HTML 页面强制 no-store，避免浏览器缓存旧 HTML（旧 JS 引用），
      // 导致用户点击「开始」后仍执行缓存的旧代码。静态资源（/_next/*）不受影响。
      { source: "/", headers: noStoreHeaders },
      { source: "/app", headers: noStoreHeaders },
      { source: "/login", headers: noStoreHeaders },
      { source: "/register", headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
