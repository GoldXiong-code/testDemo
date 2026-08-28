// HTML 应用 → React + TypeScript + Tailwind + Vite 工程转换层
// 采用服务器端确定性转换（不额外调用 LLM）：
//  - 页面结构 → App.tsx 组件（useEffect 挂载，保留全部交互）
//  - 自定义 CSS → src/index.css（顶部保留 @tailwind 指令）
//  - 内联 tailwind.config → tailwind.config.ts（构建与本地开发共用）
//  - 工程脚手架（package.json / vite / tsconfig / eslint 等）由本文件统一生成
import { buildReactProject, BuildResult } from "./builder";

// 转义为 JS 模板字符串安全的内容
function escapeTpl(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

// 从单文件 HTML 中拆分出：body 结构、自定义样式、交互脚本、tailwind 配置
export function extractHtmlParts(html: string): {
  bodyHtml: string;
  customCss: string;
  js: string;
  twTheme: Record<string, unknown>;
  title: string;
  bodyOnload: string;
  bodyClass: string;
  bodyStyle: string;
} {
  let rest = html;

  // 标题
  const titleMatch = rest.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] || "应用").trim();

  // 1) 收集 <style> → customCss
  const cssParts: string[] = [];
  rest = rest.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => {
    cssParts.push(String(css).trim());
    return "";
  });

  // 2) 收集内联 <script>（带 src 的外部脚本跳过；tailwind.config 脚本提取配置后跳过）
  const jsParts: string[] = [];
  let twTheme: Record<string, unknown> = {};
  rest = rest.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, body) => {
    if (/\bsrc\s*=/i.test(attrs)) return ""; // 外部 CDN 脚本：构建版不再需要
    if (/tailwind\.config/.test(body)) {
      try {
        const stub: any = {};
        new Function("tailwind", String(body))(stub);
        twTheme = stub.config?.theme?.extend || {};
      } catch { /* 忽略配置解析失败 */ }
      return "";
    }
    jsParts.push(String(body).trim());
    return "";
  });

  // 3) 提取 <body> 内容（同时捕获 body 标签上的 onload / class / style 属性）
  const bodyMatch = rest.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
  const bodyAttrs = bodyMatch?.[1] || "";
  const bodyHtml = (bodyMatch?.[2] || rest).trim();
  const bodyOnloadMatch = bodyAttrs.match(/\bonload\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const bodyOnload = bodyOnloadMatch ? (bodyOnloadMatch[1] ?? bodyOnloadMatch[2] ?? "") : "";
  // body 上的 class/style 决定整页布局（如 flex 并排、全屏高度），必须带到转换后的包裹层，
  // 否则页面结构会上下堆叠、错乱
  const bodyClassMatch = bodyAttrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const bodyClass = bodyClassMatch ? (bodyClassMatch[1] ?? bodyClassMatch[2] ?? "") : "";
  const bodyStyleMatch = bodyAttrs.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const bodyStyle = bodyStyleMatch ? (bodyStyleMatch[1] ?? bodyStyleMatch[2] ?? "") : "";

  return {
    bodyHtml,
    customCss: cssParts.filter(Boolean).join("\n\n"),
    js: jsParts.filter(Boolean).join("\n\n;\n\n"),
    twTheme,
    title,
    bodyOnload,
    bodyClass,
    bodyStyle,
  };
}

// 生成 App.tsx：React 组件挂载原页面结构，并在挂载后执行原交互脚本
function genAppTsx(bodyHtml: string, js: string, bodyOnload: string, bodyClass: string, bodyStyle: string): string {
  return `import { useEffect, useRef } from "react";

// 页面结构（自动转换生成）
const BODY_HTML = \`${escapeTpl(bodyHtml)}\`;

// 交互逻辑（挂载后执行，与原 HTML 中 <script> 的行为一致）
const APP_JS = \`${escapeTpl(js)}\`;

// 原 <body onload="..."> 的属性值（如有）
const BODY_ONLOAD = \`${escapeTpl(bodyOnload)}\`;

// 原 <body> 标签上的 class / style（决定整页布局，必须保留）
const BODY_CLASS = \`${escapeTpl(bodyClass)}\`;
const BODY_STYLE = \`${escapeTpl(bodyStyle)}\`;

export default function App() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (BODY_STYLE) root.style.cssText = BODY_STYLE;
    root.innerHTML = BODY_HTML;

    // 兼容原脚本：DOMContentLoaded / load 若已触发则立即执行回调
    const origDocAdd = document.addEventListener.bind(document);
    const origWinAdd = window.addEventListener.bind(window);
    const fire = (fn: any) => {
      try {
        if (typeof fn === "function") fn();
        else fn?.handleEvent?.();
      } catch (e) {
        console.error(e);
      }
    };
    (document as any).addEventListener = (type: string, fn: any, opts?: any) => {
      if (type === "DOMContentLoaded") {
        fire(fn);
        return;
      }
      return origDocAdd(type, fn, opts);
    };
    (window as any).addEventListener = (type: string, fn: any, opts?: any) => {
      if (type === "load") {
        fire(fn);
        return;
      }
      return origWinAdd(type, fn, opts);
    };
    // window.onload = fn 的写法也要兼容：此时文档早已加载完成，直接执行
    let onloadTrapped = false;
    try {
      Object.defineProperty(window, "onload", {
        configurable: true,
        get() { return undefined; },
        set(fn: any) { fire(fn); },
      });
      onloadTrapped = true;
    } catch { /* 忽略 */ }

    try {
      // 用真实 <script> 标签执行（不是 eval）：顶层 const/let/class/function 会进入
      // 全局作用域，页面里的内联 onclick="fn()" 才能像在原 HTML 中一样访问到。
      // 若用 eval，const/let 只在 eval 作用域内存活，内联 onclick 会静默失效。
      const s = document.createElement("script");
      s.text = APP_JS;
      root.appendChild(s);
      // 模拟原 <body onload="...">
      if (BODY_ONLOAD) {
        try { new Function(BODY_ONLOAD)(); } catch (e) { console.error(e); }
      }
    } catch (e) {
      console.error("脚本执行出错：", e);
    } finally {
      (document as any).addEventListener = origDocAdd;
      (window as any).addEventListener = origWinAdd;
      if (onloadTrapped) {
        try { delete (window as any).onload; } catch { /* 忽略 */ }
      }
    }
  }, []);

  return <div ref={ref} className={BODY_CLASS || undefined} />;
}
`;
}

// 工程脚手架文件（与主流 Vite + React + TS 模板一致）
export function boilerplateFiles(title: string, twTheme: Record<string, unknown>): Record<string, string> {
  const slug = "atoms-app";
  const files: Record<string, string> = {};

  files["index.html"] = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  files["package.json"] = `{
  "name": "${slug}",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "~5.6.2",
    "vite": "^5.4.11"
  }
}
`;

  files["vite.config.ts"] = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" 让构建产物使用相对路径，dist 目录可独立部署
export default defineConfig({
  plugins: [react()],
  base: "./",
});
`;

  files["tsconfig.json"] = `{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
`;

  files["tsconfig.app.json"] = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`;

  files["tsconfig.node.json"] = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
`;

  files["tailwind.config.ts"] = `import type { Config } from "tailwindcss";

export default ${JSON.stringify({ content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"], theme: { extend: twTheme }, plugins: [] }, null, 2)} satisfies Config;
`;

  files["postcss.config.js"] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  files["eslint.config.js"] = `// ESLint 扁平化配置（基础版）
export default [
  {
    ignores: ["dist/*", "node_modules/*"],
  },
];
`;

  files["src/main.tsx"] = `import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 注意：这里刻意不使用 StrictMode —— 开发模式下 StrictMode 会把挂载副作用执行两次，
// 会导致页面脚本重复执行、全局声明冲突，预览中的游戏/应用出现异常
ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />
);
`;

  files["public/robots.txt"] = `User-agent: *
Allow: /
`;

  return files;
}

export interface ReactProjectResult {
  files: Record<string, string>; // 源码 + dist 全部文件
  previewHtml: string;           // 站内预览用完整 HTML
}

/**
 * 把单文件 HTML 应用转换为 React 工程并构建。
 * 失败时返回 null（调用方回退到旧的 HTML 多文件输出）。
 */
export async function produceReactProject(html: string): Promise<ReactProjectResult | null> {
  try {
    const { bodyHtml, customCss, js, twTheme, title, bodyOnload, bodyClass, bodyStyle } = extractHtmlParts(html);

    const srcFiles: Record<string, string> = {
      "src/App.tsx": genAppTsx(bodyHtml, js, bodyOnload, bodyClass, bodyStyle),
      "src/index.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n/* 页面自定义样式 */\n${customCss}\n`,
    };

    const files: Record<string, string> = {
      ...boilerplateFiles(title, twTheme),
      ...srcFiles,
      ".gitignore": "node_modules/\ndist/\n.env\n.DS_Store\n*.log\n",
    };

    const build: BuildResult = await buildReactProject(files, title);
    if (!build.ok || !build.previewHtml || !build.distFiles) {
      console.error("[reactgen] 构建失败，回退 HTML 输出：", build.error);
      return null;
    }

    return {
      files: { ...files, ...build.distFiles },
      previewHtml: build.previewHtml,
    };
  } catch (e) {
    console.error("[reactgen] 转换异常，回退 HTML 输出：", e);
    return null;
  }
}
