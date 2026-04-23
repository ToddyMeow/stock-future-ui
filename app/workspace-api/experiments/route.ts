import { NextRequest, NextResponse } from "next/server"

import {
  launchExperiment,
  listExperimentRuns,
} from "@/lib/experiments-server"
import type { ExperimentLaunchRequest } from "@/lib/types"

export const runtime = "nodejs"

export async function GET() {
  const runs = await listExperimentRuns()
  return NextResponse.json({ runs })
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as ExperimentLaunchRequest
  const run = await launchExperiment(payload)
  return NextResponse.json({ run }, { status: 201 })
}
