import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { nextRunAtFrom } from "@/lib/scheduleRunner";

const schema = z.object({ frequency: z.enum(["off", "weekly", "monthly"]) });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
  }

  const project = await prisma.brandProject.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.schedule.findFirst({ where: { brandProjectId: id } });
  const { frequency } = parsed.data;

  if (frequency === "off") {
    if (existing) {
      await prisma.schedule.update({ where: { id: existing.id }, data: { active: false } });
    }
    return NextResponse.json({ schedule: null });
  }

  const nextRunAt = nextRunAtFrom(new Date(), frequency);
  const schedule = existing
    ? await prisma.schedule.update({
        where: { id: existing.id },
        data: { frequency, nextRunAt, active: true },
      })
    : await prisma.schedule.create({
        data: { brandProjectId: id, frequency, nextRunAt, active: true },
      });

  return NextResponse.json({ schedule });
}
