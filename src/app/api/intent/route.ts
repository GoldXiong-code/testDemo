import { NextRequest, NextResponse } from "next/server";

// 意图识别：只有 webapp 和 qa（兜底）
function detectIntent(prompt: string): "webapp" | "qa" {
  const p = prompt.toLowerCase();
  const webappKeywords = ["网站", "app", "应用", "系统", "平台", "商城", "论坛",
    "小程序", "网页", "做个", "做一个", "帮我做", "创建", "开发", "搭建",
    "写一个", "写个", "做一个网页", "做一个网站", "做一个app",
    // 小游戏也是要做产品，不是问答
    "游戏", "小游戏", "贪吃蛇", "贪食蛇", "超级玛丽", "马里奥", "玛丽",
    "水果忍者", "俄罗斯方块", "消消乐", "跑酷", "扫雷", "五子棋", "象棋",
    "围棋", "打砖块", "飞机大战", "2048", "flappy", "game", "来一局",
    // 小工具也是要做产品，不是问答
    "工具", "计算器", "计算", "番茄钟", "番茄工作法", "倒计时", "待办", "清单",
    "打卡", "记账", "账单", "换算", "换算器", "密码生成", "抽签", "选择器",
    "吃什么", "房贷", "计时器", "提醒", "笔记", "转换器",
    // 数据看板也是要做产品，不是问答
    "看板", "仪表盘", "数据大屏", "大屏", "报表", "统计图", "图表", "运营监控", "监控看板"];
  if (webappKeywords.some(k => p.includes(k))) return "webapp";
  return "qa";
}

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "请输入内容" }, { status: 400 });
  }

  const intent = detectIntent(prompt);
  return NextResponse.json({ intent });
}
