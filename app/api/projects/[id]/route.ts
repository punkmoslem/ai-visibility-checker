import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.brandProject.findUnique({
    where: { id },
    include: {
      competitors: true,
      schedules: true,
      prompts: { include: { promptTemplate: true }, orderBy: { createdAt: "asc" } },
      runs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}
