import { buildReactProject } from "@/lib/builder";

// 用户在编辑器修改 React 源码后，调用本接口重新构建预览
export async function POST(request: Request) {
  try {
    const { files } = await request.json();
    if (!files || typeof files !== "object") {
      return Response.json({ ok: false, error: "缺少文件内容" });
    }
    const titleMatch = (files["index.html"] || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = (titleMatch?.[1] || "应用").trim();
    const result = await buildReactProject(files, title);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e?.message || e) });
  }
}
