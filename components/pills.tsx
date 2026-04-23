import type {
  AlertSeverity,
  InstructionAction,
  InstructionDirection,
  InstructionStatus,
} from "@/lib/types"

const STATUS_LABEL: Record<InstructionStatus, string> = {
  pending: "待处理",
  fully_filled: "已成交",
  partially_filled: "部分成交",
  vetoed: "已否决",
  skipped: "已跳过",
  expired: "已过期",
}

const STATUS_CLASS: Record<InstructionStatus, string> = {
  pending: "pending",
  fully_filled: "filled",
  partially_filled: "partial",
  vetoed: "vetoed",
  skipped: "skipped",
  expired: "skipped",
}

const ACTION_LABEL: Record<InstructionAction, string> = {
  open: "开仓",
  close: "平仓",
  add: "加仓",
  reduce: "减仓",
}

const SEV_LABEL: Record<AlertSeverity, string> = {
  info: "信息",
  warn: "警告",
  critical: "严重",
}

export function StatusPill({ status }: { status: InstructionStatus }) {
  return (
    <span className={`pill ${STATUS_CLASS[status]}`}>
      <span className="dot" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function ActionPill({ action }: { action: InstructionAction }) {
  return (
    <span className={`act ${action}`}>
      <span className="dot" />
      {ACTION_LABEL[action]}
    </span>
  )
}

export function DirPill({ dir }: { dir: InstructionDirection }) {
  return <span className={`dir ${dir}`}>{dir === "long" ? "多" : "空"}</span>
}

export function SevPill({ sev }: { sev: AlertSeverity }) {
  const cls = sev === "critical" ? "crit" : sev
  return <span className={`sev ${cls}`}>{SEV_LABEL[sev]}</span>
}
