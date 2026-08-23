import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validators";
import bcrypt from "bcrypt";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Zod 表单校验
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // 检查邮箱是否已注册
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingEmail) {
      return NextResponse.json(
        { success: false, message: "该邮箱已被注册" },
        { status: 400 }
      );
    }

    // 检查用户名是否已存在
    const existingName = await prisma.user.findUnique({
      where: { name: name },
    });

    if (existingName) {
      return NextResponse.json(
        { success: false, message: "该用户名已被使用，请换一个" },
        { status: 400 }
      );
    }

    // bcrypt 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    return NextResponse.json({
      success: true,
      message: "注册成功",
      user,
    });
  } catch (error) {
    console.error("注册错误:", error);
    return NextResponse.json(
      { success: false, message: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}
