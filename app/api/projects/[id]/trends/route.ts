import { NextResponse } from "next/server";
import { computeTrends } from "@/lib/dashboard";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trends = await computeTrends(id);
  return NextResponse.json({ trends });
}
