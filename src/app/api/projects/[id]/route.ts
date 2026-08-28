import { NextRequest, NextResponse } from "next/server";
import { getProject, deleteProject } from "@/lib/projects";

type Context = { params: Promise<{ id: string }> };

// GET /api/projects/[id] —— 获取项目详情（含最新版本，用于恢复预览）
export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ project });
}

// DELETE /api/projects/[id] —— 删除项目（版本级联删除）
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
