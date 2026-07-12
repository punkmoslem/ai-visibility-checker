import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({ name: z.string().min(1).max(400) });

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

  // A comma-separated entry ("Brand A, Brand B") is a list — each name becomes its own competitor.
  const names = parsed.data.name
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && n.length <= 80);
  if (names.length === 0) {
    return NextResponse.json({ error: "Competitor name is required" }, { status: 400 });
  }

  const existing = new Set(project.competitors.map((c) => c.name.toLowerCase()));
  existing.add(project.brandName.toLowerCase());
  const toCreate: string[] = [];
  for (const name of names) {
    if (existing.has(name.toLowerCase())) continue;
    existing.add(name.toLowerCase());
    toCreate.push(name);
  }

  if (toCreate.length === 0) {
    return NextResponse.json({ error: "That name is already being tracked" }, { status: 400 });
  }
  if (project.competitors.length + toCreate.length > 5) {
    return NextResponse.json({ error: "Maximum of 5 competitors per project" }, { status: 400 });
  }

  const competitors = await prisma.$transaction(
    toCreate.map((name) => prisma.competitor.create({ data: { brandProjectId: id, name } }))
  );
  return NextResponse.json({ competitors }, { status: 201 });
}
