import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({ activePromptTemplateIds: z.array(z.string()) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const activeSet = new Set(parsed.data.activePromptTemplateIds);
  const existing = await prisma.projectPrompt.findMany({ where: { brandProjectId: id } });

  await prisma.$transaction(
    existing.map((pp) =>
      prisma.projectPrompt.update({
        where: { id: pp.id },
        data: { active: activeSet.has(pp.promptTemplateId) },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
