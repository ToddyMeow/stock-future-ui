import { NextResponse } from "next/server"

import { readExperimentReport } from "@/lib/experiments-server"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: RouteContext<"/workspace-api/experiments/[runId]/report">,
) {
  const { runId } = await context.params
  const report = await readExperimentReport(runId)
  if (report == null) {
    return NextResponse.json({ error: "report not found" }, { status: 404 })
  }
  return new NextResponse(report, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  })
}
