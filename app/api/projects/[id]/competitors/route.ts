import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({ name: z.string().min(1).max(80) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Competitor name is required" }, { status: 400 });
  }

  const project = await prisma.brandProject.findUnique({ where: { id }, include: { competitors: true } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (project.competitors.length >= 5) {
    return NextResponse.json({ error: "Maximum of 5 competitors per project" }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const duplicate = project.competitors.some((c) => c.name.toLowerCase() === name.toLowerCase());
  if (duplicate || name.toLowerCase() === project.brandName.toLowerCase()) {
    return NextResponse.json({ error: "That name is already being tracked" }, { status: 400 });
  }

  const competitor = await prisma.competitor.create({ data: { brandProjectId: id, name } });
  return NextResponse.json({ competitor }, { status: 201 });
}
