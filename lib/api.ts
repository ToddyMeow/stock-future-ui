/**
 * API client — 占位壳，P2b 阶段实现。
 * 后端：/Users/mm/Trading/stock-future/live/ 提供的 FastAPI REST。
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// Keep reference so linter doesn't complain about unused.
void API_BASE

export async function fetchInstructions(
  date: string,
  session: "day" | "night"
) {
  void date
  void session
  throw new Error("not implemented until P2b")
}

export async function postFills(fills: unknown[]) {
  void fills
  throw new Error("not implemented until P2b")
}

export async function fetchPositions() {
  throw new Error("not implemented until P2b")
}

export async function fetchDailyPnl(from: string, to: string) {
  void from
  void to
  throw new Error("not implemented until P2b")
}

export async function fetchReport(date: string) {
  void date
  throw new Error("not implemented until P2b")
}
