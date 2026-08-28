// 冒烟验证：在 jsdom 里运行生成的 HTML，收集脚本运行期错误 + 内联事件引用检查
// 用法: node validate.js <html文件路径>
// 输出: JSON { errors: string[] }
const fs = require("fs");
const { JSDOM, VirtualConsole } = require("jsdom");

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.log(JSON.stringify({ errors: ["验证文件不存在"] }));
  process.exit(0);
}

const html = fs.readFileSync(file, "utf8");
const errors = [];

const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  const msg = String(e?.detail?.message || e?.detail || e?.message || e);
  if (msg && !/Could not load|css/i.test(msg)) errors.push(msg);
});
// 其他输出静默
["log", "info", "warn", "error", "debug"].forEach((m) => vc.on(m, () => {}));

let dom;
try {
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/",
    virtualConsole: vc,
    beforeParse(window) {
      // canvas 2d 上下文打桩
      const ctxStub = new Proxy({}, { get: () => () => ctxStub, set: () => true });
      window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
      // 常见缺失 API 打桩
      window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
      }));
      window.AudioContext = window.AudioContext || function () {
        return {
          createOscillator: () => ({ connect() {}, start() {}, stop() {}, frequency: { value: 0 }, type: "" }),
          createGain: () => ({ connect() {}, gain: { value: 0 } }),
          destination: {}, currentTime: 0, resume() { return Promise.resolve(); },
        };
      };
      window.addEventListener("error", (e) => { if (e.message) errors.push(String(e.message)); });
    },
  });
} catch (e) {
  console.log(JSON.stringify({ errors: ["页面初始化失败: " + String(e?.message || e)] }));
  process.exit(0);
}

// 等脚本初始化执行完，再检查内联事件引用的全局变量是否存在
setTimeout(() => {
  try {
    const doc = dom.window.document;
    const seen = new Set();
    const els = doc.querySelectorAll("[onclick],[onchange],[oninput],[onsubmit],[onkeydown],[onkeyup]");
    for (const el of els) {
      for (const attr of ["onclick", "onchange", "oninput", "onsubmit", "onkeydown", "onkeyup"]) {
        const v = el.getAttribute(attr);
        if (!v) continue;
        // 匹配形如 name(...) 的调用（支持 obj.method(...) 里检查 obj）
        const m = String(v).match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
        if (m && !seen.has(m[1])) {
          seen.add(m[1]);
          if (dom.window[m[1]] === undefined && !["event", "this"].includes(m[1])) {
            errors.push(`内联事件 ${attr} 引用的全局变量 "${m[1]}" 未定义，点击会无反应`);
          }
        }
      }
    }
  } catch { /* ignore */ }

  const unique = [...new Set(errors.map((s) => {
    // 归一化：去掉 "Uncaught [ReferenceError: xxx]" 外壳，避免同一错误重复出现
    const m = s.match(/^Uncaught \[[\w$]+: ([\s\S]+)\]$/);
    return (m ? m[1] : s).trim();
  }))].slice(0, 8).map((s) => s.slice(0, 300));
  console.log(JSON.stringify({ errors: unique }));
  try { dom.window.close(); } catch { /* ignore */ }
  process.exit(0);
}, 1500);
