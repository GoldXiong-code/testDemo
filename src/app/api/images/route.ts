import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/images
 * 查询商品图片库
 *
 * 参数:
 *   category - 分类: electronics/clothing/home/food/sports
 *   tags     - 标签逗号分隔: 手机,数码,phone
 *   random   - 随机数量 (如 ?random=5)
 *   all      - 返回全部 (1)
 *
 * 示例:
 *   GET /api/images?category=electronics
 *   GET /api/images?tags=手机,数码&count=3
 *   GET /api/images?random=8
 *   GET /api/images?all=1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const category = searchParams.get("category") || undefined;
    const tagsStr = searchParams.get("tags");
    const randomCount = searchParams.get("random");
    const all = searchParams.get("all");

    // 按标签查询
    if (tagsStr) {
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      const images = await prisma.productImage.findByTags({ tags, category });
      const count = parseInt(searchParams.get("count") || "10");
      return NextResponse.json({ images: images.slice(0, count) });
    }

    // 随机查询
    if (randomCount) {
      const images = await prisma.productImage.getRandom({
        category,
        count: parseInt(randomCount),
      });
      return NextResponse.json({ images });
    }

    // 全部分类列表
    if (all === "1") {
      const images = await prisma.productImage.findMany();
      return NextResponse.json({ images });
    }

    // 按分类查询（默认）
    const images = await prisma.productImage.findMany({ where: { category } });

    // 如果没指定分类，按分类分组返回
    if (!category) {
      const grouped: Record<string, any[]> = {};
      images.forEach((img: any) => {
        if (!grouped[img.category]) grouped[img.category] = [];
        grouped[img.category].push(img);
      });
      return NextResponse.json({ grouped, total: images.length });
    }

    return NextResponse.json({ images, total: images.length });
  } catch (error) {
    console.error("图片 API 错误:", error);
    return NextResponse.json(
      { error: "获取图片失败" },
      { status: 500 }
    );
  }
}
