import { NextResponse } from "next/server";

const API_KEY = "sk-7ab4485a943f4159ac1fc101e903c218";
const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MODEL = "qwen3.7-flash-2026-07-15";

async function callLLM(messages: { role: string; content: string }[]) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(request: Request) {
  const { prompt } = await request.json();
  if (!prompt) {
    return NextResponse.json({ success: false, message: "缺少输入" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        // ===== Agent 1: 意图判断 =====
        send({ type: "thinking", stage: 0, text: "Alex 正在分析你的意图..." });

        const intentRes = await callLLM([
          {
            role: "system",
            content: `你是一个意图分类器。根据用户输入，判断意图类型，严格返回 JSON：
{"intent":"image|plan|question","reason":"简短说明"}

规则：
- 包含画图、绘图、画、设计logo、画个、画一张、生成图片、图片 等关键词 → image
- 包含方案、规划、计划、分析、策略、建议、报告、文案、产品、设计、构建、开发、创建 等关键词 → plan
- 普通问题、知识问答、数学计算等 → question

只返回 JSON，不要其他内容。`,
          },
          { role: "user", content: prompt },
        ]);

        let intent = "question";
        try {
          // 提取 JSON（AI 可能加 markdown 代码块）
          const jsonMatch = intentRes.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            intent = parsed.intent || "question";
          }
        } catch {
          intent = "question";
        }

        send({ type: "intent", intent, reason: intentRes });

        // ===== Agent 2 或 Agent 3 =====
        if (intent === "image") {
          send({ type: "thinking", stage: 1, text: "Alex 正在绘制图像..." });

          const svgRes = await callLLM([
            {
              role: "system",
              content: `你是一个 SVG 绘图专家。根据用户描述，生成一个精美的 SVG 图像。

要求：
1. 只返回 SVG 代码，用 \`\`\`svg 包裹
2. 使用现代简洁的设计风格
3. 尺寸 600x400
4. 使用渐变和圆角
5. 配色和谐美观
6. 不要包含任何脚本或外部引用`,
            },
            { role: "user", content: prompt },
          ]);

          // 提取 SVG 代码
          const svgMatch = svgRes.match(/```svg\s*([\s\S]*?)```/);
          const svgCode = svgMatch ? svgMatch[1].trim() : svgRes.trim();

          send({ type: "content", content: svgCode, contentType: "svg" });
        } else if (intent === "plan") {
          send({ type: "thinking", stage: 1, text: "Alex 正在生成文字方案..." });

          const textRes = await fetch(`${BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
              model: MODEL,
              messages: [
                {
                  role: "system",
                  content: "你是一个专业的产品顾问 AI 助手，帮助用户将想法转化为可销售的产品方案。请用中文回复，使用 Markdown 格式，包含标题、列表、表格等结构化内容。回复时先简要分析用户需求，再给出详细方案。",
                },
                { role: "user", content: prompt },
              ],
              max_tokens: 4096,
              temperature: 0.7,
              stream: true,
            }),
          });

          const reader = textRes.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  send({ type: "done" });
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || "";
                  if (content) {
                    send({ type: "content", content, contentType: "text" });
                  }
                } catch { /* ignore */ }
              }
            }
          }
        } else {
          // question: 普通问答，直接回答
          send({ type: "thinking", stage: 1, text: "Alex 正在回答你的问题..." });

          const textRes = await fetch(`${BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
              model: MODEL,
              messages: [
                {
                  role: "system",
                  content: "你是一个友好的 AI 助手，用简洁自然的中文回答用户问题。不需要生成产品方案，直接回答问题即可。如果问题简单，回答简短即可。",
                },
                { role: "user", content: prompt },
              ],
              max_tokens: 1024,
              temperature: 0.7,
              stream: true,
            }),
          });

          const reader = textRes.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  send({ type: "done" });
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || "";
                  if (content) {
                    send({ type: "content", content, contentType: "text" });
                  }
                } catch { /* ignore */ }
              }
            }
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (error) {
        send({ type: "error", message: "服务异常，请稍后重试" });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
