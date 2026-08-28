import { NextRequest, NextResponse } from "next/server";

// 密钥只从环境变量读取（.env 文件，已在 .gitignore 中），禁止硬编码
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || "";
const DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

// 思考过程阶段提示
const THINKING_STAGES = [
  "正在理解你的需求...",
  "分析关键词和上下文...",
  "构建方案框架...",
  "生成核心内容...",
  "优化结构和表达...",
  "检查内容完整性...",
];

export async function POST(request: NextRequest) {
  const { prompt, model } = await request.json();

  if (!prompt || !model) {
    return NextResponse.json(
      { success: false, message: "缺少必要参数" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 阶段 1: 开始思考
        const sendStage = (stage: number, text: string) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "thinking", stage, text })}\n\n`
            )
          );
        };

        sendStage(0, THINKING_STAGES[0]);
        await new Promise((r) => setTimeout(r, 300));

        sendStage(1, THINKING_STAGES[1]);
        await new Promise((r) => setTimeout(r, 200));

        // 调用通义千问流式 API
        const response = await fetch(
          `${DASHSCOPE_BASE_URL}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: "system",
                  content:
                    "你是一个专业的产品顾问 AI 助手，帮助用户将想法转化为可销售的产品方案。请用中文回复，使用 Markdown 格式，包含标题、列表、表格等结构化内容。回复时先简要分析用户需求，再给出详细方案。",
                },
                {
                  role: "user",
                  content: prompt,
                },
              ],
              max_tokens: 4096,
              temperature: 0.7,
              stream: true,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message:
                  errorData.error?.message || "AI 生成失败，请稍后重试",
              })}\n\n`
            )
          );
          controller.close();
          return;
        }

        sendStage(2, THINKING_STAGES[2]);

        const reader = response.body!.getReader();
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
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "done" })}\n\n`
                  )
                );
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "content",
                        content: content,
                      })}\n\n`
                    )
                  );
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              message: "服务异常，请稍后重试",
            })}\n\n`
          )
        );
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
