import { NextResponse } from "next/server"

import { readExperimentStrategyCatalog } from "@/lib/experiments-server"

export const runtime = "nodejs"

export async function GET() {
  const catalog = await readExperimentStrategyCatalog()
  return NextResponse.json({ catalog })
}
