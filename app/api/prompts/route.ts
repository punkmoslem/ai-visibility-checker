import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const prompts = await prisma.promptTemplate.findMany({
    where: { isDefault: true, brandProjectId: null },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ prompts });
}
