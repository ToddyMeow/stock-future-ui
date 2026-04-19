# stock-future-ui

中国期货半自动实盘交易系统前端。与后端 `stock-future/live/`（FastAPI REST）配套：前端负责指令回填、持仓展示、历史查询、报告查看；后端负责策略信号生成、持仓状态维护、报告产出。

## 技术栈

- Next.js 16（App Router，Turbopack）
- React 19
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui（base-nova preset，Slate 默认色板）
- recharts + date-fns（图表与日期工具）
- react-hook-form + zod（表单）

## 启动

```bash
npm install                      # 首次
cp .env.local.example .env.local # 配置后端地址
npm run dev                      # 开发，默认 http://localhost:3000
npm run build                    # 产品构建
npm run start                    # 本地预览 build 产物
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | 后端 FastAPI 根地址 |

## 目录结构

```
stock-future-ui/
├── app/
│   ├── layout.tsx              # 根布局（含侧边栏）
│   ├── globals.css             # Tailwind + shadcn css vars
│   ├── page.tsx                # / 仪表盘
│   ├── instructions/page.tsx   # /instructions 今日指令回填
│   ├── positions/page.tsx      # /positions 当前持仓
│   ├── history/page.tsx        # /history 历史查询
│   ├── analytics/page.tsx      # /analytics 品种/策略分析
│   └── reports/[date]/page.tsx # /reports/[date] 每日报告（动态）
├── components/
│   ├── sidebar.tsx             # 左侧导航（使用 usePathname 高亮）
│   └── ui/                     # shadcn 组件（table / form / dialog / ...）
├── lib/
│   ├── api.ts                  # 后端 API 客户端（P2b 阶段实现）
│   └── utils.ts                # shadcn cn() 等工具
├── components.json             # shadcn 配置
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs          # Tailwind v4 via @tailwindcss/postcss
└── package.json
```

## 路由清单

| 路径 | 页面 | 用途 |
| --- | --- | --- |
| `/` | 仪表盘 | 累计 PnL / Sharpe / MaxDD / 胜率 / 今日 PnL / 待回填数 / 最近告警 |
| `/instructions` | 今日指令 | 今日待回填指令列表 + 回填表单（量 / 价 / 否决 / skipped） |
| `/positions` | 当前持仓 | 实时持仓表（品种 / 方向 / 开仓价 / 当前价 / 浮盈 / 止损止盈） |
| `/history` | 历史查询 | 按日期 / 品种查询历史指令和成交 |
| `/analytics` | 分析 | 品种与策略维度 breakdown + 资金曲线对比 |
| `/reports/[date]` | 每日报告 | 指定日期详细报告；`/reports/today` 是入口别名 |

## 开发阶段

| 阶段 | 目标 |
| --- | --- |
| **P1 骨架** | 6 页空占位、侧边栏、shadcn 组件库、API 客户端壳（当前） |
| **P2a** | 接入 `/api/dashboard` 等只读接口，recharts 画资金曲线 |
| **P2b** | 打通 `/api/instructions` 回填、`/api/positions`、`/api/reports/{date}` |
| **P3** | 告警、WebSocket 推送、鉴权 |

## 与后端约定

- 后端路径：`/Users/mm/Trading/stock-future/live/`
- 后端端口：默认 `8000`
- 日期格式：`YYYY-MM-DD`（ISO），夜盘用 `session=night`
- 所有时间戳统一用 `Asia/Shanghai` 时区

## 推送到远端

本地已初始化 remote `origin → https://github.com/ToddyMeow/stock-future-ui.git`，但**未执行 push**（受限于 gh 未登录）。

首次推送（用户在本机手跑）：

```bash
cd /Users/mm/Trading/stock-future-ui

# 登录 GitHub（选 HTTPS + web 浏览器 / token 方式都行）
gh auth login

# 推 main
git push -u origin main
```

后续常规 push 直接 `git push` 即可。

如果 remote 已指向别的 URL 需要改：
```bash
git remote set-url origin https://github.com/ToddyMeow/stock-future-ui.git
```
