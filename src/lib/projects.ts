// Builder 项目持久化 —— SQLite（真实 Prisma 客户端）
// 注意：lib/db.ts 里的 prisma 是 JSON 文件模拟（历史遗留，仅用户模块在用），
// 项目/版本数据走这里真实的 SQLite 数据库 dev.db（根目录，与 prisma.config.ts 一致）
// Prisma 7 需要驱动适配器才能连接 SQLite，这里用 libsql 适配器（纯 JS，无需编译）
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const adapter = new PrismaLibSql({ url: `file:${path.join(process.cwd(), "dev.db")}` });
const db = new PrismaClient({ adapter });

export interface SaveGenerationInput {
  projectId?: string;   // 有值 = 在已有项目上追加新版本（重新生成）
  userId?: string;
  clientId?: string;
  title: string;
  category: string;
  prompt: string;
  planJson?: string;
  fullCode?: string;
  sourceFiles?: Record<string, string>;
  previewHtml?: string;
}

// 生成完成后调用：新建项目或追加版本；失败返回 null（绝不影响生成主流程）
export async function saveGeneration(input: SaveGenerationInput): Promise<string | null> {
  try {
    const versionData = {
      planJson: input.planJson || null,
      fullCode: input.fullCode || null,
      sourceFiles: input.sourceFiles && Object.keys(input.sourceFiles).length ? JSON.stringify(input.sourceFiles) : null,
      previewHtml: input.previewHtml || null,
    };

    if (input.projectId) {
      const existing = await db.project.findUnique({ where: { id: input.projectId } });
      if (existing) {
        await db.projectVersion.create({ data: { projectId: existing.id, ...versionData } });
        await db.project.update({
          where: { id: existing.id },
          data: { ...(input.title ? { title: input.title } : {}), updatedAt: new Date() },
        });
        return existing.id;
      }
    }

    const project = await db.project.create({
      data: {
        userId: input.userId || null,
        clientId: input.clientId || null,
        title: input.title,
        category: input.category,
        prompt: input.prompt,
        versions: { create: versionData },
      },
    });
    return project.id;
  } catch (e) {
    console.error("[projects] 保存项目失败（不影响生成）:", e);
    return null;
  }
}

// 历史列表（登录用户按 userId，未登录按浏览器设备 ID）
export async function listProjects(userId?: string, clientId?: string) {
  if (!userId && !clientId) return [];
  const where = userId ? { userId } : { clientId: clientId! };
  return db.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true, title: true, category: true, prompt: true, updatedAt: true,
      _count: { select: { versions: true } },
    },
  });
}

// 详情：带最新版本（用于恢复预览和代码）
export async function getProject(id: string) {
  const project = await db.project.findUnique({
    where: { id },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!project) return null;
  const v = project.versions[0];
  return {
    id: project.id,
    title: project.title,
    category: project.category,
    prompt: project.prompt,
    updatedAt: project.updatedAt,
    versionCount: await db.projectVersion.count({ where: { projectId: id } }),
    version: v
      ? {
          planJson: v.planJson,
          fullCode: v.fullCode,
          sourceFiles: v.sourceFiles ? JSON.parse(v.sourceFiles) : {},
          previewHtml: v.previewHtml,
          createdAt: v.createdAt,
        }
      : null,
  };
}

export async function deleteProject(id: string) {
  await db.project.delete({ where: { id } }); // 版本随 onDelete: Cascade 一起删
}
