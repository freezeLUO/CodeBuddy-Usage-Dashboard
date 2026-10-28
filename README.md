# CodeBuddy / WorkBuddy 用量看板 · VSCode 扩展

在 VSCode 侧边栏查看本机 CodeBuddy 与 WorkBuddy 的 Token 与积分消耗：**每天烧了多少 Token、花了多少积分、哪个项目在烧、用的哪个模型、缓存命中多少。**

看板与侧边栏顶部各有一个数据源开关，在 CodeBuddy / WorkBuddy 之间一键切换，选择会持久化到 VSCode 设置。数据全部来自本机磁盘（`%LOCALAPPDATA%\CodeBuddyExtension\Data`、`~/.workbuddy`），不联网、不上传、不需要 Python 环境。

![在 VSCode 中的实际效果](extension/media/screenshot-vscode.png)

## 安装

从 [Releases](https://github.com/freezeLUO/CodeBuddy-Usage-Dashboard/releases) 下载 `codebuddy-usage-0.2.1.vsix`：

```bash
code --install-extension codebuddy-usage-0.2.1.vsix
```

也可以在扩展面板右上角 `…` → 「从 VSIX 安装」，重载窗口后点击活动栏的「CodeBuddy 用量」图标。

> 要求 VSCode 1.85 及以上。仅 Windows 数据路径经过实测，macOS / Linux 默认路径为惯例推断，可用设置项覆盖。

## 功能

**侧边栏（Activity Bar）**

- 总 Token / 总积分 / 请求数 / 会话数，附缓存命中率、平均上下文等口径说明
- 今天 / 7 天 / 30 天 / 全部 快捷切换，选择会被记住
- Token 面积线 + 积分虚线的迷你趋势，悬停查看当日数值
- 项目消耗 Top 5（占比条）、模型用量 Top 5、最近会话（点击直接在编辑器中定位）
- 手动刷新、上次同步时间、数据目录设置入口；状态栏常驻显示今日积分
- 数据源开关：CodeBuddy / WorkBuddy 一键切换，两套数据各自缓存互不干扰

**完整看板（编辑器区标签页）**

- 6 项 KPI：总 Token、总积分、请求数、会话数、缓存命中率、思考 Token
- Token 与积分趋势（堆叠柱 + 双轴折线）、累计积分曲线、项目消耗树图、模型占比环形图、每日积分热力
- 筛选：日期区间、项目多选、模型多选、按天 / 按周粒度，任意组合即时重算
- 会话明细：标题搜索、分页、模型标签；抽屉中查看逐请求的模型、缓存命中率、峰值上下文、思考 Token、耗时、积分

![完整看板](extension/media/screenshot-dashboard.png)

## 使用说明

| 配置 | 默认 | 说明 |
|---|---|---|
| `codebuddyUsage.provider` | `codebuddy` | 统计哪个产品：`codebuddy` / `workbuddy`；界面的开关会写回这里 |
| `codebuddyUsage.dataRoot` | 平台默认 | CodeBuddy 数据根目录，Windows 默认 `%LOCALAPPDATA%\CodeBuddyExtension\Data` |
| `codebuddyUsage.workbuddyRoot` | `~/.workbuddy` | WorkBuddy 数据根目录，可用 `WORKBUDDY_HOME` 覆盖 |
| `codebuddyUsage.workspaceStorageRoot` | 平台默认 | VSCode `workspaceStorage`，用于项目路径反查；缺失时项目名退化为哈希前缀 |
| `codebuddyUsage.autoRefreshMinutes` | `5` | 定时增量刷新间隔，`0` 关闭 |
| `codebuddyUsage.staleMinutes` | `2` | 视图重新可见时，数据超过该分钟数才刷新 |
| `codebuddyUsage.showStatusBar` | `true` | 状态栏显示今日积分 |

首次打开会解析本地数据（本机 169 次请求约 300 ms），之后只处理指纹变化的会话；磁盘上删除的会话会同步移除。侧边栏重新可见或打开看板时按 `staleMinutes` 触发增量刷新，另有定时刷新兜底。

## 数据来源与口径

CodeBuddy 把数据写在 `%LOCALAPPDATA%\CodeBuddyExtension\`（**不在** VSCode 的 `globalStorage` 里）：

| 路径 | 内容 |
|---|---|
| `Data/<账号>/VSCode/<账号>/history/<workspaceHash>/<会话ID>/index.json` | 会话与请求元数据，`requests[].usage` 是每请求的权威用量 |
| `Data/.../messages/<消息ID>.json` | 单条消息，模型名与 `statsSnapshot`（思考 Token、耗时）在这里 |
| `%APPDATA%\Code\User\workspaceStorage\*\workspace.json` | 工作区 hash → 项目路径反查 |

关键口径：

- `usage.inputTokens` 是**各 step 累计上下文之和**（每步都会重发完整历史），因此它就是真实计费量，不是重复计数。
- `credit` 是 CodeBuddy 计费积分。免费预览模型（`hy3`、`hy4-preview`）的 `credit` 为 **0 是真实值**，不是缺失。
- 模型名只存在于消息文件里，通过 `extra.requestId == requests[].id` 关联（实测 100% 命中）。
- `workspaceHash` 可由工作区路径反推：`md5(路径.replace('/', '\\') 且盘符小写、去前导反斜杠)`；无工作区窗口为 `md5("\\")`。

WorkBuddy 的结构完全不同，走独立采集器：

| 路径 | 内容 |
|---|---|
| `~/.workbuddy/projects/<工作区>/<会话ID>.jsonl` | 会话逐条事件，带 `providerData.rawUsage` 的行即一次模型调用 |
| `~/.workbuddy/workbuddy.db` | WorkBuddy 自己的会话库（本工具不读，避免与 jsonl 口径混用） |

- token 取 `rawUsage.prompt_tokens / completion_tokens / prompt_cache_hit_tokens`，积分取 `rawUsage.credit` 并按调用发生时间归日。
- 思考 Token 取 `rawUsage.completion_thinking_tokens`；标题优先 `aiTitle`，缺失时回退首条用户提问。
- 项目名取行内 `cwd`；`requestModelName` 为 `Auto` 时改用实际模型 id。
- jsonl 没有单次耗时字段，因此 WorkBuddy 的「平均耗时」显示为「未记录」。

### 解析策略

不读全部消息文件。每个会话只读：最早一条 user 消息（抽标题）+ 每个已完成请求内**最后一个 assistant 消息**（取模型与快照），通常只占全部消息文件的 10% 以内，冷启动不到 1 秒。

为规避 VSCode 运行中原地重写文件、以及 `file-tree/` 里的超长路径（Windows MAX_PATH），扫描只按 `Data → 账号 → VSCode → 账号 → history → hash → 会话` 逐级 readdir + 定点读取，并对每个文件做重试与容错跳过。

## 项目结构

```
CodeBuddy-Usage-Dashboard/
├─ extension/                     # VSCode 扩展（本仓库主线）
│  ├─ src/core/                   # 纯 TS 数据层：扫描、解析、缓存、聚合
│  ├─ src/host/                   # VSCode 适配：视图、面板、RPC、刷新调度
│  ├─ webview/                    # Vue 3 + Vite：侧边栏与完整看板两个入口
│  ├─ media/                      # 图标与截图
│  └─ README.md                   # 扩展详细说明（安装、开发、验证）
├─ backend/                       # Web 版后端（Python + FastAPI + SQLite，旧版）
├─ frontend/                      # Web 版前端（Vue 3 + Element Plus + ECharts，旧版）
├─ run.py / start.bat             # Web 版启动入口
└─ PLAN.md                        # 设计与数据契约
```

## 开发

```bash
cd extension
pnpm install
pnpm run build      # 宿主 esbuild + 两个 webview 产物
pnpm run typecheck  # tsc + vue-tsc
pnpm test           # vitest：合成 fixture + 本机真实数据自检
pnpm run package    # 生成 codebuddy-usage-0.2.1.vsix
```

用 VSCode 打开 `extension/` 按 `F5` 启动扩展开发宿主；纯前端调试可跑 `node_modules/.bin/vite --config webview/vite.config.ts --port 5299`，打开 `webview/preview/dashboard.html`（加 `?theme=light` 看浅色）。

更多细节见 [extension/README.md](extension/README.md)。

## Web 版（旧版，仍可用）

仓库保留了最初的 Python + Vue 实现，功能与扩展一致，浏览器访问 `http://127.0.0.1:9000`。扩展与它共用同一套数据口径，便于互相对照。

```bash
# 1. 后端环境（Python 3.12）
cd backend
python -m venv .venv
uv pip install --python .venv/Scripts/python.exe -e .

# 2. 前端依赖与构建
cd ../frontend
pnpm install
pnpm build

# 3. 启动（项目根目录）
python run.py            # → http://127.0.0.1:9000
```

Windows 下也可以直接双击 `start.bat`（会检查前端产物、必要时构建）。首次启动全量解析本地数据并写入 `data/codebuddy_cache.db`，之后每次启动自动增量刷新。开发模式：后端 `uvicorn app.main:app --reload --port 9000`，前端 `pnpm dev`（`:5173`，已代理 `/api`）。

<details>
<summary>Web 版接口与环境变量</summary>

共享筛选参数：`start_date`、`end_date`（本地时区，闭区间）、`workspace`（可重复）、`model`（可重复）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/overview` | KPI 汇总：Token、积分、请求/会话/项目数、缓存命中率、思考 Token、平均耗时 |
| GET | `/api/timeseries?granularity=day\|week` | 时间序列（输入/输出/积分/请求数） |
| GET | `/api/projects` | 按项目汇总 |
| GET | `/api/models` | 按模型汇总（含缓存命中率） |
| GET | `/api/conversations?page=&size=&q=&sort=&order=` | 会话列表（分页、标题搜索、排序） |
| GET | `/api/conversations/{id}` | 会话详情：逐请求明细 |
| POST | `/api/refresh` | 触发增量刷新，返回 `added/updated/deleted/errors/duration_ms` |
| POST | `/api/provider` | 切换数据源（`{"provider": "workbuddy"}`），返回切换结果与本次刷新统计 |
| GET | `/api/meta` | 上次同步时间、库路径、数据源（`provider`）、项目/会话总数 |

接口文档：<http://127.0.0.1:9000/docs>

| 环境变量 | 默认值 | 用途 |
|---|---|---|
| `CODEBUDDY_DATA_ROOT` | `%LOCALAPPDATA%\CodeBuddyExtension\Data` | 数据根目录 |
| `CODEBUDDY_WORKSPACE_STORAGE` | `%APPDATA%\Code\User\workspaceStorage` | 工作区映射来源 |
| `CODEBUDDY_DB` | `./data/codebuddy_cache.db` | 缓存库路径 |
| `CODEBUDDY_DIST` | `./frontend/dist` | 前端产物路径 |
| `WORKBUDDY_HOME` | `~/.workbuddy` | WorkBuddy 数据根目录 |
| `WORKBUDDY_DB` | `./data/workbuddy_cache.db` | WorkBuddy 缓存库路径 |
| `CODEBUDDY_SETTINGS` | `./data/settings.json` | 数据源开关的持久化位置 |

数据库共 6 张表：`workspace`、`conversation`、`request`、`message_stat`、`scan_file`（增量指纹账本）、`sync_meta`。增量以会话为失效单元：`(mtime_ns, size)` 指纹变化 → 级联删除并重新解析；磁盘上消失 → 一并删除，整个写入在单个事务内完成。

</details>

## 已知限制

- 只解析 `history/` 与最小读取集消息文件，不做 `Logs/` 的单请求 step 级钻取。
- WorkBuddy 的 jsonl 不记录单次调用耗时，该数据源下的「平均耗时」显示为「未记录」。
- 新版 CodeBuddy 对部分模型不再上报缓存明细（`cacheTokens = cachedMissTokens = 0`），这类请求会让「缓存命中率」偏低；该字段原样展示，不做推断。
- 少数以引用或命令开头的会话会显示成路径片段，空会话没有标题（显示会话 ID 前 8 位）。
- 项目重名时追加父目录名消歧（如 `re-web (D:)`），所有图表仍以哈希为 key。
- 项目路径反查依赖 VSCode 的 `workspaceStorage`；目录缺失时项目名退化为哈希前缀。
- macOS / Linux 默认数据路径未在真机验证，可通过 `codebuddyUsage.dataRoot` 覆盖。
- 扩展包内 `publisher` 仍为占位值 `your-publisher-id`，从市场安装前需替换。
- 完整看板首次打开需加载约 800 KB 的 ECharts（本地内联，无网络请求）。

## License

MIT
