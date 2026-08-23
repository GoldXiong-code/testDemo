import { PrismaClient } from "@prisma/client";

// Prisma 7 + SQLite 需要特殊配置
// 暂时使用 JSON 文件数据库，后续切换到 MySQL 时只需改一行配置
const DB_PATH = "./data/db.json";

// 读取数据库
function readDb(): { users: any[] } {
  try {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join(process.cwd(), DB_PATH);
    if (!fs.existsSync(filePath)) {
      return { users: [] };
    }
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return { users: [] };
  }
}

// 写入数据库
function writeDb(data: { users: any[] }) {
  const fs = require("fs");
  const path = require("path");
  const filePath = path.join(process.cwd(), DB_PATH);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Prisma 兼容接口
export const prisma = {
  user: {
    findUnique: async ({ where }: { where: { email?: string; name?: string } }) => {
      const db = readDb();
      if (where.email) {
        return db.users.find((u: any) => u.email === where.email) || null;
      }
      if (where.name) {
        return db.users.find((u: any) => u.name === where.name) || null;
      }
      return null;
    },

    create: async ({ data }: { data: any }) => {
      const db = readDb();
      const newUser = {
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
        password: data.password,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.users.push(newUser);
      writeDb(db);
      return newUser;
    },
  },
} as any;
