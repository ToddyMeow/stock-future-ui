/**
 * components/status-badges.tsx — 业务状态着色徽章（可复用）
 */
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  type AlertSeverity,
  type InstructionAction,
  type InstructionDirection,
  type InstructionStatus,
  type InstructionSession,
  ACTION_LABELS,
  DIRECTION_LABELS,
  STATUS_LABELS,
  SESSION_LABELS,
  SEVERITY_LABELS,
} from "@/lib/types"

const STATUS_CLASSES: Record<InstructionStatus, string> = {
  pending:
    "bg-transparent text-foreground/70 border-border",
  fully_filled:
    "bg-green-100 text-green-700 border-transparent dark:bg-green-950 dark:text-green-300",
  partially_filled:
    "bg-yellow-100 text-yellow-700 border-transparent dark:bg-yellow-950 dark:text-yellow-300",
  vetoed:
    "bg-red-100 text-red-700 border-transparent dark:bg-red-950 dark:text-red-300",
  skipped:
    "bg-gray-100 text-gray-600 border-transparent dark:bg-gray-800 dark:text-gray-300",
  expired:
    "bg-zinc-200 text-zinc-500 border-transparent dark:bg-zinc-800 dark:text-zinc-400",
}

export function StatusBadge({ status }: { status: InstructionStatus }) {
  return (
    <Badge
      variant={status === "pending" ? "outline" : "default"}
      className={cn(STATUS_CLASSES[status])}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const ACTION_CLASSES: Record<InstructionAction, string> = {
  open: "bg-blue-100 text-blue-700 border-transparent dark:bg-blue-950 dark:text-blue-300",
  close: "bg-purple-100 text-purple-700 border-transparent dark:bg-purple-950 dark:text-purple-300",
  add: "bg-teal-100 text-teal-700 border-transparent dark:bg-teal-950 dark:text-teal-300",
  reduce: "bg-orange-100 text-orange-700 border-transparent dark:bg-orange-950 dark:text-orange-300",
}

export function ActionBadge({ action }: { action: InstructionAction }) {
  return (
    <Badge className={cn(ACTION_CLASSES[action])}>{ACTION_LABELS[action]}</Badge>
  )
}

export function DirectionBadge({
  direction,
}: {
  direction: InstructionDirection
}) {
  return (
    <Badge
      className={cn(
        direction === "long"
          ? "bg-green-600 text-white border-transparent"
          : "bg-red-600 text-white border-transparent",
      )}
    >
      {DIRECTION_LABELS[direction]}
    </Badge>
  )
}

export function SessionBadge({ session }: { session: InstructionSession }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-border",
        session === "day" ? "text-amber-700" : "text-indigo-700",
      )}
    >
      {SESSION_LABELS[session]}
    </Badge>
  )
}

const SEVERITY_CLASSES: Record<AlertSeverity, string> = {
  info: "bg-blue-100 text-blue-700 border-transparent dark:bg-blue-950 dark:text-blue-300",
  warn: "bg-yellow-100 text-yellow-700 border-transparent dark:bg-yellow-950 dark:text-yellow-300",
  critical:
    "bg-red-100 text-red-700 border-transparent dark:bg-red-950 dark:text-red-300",
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <Badge className={cn(SEVERITY_CLASSES[severity])}>
      {SEVERITY_LABELS[severity]}
    </Badge>
  )
}

/** 数字颜色助手：正绿负红。 */
export function pnlClass(n: number): string {
  if (n > 0) return "text-green-600 dark:text-green-400"
  if (n < 0) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}
