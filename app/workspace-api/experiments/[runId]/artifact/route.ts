import { NextRequest, NextResponse } from "next/server"

import { readExperimentArtifact } from "@/lib/experiments-server"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: RouteContext<"/workspace-api/experiments/[runId]/artifact">,
) {
  const { runId } = await context.params
  const searchParams = request.nextUrl.searchParams
  const capital = searchParams.get("capital")
  const phase = searchParams.get("phase")
  const artifact = searchParams.get("artifact")
  const limit = Number(searchParams.get("limit") ?? "200")

  if (!capital || !phase || !artifact) {
    return NextResponse.json(
      { error: "capital, phase and artifact are required" },
      { status: 400 },
    )
  }

  const response = await readExperimentArtifact({
    runId,
    capital,
    phase,
    artifact,
    limit,
  })
  if (!response) {
    return NextResponse.json({ error: "artifact not found" }, { status: 404 })
  }
  return NextResponse.json(response)
}
