import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({ text: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Prompt text is required" }, { status: 400 });
  }

  const project = await prisma.brandProject.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const promptTemplate = await prisma.promptTemplate.create({
    data: {
      text: parsed.data.text.trim(),
      category: "custom",
      isDefault: false,
      brandProjectId: id,
    },
  });

  await prisma.projectPrompt.create({
    data: { brandProjectId: id, promptTemplateId: promptTemplate.id, active: true },
  });

  return NextResponse.json({ promptTemplate }, { status: 201 });
}
