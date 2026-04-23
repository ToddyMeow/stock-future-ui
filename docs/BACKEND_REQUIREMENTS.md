# 前端需求文档 — 给后端工程师

> 本文作者：前端 ·
> 版本：v1.0 · 2026-04-24
> 关联设计：Claude Design 导出「方向 A · Velvet Anchor · 期货交易控制台 + Alpha Lab 实验平台」
> 相关前端实现：[stock-future-ui](../) · 已上线的真实接口定义见 [lib/api.ts](../lib/api.ts) / [lib/types.ts](../lib/types.ts)

---

## 0. 摘要

前端「方向 A」落地后，对后端 API **不新增**主要端点（除 Alpha Lab 几处小增量），但有若干**字段补齐 / 语义澄清 / 错误语义**需要后端协作。下面按优先级分组。

**P0（必须做，否则整页不可用）**：Sharpe / 最大回撤 / fills 表归因聚合。
**P1（明显体验缺陷）**：engine-status 补 `alerts_24h_count`、Alpha Lab sweep 规划接口、phase summary verdict 结构化。
**P2（nice to have）**：历史查询多维筛选、WebSocket 推送、审计日志查询。

---

## 1. 主控制台 · Dashboard（`/`）

### 1.1 仪表盘 KPI 展示的字段对齐

前端已接入的 5 个端点：
- `GET /api/daily_pnl?from=…&to=…` — 近 90 日权益曲线
- `GET /api/instructions?date=today` — 待回填数
- `GET /api/alerts/recent?n=10` — 最近告警
- `GET /api/rolls` — 换约候选（Q6）

| KPI 卡片 | 字段来源 | 现状 | 需求 |
| --- | --- | --- | --- |
| 今日盈亏 | `daily_pnl[-1].equity - daily_pnl[-2].equity` | ✅ 可用 | — |
| 累计盈亏 | `daily_pnl[-1].equity - daily_pnl[0].equity` | ✅ 可用 | — |
| **最大回撤** | `min(daily_pnl[*].drawdown_from_peak)` | ⚠️ 当前序列可能无此字段 | **P0**：保证每条 `DailyPnl` 都有非空 `drawdown_from_peak`（首日补 0），否则前端 fallback 成 0 误导用户 |
| 待回填 | `instructions.filter(status in {pending, partially_filled}).length` | ✅ 可用 | — |
| 待换约 | `rolls.length` | ✅ 可用 | — |

### 1.2 权益曲线 tooltip

- 前端 hover 游标需要每日 `equity`，已满足。
- 未来若要显示「当日交易笔数」tooltip，需要 `DailyPnl` 增加 `trade_count` 字段（**P2**）。

---

## 2. 主控制台 · 今日指令（`/instructions`）

### 2.1 接口变更

前端使用：
- `GET /api/instructions?date=YYYY-MM-DD&session=day|night`
- `POST /api/fills` — 回填成交
- `POST /api/instructions/{id}/veto` — 否决
- `POST /api/instructions/{id}/skip` — 跳过

### 2.2 需求

| 项 | 现状 | 需求 | 优先级 |
| --- | --- | --- | --- |
| `filled_qty_total` / `avg_filled_price` 聚合字段 | ✅ 后端从 `v_instructions_with_fills` view 聚合 | 继续保持。**禁止删字段**，前端 KPI 和行内剩余手数依赖 | P0 |
| 滑点计算 | 前端本地算：`(filled_price − entry_price_ref) * filled_qty` | 后端 `Fill` 增加 `slippage` 字段（按合约乘数算，精确到合约级）更好 | P2 |
| `POST /api/fills` 错误语义 | 当前返回 4xx + `{"detail": "..."}` | 前端希望错误分类：`422` = 校验失败、`409` = 状态冲突（如指令已 vetoed）、`500` = 内部。前端据此选择 toast 样式 | P1 |
| `POST /api/instructions/{id}/veto` body | 当前 `{"reason": "..."}` | 保持；`reason` 必填，空字符串应返回 422 | P0（前端已假设该契约） |

### 2.3 触发源（TriggerSource）

前端 `RadioGroup` 让用户选择触发源。当前 4 个值：`user_manual / stop_loss / take_profit / roll_contract`。

- 若后端想新增触发源（如 `limit_lock` 限价锁），请在 [lib/types.ts:31](../lib/types.ts#L31) 的 `TriggerSource` union 同步更新；前端一次加上对应中文标签（`TRIGGER_SOURCE_LABELS`）。
- **约定**：后端新增前先在 PR 里 @ 前端。

---

## 3. 主控制台 · 当前持仓（`/positions`）

### 3.1 已对接字段

```ts
// lib/types.ts Position —— 带 enriched 派生字段
interface Position {
  symbol, contract_code, qty, avg_entry_price,
  stop_loss_price, group_name, opened_at, last_updated_at,
  // enriched（后端已实现）
  last_price?, last_settle_date?, contract_multiplier?,
  unrealized_pnl?, notional_mv?,
}
```

### 3.2 需求

| 项 | 现状 | 需求 | 优先级 |
| --- | --- | --- | --- |
| `unrealized_pnl` / `notional_mv` | ✅ 后端 `get_positions_enriched` 算 | 保证 **每条持仓都有值**（`bars` 缺数时返回 `avg_entry_price` 兜底，前端已做但不优雅） | P1 |
| `last_price` 的语义文档 | ✅ 后端注释「最近一日结算价」 | 文档化 `last_settle_date` 的时区（`Asia/Shanghai` 交易日，非 UTC） | P2 |
| `Position.group_name` 可能为空的情况 | 后端可能给空串 | 约定：**非空**，空值按 `"未分组"` 返回 | P0 |

### 3.3 换约确认（Q6）

`POST /api/rolls/confirm` 前端要求：
- 请求体：`{symbol, old_contract, new_contract, old_close_price, new_open_price, closed_at?, opened_at?, note?}`
- 响应体：必须包含 `closed_instruction_id` / `opened_instruction_id`（前端未展示但日志/debug 用）
- **事务保证**：单事务内完成 positions 迁移 + 2 条 `fully_filled` instructions + 2 条 `fills`（`trigger_source=roll_contract`）+ 1 条 info alerts。失败应全回滚（当前架构已满足，请加集成测试覆盖）。

---

## 4. 主控制台 · 引擎状态（`/engine-status`）

### 4.1 接口

`GET /api/engine-status` — 前端每 30s 轮询。

### 4.2 需求

| 项 | 现状 | 需求 | 优先级 |
| --- | --- | --- | --- |
| `alerts_24h_count: {info, warn, critical}` | ✅ 后端已实现 | — | — |
| `launchd_schedule` 排序 | ⚠️ 约定按 `next_fire` 升序（第 0 条即下次触发） | **强约定**：后端必须按 `next_fire` 升序返回。前端 `[0]` 取「下次触发」。不符则 UI 错乱 | P0 |
| `latest_state.created_at` 时区 | 后端 ISO 带 `+08:00` | 保持。前端 `new Date()` 直接解析 | — |
| `capital_snapshot.drawdown_from_peak` | 可能是 null | 约定：**无日结快照时整个 `capital_snapshot` = null**；不要单个字段 null，避免前端分支 | P1 |

### 4.3 新增：引擎进程健康

前端目前仅展示 `latest_state` 和 `db_health`，想在下次迭代加：

```jsonc
// GET /api/engine-status 扩展字段
{
  "engine_process": {
    "running": true,
    "pid": 48210,
    "started_at": "2026-04-23T04:30:01+08:00",
    "memory_mb": 128,
    "last_heartbeat": "2026-04-24T10:42:18+08:00"
  }
}
```

用途：顶部「引擎运行中」pill 真实反映进程状态，而非只看 `latest_state` 写入时间。**优先级 P1**，排期可与运维一起定。

---

## 5. 主控制台 · 分析（`/analytics`）

### 5.1 接口

`GET /api/analytics/breakdown` → `{by_symbol: [...], by_group: [...]}`

### 5.2 需求

| 项 | 现状 | 需求 | 优先级 |
| --- | --- | --- | --- |
| `fills` 表归因聚合 | ⚠️ 当前 MVP 返回空结构 | **P0**：fills 表有数据后，按品种 / 组做 PnL 聚合（SQL）；参考设计 mock 里的 `bySymbol`（见下） | P0 |
| `SymbolBreakdown.recent_pnl_series` | 约定 `[{idx, pnl}][]` 最近 10 笔 | 按 `fills` 的 `filled_at` 降序取 10 条，正向 idx 从 0 开始 | P0 |
| 多维筛选（日期范围 / 单品种钻取） | 未实现 | 加 query param：`?from=…&to=…&symbol=…&group=…`；无参数时返全窗口聚合 | P2 |

### 5.3 SymbolBreakdown SQL 示意（供后端参考）

```sql
-- by_symbol：按品种聚合已实现 PnL（fills 关联 instruction + positions 的开仓成本）
WITH trades AS (
  SELECT
    i.symbol, i.group_name, i.contract_code, i.direction,
    f.filled_qty, f.filled_price, f.filled_at,
    -- 平仓 fill 的盈亏（参考 strats/position.py 的单笔盈亏公式）
    CASE
      WHEN i.action IN ('close', 'reduce') THEN
        (f.filled_price - p.avg_entry_price) * f.filled_qty
          * p.contract_multiplier
          * CASE WHEN i.direction = 'long' THEN 1 ELSE -1 END
      ELSE 0
    END AS realized_pnl
  FROM fills f
  JOIN instructions i ON i.id = f.instruction_id
  LEFT JOIN positions p ON p.symbol = i.symbol AND p.contract_code = i.contract_code
)
SELECT
  symbol, group_name,
  COUNT(*) AS trade_count,
  SUM(realized_pnl) AS pnl_cumulative,
  AVG(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS win_rate
FROM trades
GROUP BY symbol, group_name;
```

---

## 6. Alpha Lab · 实验平台（新路由 `/alpha-lab/*`）

这块后端已有 `workspace-api/experiments/*` 系列（Next.js 本地 route，再转发本地 Python），设计一脉相承。以下是前端已消费的接口清单：

| 接口 | 前端调用 | 已实现 |
| --- | --- | --- |
| `GET /workspace-api/experiments` | `listExperimentRunsClient` | ✅ |
| `POST /workspace-api/experiments` | `launchExperimentClient` | ✅ |
| `GET /workspace-api/experiments/{runId}` | `fetchExperimentRunClient` | ✅ |
| `PATCH /workspace-api/experiments/{runId}` | `archiveExperimentRunClient` / `restoreExperimentRunClient` | ✅ |
| `DELETE /workspace-api/experiments/{runId}` | `deleteExperimentRunClient` | ✅ |
| `GET /workspace-api/experiments/{runId}/artifact?capital=…&phase=…&artifact=…` | `fetchExperimentArtifactClient` | ✅ |
| `GET /workspace-api/experiments/{runId}/phase-summary?capital=…&phase=…` | `fetchExperimentPhaseSummaryClient` | ✅ |
| `GET /workspace-api/experiments/strategies` | `fetchExperimentStrategyCatalogClient` | ✅ |

### 6.1 需求 · Launcher 页

| 项 | 现状 | 需求 | 优先级 |
| --- | --- | --- | --- |
| `ExperimentStrategyCatalog` 里 `parameters[].candidate_values` | 可能没填 | **P1**：对允许 sweep 的参数，在 catalog 里返回候选值数组，前端据此在启动台展示笛卡尔规划 `N runs` 预估。现在前端固定展示「1 run」是假数据 |
| `POST /workspace-api/experiments` sweep 生成 | 前端传 `sweep: null` 时后端只启 1 条 | 希望后端支持：前端传 `sweep: { dimensions: [{param_name, candidate_values}] }`，后端做笛卡尔展开并一次启动 N 条 runs | P1 |
| Fire 后跳转 `/alpha-lab/runs` | 前端已实现 `router.push` | — | — |
| 错误分类 | `500` 兜底 | `422` = 参数校验失败（如 entry 未勾选）；`503` = workers 不足无法调度 | P2 |

### 6.2 需求 · Runs 页（运行列表）

| 项 | 现状 | 需求 | 优先级 |
| --- | --- | --- | --- |
| `GET /workspace-api/experiments` 轮询频率 | 前端 5 秒 | 后端保证接口响应 < 500ms（当前扫 runs 目录 + 解析 manifest 可能慢）。若慢，加 server-side 缓存 60s + ETag | P1 |
| `ExperimentRunSummary.capital_progress[].progress_percent` | ⚠️ 可能为 null | Phase3 running 时务必非空，用于 sweep-bar 的预计剩余时间 | P0 |
| `sweep.member_label` | ✅ 已实现 | 格式建议：`"#{i}/{n}"`（前端沿用这个展示）。已满足 | — |
| **取消 running run** | 未实现 | 前端无 UI 取消，设计也去掉了「中断所有」。如果某天要加 per-run cancel：`PATCH /workspace-api/experiments/{runId}` body `{"action": "cancel"}` → 后端发 SIGTERM 到 pid | P2（设计明确不做批量，仅单条） |

### 6.3 需求 · Phase Tracker（`/alpha-lab/runs/[runId]`）

| 项 | 现状 | 需求 | 优先级 |
| --- | --- | --- | --- |
| `capital_progress[].latest_log` | 可能是多行 | 前端一次渲染最新 ~5 行尾部即可；后端可 truncate 到 2000 字节，避免超大 log 炸前端 | P1 |
| `capital_progress[].phases[].status` 枚举 | 当前 `pending / running / completed` | 约定：无 `interrupted` / `failed` 单独状态（失败通过 run 级别 `status=failed` 表达）。保持现状 | — |
| 轮询间隔 | 前端 4 秒 | 后端接口响应 < 300ms（只读 run manifest） | P0 |

### 6.4 需求 · Artifacts（`/alpha-lab/runs/[runId]/artifacts`）

| 项 | 现状 | 需求 | 优先级 |
| --- | --- | --- | --- |
| `ExperimentArtifactResponse.rows` schema | 每 phase 不同 | **P1**：前端用 best-effort 取字段（`sharpe / cagr / maxdd / winrate / stability`），后端请为每个 phase 文档化：`phase3` 必返 `{group_id, symbols, sharpe, cagr, max_drawdown, win_rate, stability}` 七字段（其他可选） |
| `ExperimentPhaseSummaryResponse.summary` | 结构自由 | **P1**：phase3 约定 `{verdict, picked_groups, exit_probabilities, next_phase}`；其他 phase 结构可自由，前端只渲染 phase3 | P1 |
| artifact 分页 | `limit` 参数（默认 100） | 前端暂时只展示 top 100 按 sharpe desc，不分页 | — |
| 空 artifact 返回 | 当前 404 | 建议：**空 artifact 返回 200 + `rows: []`**，前端才能区分「接口挂了」vs「该 phase 未产出」。现在 404 走 exception 路径很吵 | P0 |

---

## 7. 路由一览 · 对齐

| 前端路由 | 类型 | 主接口 | 备注 |
| --- | --- | --- | --- |
| `/` | 仪表盘 | daily_pnl + instructions + alerts + rolls | RSC |
| `/instructions` | 回填 | instructions + fills + veto + skip | client-heavy |
| `/positions` | 持仓 | positions + daily_pnl + rolls + roll_confirm | client-heavy |
| `/engine-status` | 引擎 | engine-status | 30s 轮询 |
| `/analytics` | 分析 | analytics/breakdown | RSC |
| `/alpha-lab` | Launcher | strategies + POST experiments | client |
| `/alpha-lab/runs` | 列表 | GET experiments | 5s 轮询 |
| `/alpha-lab/runs/[runId]` | Phase | GET experiments/{id} | 4s 轮询 |
| `/alpha-lab/runs/[runId]/artifacts` | 工件 | artifact + phase-summary | on-demand |

---

## 8. 通用约定

### 8.1 字段类型

- **金额 / 价格** → `number`（前端直接显示）。后端若用 `Decimal`，序列化成 `number` 优先；若不得已用 `string`，前端用 `toNum()` 兜底。
- **时间** → ISO-8601 with tz offset（`2026-04-24T10:42:00+08:00`）。前端 `new Date()` 解析。
- **日期** → `YYYY-MM-DD`。
- **枚举** → 小写下划线（`pending` / `fully_filled` / `partially_filled`）。

### 8.2 错误响应

- `4xx` → `{"detail": "human-readable"}`。前端 `toast.error` 直接展示。
- `5xx` → 前端展示通用「服务器错误，请联系后端」。
- **避免** 返回 200 但带 `{"error": "..."}` 软失败。

### 8.3 CORS

- 前端走 `NEXT_PUBLIC_API_URL=http://localhost:8000`；同机开发。
- 上线后若前后端不同域，后端需允许 `Access-Control-Allow-Origin` 精确匹配前端域名（不要 `*`，涉及 cookie 鉴权）。

### 8.4 鉴权

- **当前**：无鉴权（单机本地）。
- **下一步（P3）**：前端 `/login` 页已预留骨架；后端需提供：
  - `POST /api/auth/login` body `{password}` → set HttpOnly cookie
  - `POST /api/auth/logout` → clear cookie
  - `GET /api/auth/session` → 当前会话信息
  - 保护端点：未登录返回 `401`（前端拦截跳 `/login`）。

---

## 9. 不在本次需求里的

- WebSocket 推送（P3）
- 多用户权限（单人用）
- 历史审计日志可查询页（P3）
- iOS 推送（暂走 sonner toast 足够）

---

## 10. 沟通节奏

- 前端在任何字段变更前 **必须** 先 @ 后端；反之亦然。
- 双方共享的合同在 [lib/types.ts](../lib/types.ts)，以 **前端** 作为 SSoT（后端 Pydantic model 需对齐命名与 optional 策略）。
- 本文档的 `P0` 条目视作当前 sprint 的最小必要集；`P1+` 进下 sprint 排期。

— 前端
