import { NextRequest, NextResponse } from "next/server"

import { readExperimentPhaseSummary } from "@/lib/experiments-server"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: RouteContext<"/workspace-api/experiments/[runId]/phase-summary">,
) {
  const { runId } = await context.params
  const searchParams = request.nextUrl.searchParams
  const capital = searchParams.get("capital")
  const phase = searchParams.get("phase")

  if (!capital || !phase) {
    return NextResponse.json(
      { error: "capital and phase are required" },
      { status: 400 },
    )
  }

  const response = await readExperimentPhaseSummary({
    runId,
    capital,
    phase,
  })
  if (!response) {
    return NextResponse.json({ error: "phase summary not found" }, { status: 404 })
  }
  return NextResponse.json(response)
}
