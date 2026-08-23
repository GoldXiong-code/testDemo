import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name || name.length < 2) {
    return NextResponse.json({ available: false, message: "用户名至少 2 个字符" });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { name },
    });

    if (existingUser) {
      return NextResponse.json({ available: false, message: "该用户名已被使用" });
    }

    return NextResponse.json({ available: true, message: "用户名可用" });
  } catch {
    return NextResponse.json({ available: true, message: "用户名可用" });
  }
}
