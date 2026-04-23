import { NextRequest, NextResponse } from "next/server"

import {
  archiveExperimentRun,
  deleteExperimentRun,
  readExperimentRun,
  restoreExperimentRun,
} from "@/lib/experiments-server"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: RouteContext<"/workspace-api/experiments/[runId]">,
) {
  const { runId } = await context.params
  const run = await readExperimentRun(runId)
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 })
  }
  return NextResponse.json({ run })
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/workspace-api/experiments/[runId]">,
) {
  const { runId } = await context.params
  const payload = (await request.json().catch(() => ({}))) as { action?: string }

  try {
    const run =
      payload.action === "restore"
        ? await restoreExperimentRun(runId)
        : await archiveExperimentRun(runId)
    if (!run) {
      return NextResponse.json({ error: "run not found" }, { status: 404 })
    }
    return NextResponse.json({ run })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === "run not found" ? 404 : 409
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/workspace-api/experiments/[runId]">,
) {
  const { runId } = await context.params
  try {
    await deleteExperimentRun(runId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === "run not found" ? 404 : 409
    return NextResponse.json({ error: message }, { status })
  }
}
