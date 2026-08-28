// JSON 文件数据库（轻量方案，无需外部数据库服务）
const DB_PATH = "./data/db.json";

// 读取数据库
function readDb(): { users: any[]; productImages?: any[] } {
  try {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join(process.cwd(), DB_PATH);
    if (!fs.existsSync(filePath)) {
      return { users: [], productImages: [] };
    }
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return { users: [], productImages: [] };
  }
}

// 写入数据库
function writeDb(data: { users: any[]; productImages?: any[] }) {
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

  productImage: {
    findMany: async ({ where }: { where?: { category?: string } } = {}) => {
      const db = readDb();
      const images = db.productImages || [];
      if (where?.category) {
        return images.filter((img: any) => img.category === where.category);
      }
      return images;
    },

    findByTags: async ({ tags, category }: { tags: string[]; category?: string }) => {
      const db = readDb();
      let images = db.productImages || [];
      if (category) {
        images = images.filter((img: any) => img.category === category);
      }
      // 按标签匹配度排序
      return images
        .map((img: any) => {
          const matchCount = tags.filter((tag) =>
            [...img.tags, img.name, img.category].some(
              (t: string) => t.includes(tag) || tag.includes(t)
            )
          ).length;
          return { ...img, _matchCount: matchCount };
        })
        .filter((img) => img._matchCount > 0)
        .sort((a, b) => b._matchCount - a._matchCount);
    },

    getRandom: async ({ category, count = 5 }: { category?: string; count?: number }) => {
      const db = readDb();
      let images = db.productImages || [];
      if (category) {
        images = images.filter((img: any) => img.category === category);
      }
      // 随机打乱，取前 N 个
      const shuffled = [...images].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    },
  },
} as any;
