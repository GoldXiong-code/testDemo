import { z } from "zod";

// 注册表单校验
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "用户名至少 2 个字符")
    .max(20, "用户名最多 20 个字符")
    .regex(/^[a-zA-Z0-9一-龥]+$/, "用户名只能包含字母、数字和中文"),

  email: z
    .string()
    .min(1, "请输入邮箱地址")
    .email("请输入有效的邮箱地址（例如：user@example.com）")
    .regex(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "邮箱格式不正确"
    ),

  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .max(32, "密码最多 32 个字符")
    .regex(/[A-Za-z]/, "密码必须包含至少一个字母")
    .regex(/[0-9]/, "密码必须包含至少一个数字"),

  confirmPassword: z.string().min(1, "请确认密码"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

// 登录表单校验
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "请输入邮箱地址")
    .email("请输入有效的邮箱地址"),

  password: z.string().min(1, "请输入密码"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
