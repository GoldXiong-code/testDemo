import { NextRequest, NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";

// GET /api/projects?userId=xxx 或 ?clientId=xxx —— 拉取历史项目列表
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") || undefined;
  const clientId = request.nextUrl.searchParams.get("clientId") || undefined;
  const projects = await listProjects(userId, clientId);
  return NextResponse.json({ projects });
}
