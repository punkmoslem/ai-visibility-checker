import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1),
  brandName: z.string().min(1),
  industry: z.string().min(1),
  entityType: z.enum(["company", "person"]).default("company"),
});

export async function GET() {
  const projects = await prisma.brandProject.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const project = await prisma.brandProject.create({ data: parsed.data });

  const defaults = await prisma.promptTemplate.findMany({
    where: { isDefault: true, brandProjectId: null, entityType: parsed.data.entityType },
  });
  if (defaults.length > 0) {
    await prisma.projectPrompt.createMany({
      data: defaults.map((p) => ({
        brandProjectId: project.id,
        promptTemplateId: p.id,
        active: true,
      })),
    });
  }

  return NextResponse.json({ project }, { status: 201 });
}
