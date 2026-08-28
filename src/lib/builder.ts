// 服务器端构建器：把 React + TypeScript + Tailwind 源码构建成可直接运行的版本
// 使用独立的 build-tools 目录（esbuild + tailwindcss v3 + react），与主项目的依赖隔离
import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BUILD_TOOLS_NM = path.join(process.cwd(), "build-tools", "node_modules");

/**
 * 冒烟验证：在 jsdom 里运行生成的单文件 HTML，返回运行期错误列表。
 * 用于交付前拦截「按钮点击无反应 / 脚本报错」这类问题。
 * 验证本身失败（环境问题等）时返回空数组，不阻断生成流程。
 */
export async function validateGeneratedHtml(html: string): Promise<string[]> {
  let tmp = "";
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-validate-"));
    const file = path.join(tmp, "app.html");
    fs.writeFileSync(file, html, "utf8");
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(process.execPath, [path.join(process.cwd(), "build-tools", "validate.js"), file], {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, NODE_PATH: BUILD_TOOLS_NM },
      }, (err, out) => (err ? reject(err) : resolve(out)));
    });
    const lastLine = stdout.trim().split("\n").pop() || "{}";
    const parsed = JSON.parse(lastLine);
    return Array.isArray(parsed.errors) ? parsed.errors : [];
  } catch {
    return [];
  } finally {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ } }
  }
}

export interface BuildResult {
  ok: boolean;
  error?: string;
  previewHtml?: string;
  distFiles?: Record<string, string>;
}

function runCmd(cmd: string, args: string[], cwd: string, extraEnv?: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, {
      cwd,
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, ...extraEnv },
    }, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr || String(err.message || err)));
      else resolve();
    });
  });
}

/**
 * 构建 React 项目源码（不含 dist/ 本身）。
 * 成功时返回：
 *  - previewHtml：样式/脚本全部内联的完整 HTML（供站内 iframe 预览）
 *  - distFiles：dist/app.js、dist/style.css、dist/index.html（供双击运行）
 */
export async function buildReactProject(files: Record<string, string>, title: string): Promise<BuildResult> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atoms-build-"));
  try {
    // 1) 写入源码文件（跳过 dist/ 与二进制无关文件）
    for (const [name, content] of Object.entries(files)) {
      if (name.startsWith("dist/") || name === "README.md" || name === ".gitignore") continue;
      const p = path.join(tmp, name);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content, "utf8");
    }
    if (!fs.existsSync(path.join(tmp, "src", "main.tsx"))) {
      return { ok: false, error: "缺少入口文件 src/main.tsx" };
    }
    if (!fs.existsSync(path.join(tmp, "src", "index.css"))) {
      return { ok: false, error: "缺少样式文件 src/index.css" };
    }

    // 2) 构建用 tailwind 配置：从项目自带的 tailwind.config 读取 theme（保证 primary 等自定义颜色生效）
    let themeExtend: Record<string, unknown> = {};
    const twCfgContent = files["tailwind.config.ts"] || files["tailwind.config.js"] || "";
    if (twCfgContent) {
      try {
        const body = twCfgContent
          .replace(/import\s+type[^\n]*\n?/g, "")   // 去掉 import type 行
          .replace(/export\s+default/, "return")    // export default → return
          .replace(/satisfies\s+[^;]+/g, "");       // 去掉 satisfies 类型断言（非运行时语法）
        const cfg: any = new Function(body)();
        themeExtend = cfg?.theme?.extend || {};
      } catch { /* 解析失败用空 theme */ }
    }
    fs.writeFileSync(
      path.join(tmp, "tailwind.build.config.js"),
      `module.exports = ${JSON.stringify({
        content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
        theme: { extend: themeExtend },
        plugins: [],
      })};\n`,
      "utf8"
    );

    // 3) Tailwind 编译：src/index.css → dist/style.css
    const tailwindCli = path.join(BUILD_TOOLS_NM, "tailwindcss", "lib", "cli.js");
    await runCmd(process.execPath, [
      tailwindCli,
      "-c", path.join(tmp, "tailwind.build.config.js"),
      "-i", path.join(tmp, "src", "index.css"),
      "-o", path.join(tmp, "dist", "style.css"),
      "--minify",
    ], tmp);

    // 4) esbuild 打包：src/main.tsx → dist/app.js（IIFE，file:// 双击可用）
    // 通过 CLI 二进制调用（避免 Next 打包器静态分析动态 require）；NODE_PATH 提供 react 等依赖解析
    const esbuildBin = path.join(BUILD_TOOLS_NM, "esbuild", "bin", "esbuild");
    try {
      await runCmd(esbuildBin, [
        path.join(tmp, "src", "main.tsx"),
        "--bundle",
        "--outfile=" + path.join(tmp, "dist", "app.js"),
        "--format=iife",
        "--jsx=automatic",
        "--target=es2017",
        '--define:process.env.NODE_ENV="production"',
        "--loader:.js=jsx",
        "--loader:.jsx=jsx",
        "--loader:.ts=ts",
        "--loader:.tsx=tsx",
        "--log-level=warning",
      ], tmp, { NODE_PATH: BUILD_TOOLS_NM });
    } catch (e: any) {
      return { ok: false, error: `esbuild 构建失败：\n${String(e?.message || e)}` };
    }

    const appJs = fs.readFileSync(path.join(tmp, "dist", "app.js"), "utf8");
    const styleCss = fs.readFileSync(path.join(tmp, "dist", "style.css"), "utf8");

    // 5) 组装站内预览 HTML（内联，iframe srcDoc 可用）
    const previewHtml =
      `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1.0">\n` +
      `<title>${title}</title>\n<style>\n${styleCss}\n</style>\n</head>\n<body>\n` +
      `<div id="root"></div>\n<script>\n${appJs}\n</script>\n</body>\n</html>`;

    // 6) 组装双击运行版 dist/index.html（相对路径引用同目录产物）
    const distIndex =
      `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1.0">\n` +
      `<link rel="icon" type="image/svg+xml" href="../public/favicon.svg">\n` +
      `<title>${title}</title>\n<link rel="stylesheet" href="./style.css">\n</head>\n<body>\n` +
      `<div id="root"></div>\n<script src="./app.js"></script>\n</body>\n</html>`;

    return {
      ok: true,
      previewHtml,
      distFiles: {
        "dist/app.js": appJs,
        "dist/style.css": styleCss,
        "dist/index.html": distIndex,
      },
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
