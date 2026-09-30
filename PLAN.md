# CodeBuddy Token 消耗看板 — 软件规划

## Context（为什么做这个）

CodeBuddy（VSCode 扩展 `tencent-cloud.coding-copilot` v4.12.38765564）把真实的会话与 token 数据写在
`%LOCALAPPDATA%\CodeBuddyExtension\`，但**没有任何官方界面能看消耗**：插件里只显示当次上下文长度，历史用量、积分（credit）、按项目/模型的分布全部不可见。

已实测确认本地数据是完整且可解析的（详见「数据契约」）：**548 次请求、97 个会话、14 个工作区、9.19 亿 input token、4027.63 credit、缓存命中 97%**，时间跨度 2026-08-07 → 2026-09-30。

目标：做一个本地 Python(FastAPI) + Vue 3 看板，把这些数据可视化，支持按日期/项目/模型筛选，并能一键增量刷新以跟踪后续消耗。

`D:/coding/codebuddy_token` 当前为空目录、非 git 仓库，属全新项目。

---

## 数据契约（已实测验证，直接照此实现）

### 路径结构
```
%LOCALAPPDATA%/CodeBuddyExtension/Data/<accountUUID>/VSCode/<accountUUID>/
├── history/<workspaceHash>/index.json                 # 工作区级：{"conversations":[...],"current":""}  共 14 个
└── history/<workspaceHash>/<conversationId>/          # 会话级  共 97 个
    ├── index.json                                     # ← token 数据主来源
    └── messages/<messageId>.json                      # ← 模型名 / statsSnapshot 来源
```
- 无工作区窗口的变体在 `Data/default/VSCode/Lw==/history/...`，扫描必须用 `Data/*/VSCode/*/history/*/*/index.json` 双根通配，**不要硬编码 accountUUID**。
- 同级还有 `check-point/ file-tree/ plan-task/`，**绝对不能进入**（`file-tree/` 有 2093 个 >255 字符路径，会触发 Windows MAX_PATH 错误）。因此不做递归 walk，只按两级 glob + 定点读 `messages/<id>.json`。
- VSCode 侧 `globalStorage/Tencent-Cloud.coding-copilot/genie-history/*/conversations/*` 全是空目录（已废弃），忽略。

### `history/<hash>/<convId>/index.json`
```jsonc
{ "messages": [ {"id","type":"text","role":"user|assistant|tool","isComplete":bool} ],
  "requests":  [ {"id","type":"craft","state":"complete|running","startedAt":<ms epoch>,
                  "messages":[<messageId>...], "usage":{...}} ] }
```
- `usage` 键集在全部 544 条中**完全一致**：`inputTokens, outputTokens, totalTokens, cacheTokens, cachedWriteTokens, cachedMissTokens, lastTokens, credit`。
- 4 条 `state="running"` 的请求**没有 `usage` 也没有 `startedAt`** → 跳过。6 个会话 `requests` 为空数组 → 正常入库但不贡献统计。
- 恒等式 544/544 成立：`totalTokens == inputTokens + outputTokens`、`inputTokens == cacheTokens + cachedMissTokens`；`cachedWriteTokens` 恒为 0。
- **`usage.inputTokens` 是各 step 累计上下文之和**（每步真的重发全量历史），所以它就是真实计费量，不是重复计数。`lastTokens` = 末步上下文峰值。
- `credit` 是 CodeBuddy 计费点数（float）。42 条为 0，因为用了免费预览模型 `hy3`/`hy4-preview`（其中 19 条 token > 10 万）——**0 是真实值，不是缺失**，不要过滤掉。
- `index.messages[]` **不是严格时间序**（34/97 个会话有 91 处逆序，tool 结果后置）→ 一律按 `createdAt` 排序。

### `messages/<messageId>.json`（12692 个文件，最大 1.18 MB，21 个 >500 KB）
```jsonc
{ "role", "message":<str>, "id", "extra":<JSON 字符串>, "createdAt":<ISO-8601 UTC>, "references"?:仅 548 条 user }
```
- `extra` **永远是 JSON 字符串**，需二次 `json.loads`。全部 12690 条都含 `requestId, modelId, modelName, isHelperMessage`。
- `statsSnapshot` 只出现在 **542 条**「请求末尾的 assistant 消息」上：`{inputTokens, outputTokens, cachedInputTokens, cacheWriteTokens, cacheMissTokens, thinkingTokens, elapsedMs, lastOutputTokens, credit}`（1 条缺 `elapsedMs`）。
- **模型名只存在于 message，不在 index.json**。join 键 `extra.requestId == requests[].id`，成功率 12690/12690 = 100%；且 0/548 个请求跨多个 modelId → 任取一条消息即得该请求的模型。
- 会话标题：最早的一条 `role=="user"` 消息 → `message` 本身是 JSON 字符串 `{role, content:[...]}` → 正则抽 `<user_query>(.*?)</user_query>`；失败则退 `extra.inputPhrase[type=="normal"]`；再失败存 NULL（前端显示 conversationId 前 8 位）。
- 文件全为严格 UTF-8（300 抽样 0 失败）。

### workspaceHash → 项目路径：**已破解，确定性公式**
```
hash = md5(utf8( path.replace('/','\\') 后盘符小写、去掉前导反斜杠 )）
无工作区窗口 = md5("\\") = 28d397e87306b8631f3ed80d858d35f0
```
实测 6/6 已知样本命中；权威映射源 = `%APPDATA%/Code/User/workspaceStorage/*/workspace.json` 的 `folder` URI（file:/// 前缀 + URL 解码）→ 套上述公式，**覆盖磁盘上 13 个 hash 中的 12 个**，唯一未覆盖的正是无工作区那个（用公式直接算出）。

| hash | 项目路径 |
|---|---|
| 145290e6… | c:/Users/freeze/Desktop/xuqiu/re-1 |
| 28d397e8… | /（无工作区窗口，另见 Data/default/VSCode/Lw==） |
| 30afc478… | c:/Users/freeze/Desktop/xuqiu/re-web-2/re-web-2 |
| 44ef7dc0… | c:/Users/freeze/Desktop/xuqiu/打包/re-web-打包 |
| 56701f7c… | c:/Users/freeze/Desktop/xuqiu/re-backend |
| 5b5befdd… | d:/REV2/re-backend |
| 5f7adcd8… | d:/办公/github收集/github_matlab_simulink_collector |
| 6d858522… | d:/xuqiu/re-web |
| 7f4fad2e… | c:/Users/freeze/Desktop/xuqiu/AI汇报 |
| 95df0e74… | c:/Users/freeze/Desktop/xuqiu/re-web |
| b3c35bc6… | d:/jishang/integration-service |
| d3eacff9… | c:/Users/freeze/Desktop/xuqiu/需求组件项目开发AI使用情况 |
| f7c2e14e… | d:/REV2/re-web |

⚠️ **重名冲突**：两个 `re-web`（Desktop / D:）、两个 `re-backend`（Desktop / REV2）。display_name 必须带父目录消歧（如「re-web (Desktop)」「re-web (D:)」），且所有图表/表格用 hash 做 key、display_name 只做 label。

### 写入时序（VSCode 运行中会原地重写文件）
- 实测出现过瞬态 `.index_bak.json`、`orphan-fix-*.json`，以及单次遍历中 2011 次 `getmtime` 失败（列目录与 stat 之间文件被删）。
- ⇒ 解析必须 retry + 容错跳过，**本轮失败不等于致命**；只接受文件名匹配 `^[0-9a-f]{32}$` 或 `index.json` 的文件；忽略非 `complete` 请求。
- NTFS mtime 精度 100ns，原地重写必然改 mtime ⇒ **增量判定用 `(mtime_ns, size)` 指纹即可，不需要内容 hash**（省一遍全量读）。

### 本机环境（已核实）
- Python：`C:/Users/freeze/miniconda3/envs/py312/python` = **3.12.13**，几乎裸环境（仅 pip/setuptools/wheel/packaging）。fastapi/uvicorn/pydantic/pandas/orjson **全缺**。conda base 是 3.14.6，避免使用。
- **`uv` 0.12.4 已装** → 用 uv 管理后端。poetry、`py` launcher 均无。
- Node **v24.19.0** / npm 11.17.0 / **pnpm 11.20.0**（全局）。无 yarn/bun，无全局 vite → 脚手架需联网 `pnpm create vue`。npm registry 是官方源、**未配国内镜像、无代理**（备用方案见 §7）。
- 8 逻辑核 / 32 GB RAM / D: 剩 1.8 TB / 端口 8000、5173 均空闲。

---

## 1. 目录结构

后端用 **uv + pyproject.toml**（uv 已装，`uv sync` 一条命令带锁文件复现环境；requirements.txt 无锁且要手动建 venv）。

```
D:/coding/codebuddy_token/
├─ run.py                        # 唯一入口：检查 dist、按需提示构建、起 uvicorn :8000
├─ start.bat                     # Windows 双击 = python run.py
├─ .gitignore                    # data/*.db、frontend/dist、node_modules、.venv
├─ data/codebuddy_cache.db       # SQLite 缓存，可随时删库重建
├─ backend/
│  ├─ pyproject.toml
│  └─ app/
│     ├─ main.py                 # FastAPI 实例、CORS、/api 挂载、SPA StaticFiles + history fallback
│     ├─ config.py               # 数据根路径 / DB 路径 / workspaceStorage 路径（常量 + env 覆盖）
│     ├─ db.py                   # sqlite3 连接（row_factory、WAL、foreign_keys=ON）、schema 初始化
│     ├─ schema.sql              # §2 全部 DDL
│     ├─ ingest/
│     │  ├─ scanner.py           # 两级 glob 出待解析清单 + 增量指纹判定
│     │  ├─ parser.py            # index/messages 解析、容错、title 抽取、extra 二次 loads
│     │  ├─ workspace_resolver.py# workspaceStorage → md5 → path；内置 14 行 seed 兜底
│     │  └─ store.py             # 单事务写 conversation/request/message_stat/scan_file
│     ├─ api/{routes.py, models.py, queries.py}
│     └─ refresh.py              # POST /api/refresh 编排（threading.Lock 防并发重入）
│  └─ scripts/verify.py          # §8 对账脚本
└─ frontend/                     # pnpm create vue@latest（--typescript --router --pinia --eslint）
   └─ src/
      ├─ main.ts / App.vue       # app + pinia + router + ElementPlus(zh-cn locale)
      ├─ api/{client.ts,types.ts}# axios 实例（baseURL /api）+ 与后端 models.py 一一对应的 interface
      ├─ stores/{filters,dashboard,conversations}.ts
      ├─ router/index.ts         # createWebHistory，2 条路由
      ├─ views/{DashboardView,ConversationsView}.vue
      └─ components/
         ├─ AppHeader.vue        # 标题 + 上次同步时间 + 「刷新数据」按钮
         ├─ FilterBar.vue        # 日期范围 + 项目多选 + 模型多选
         ├─ KpiCards.vue
         ├─ charts/{TokenTrendChart,CreditCumulativeChart,ProjectTreemap,ModelDonut,DailyHeatmap}.vue
         ├─ charts/base.ts       # vue-echarts 按需注册 echarts 模块（tree-shake）
         └─ {ConversationTable,ConversationDrawer}.vue
```

脚手架生成后**删掉**：`components/__tests__/`、`HelloWorld.vue`、`TheWelcome.vue`、`WelcomeItem.vue`、`icons/`、`assets/base.css`、`assets/main.css`（重写为约 20 行全局样式）、`assets/logo.svg`；清空 `router/index.ts` 示例路由。

---

## 2. SQLite Schema（`backend/app/schema.sql`）

时间统一存 **INTEGER 毫秒 epoch**（`startedAt` 本就是 ms；`createdAt` ISO 在 ingest 时转换——单一类型才能直接 BETWEEN / GROUP BY）。

```sql
CREATE TABLE workspace(
  workspace_hash TEXT PRIMARY KEY, path TEXT NOT NULL,
  display_name   TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'seed'  -- 'storage' | 'seed'
);
CREATE TABLE conversation(
  conversation_id TEXT PRIMARY KEY,                       -- 32-hex，全局唯一
  workspace_hash  TEXT NOT NULL REFERENCES workspace(workspace_hash),
  title TEXT, started_at_ms INTEGER, ended_at_ms INTEGER,
  request_count INTEGER NOT NULL DEFAULT 0, message_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE request(
  request_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversation(conversation_id) ON DELETE CASCADE,
  state TEXT NOT NULL, started_at_ms INTEGER NOT NULL,
  model_id TEXT, model_name TEXT,
  input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, total_tokens INTEGER NOT NULL,
  cache_tokens INTEGER NOT NULL, cached_write_tokens INTEGER NOT NULL,
  cached_miss_tokens INTEGER NOT NULL, last_tokens INTEGER NOT NULL, credit REAL NOT NULL
);
CREATE TABLE message_stat(                                -- 仅 542 条 end-of-request assistant
  request_id TEXT PRIMARY KEY REFERENCES request(request_id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  stat_input_tokens INTEGER, stat_output_tokens INTEGER, stat_cached_input_tokens INTEGER,
  thinking_tokens INTEGER, elapsed_ms INTEGER, last_output_tokens INTEGER,
  agent_message_count INTEGER, credit REAL
);
CREATE TABLE scan_file(                                   -- 增量刷新账本
  path TEXT PRIMARY KEY, kind TEXT NOT NULL,              -- 'index' | 'message'
  conversation_id TEXT, mtime_ns INTEGER NOT NULL, size INTEGER NOT NULL,
  parsed_at_ms INTEGER, status TEXT NOT NULL DEFAULT 'ok' -- ok | error（本轮跳过）
);
CREATE TABLE sync_meta(key TEXT PRIMARY KEY, value TEXT);  -- last_full_scan / last_refresh / schema_version

CREATE INDEX idx_req_started  ON request(started_at_ms);
CREATE INDEX idx_req_conv     ON request(conversation_id);
CREATE INDEX idx_req_model    ON request(model_id);
CREATE INDEX idx_conv_ws      ON conversation(workspace_hash);
CREATE INDEX idx_conv_started ON conversation(started_at_ms);
```

**增量算法**（以 conversation 为失效单元）：对每个 `index.json` 及其最小读取集内的 message 文件取 `(mtime_ns, size)`，三分处理：
1. 路径不在 `scan_file` → 新会话，全解析入库；
2. 指纹变化 → `DELETE FROM conversation WHERE conversation_id=?`（CASCADE 清 request/message_stat）后重解析重插；
3. `scan_file` 有记录但磁盘已无 → 会话被删，同样级联删除。

`stat` 抛 `FileNotFoundError` 或解析抛 `JSONDecodeError` → 该文件 `status='error'`，本轮跳过、下轮重试。单事务提交 + WAL，保证不出现半更新状态。

---

## 3. 解析策略：最小读取集

**不读全部 12692 个 message 文件**，每个会话只读：
- (a) `index.messages` 中 `role=="user"` 的消息文件 —— 全库仅 **548 个**，取 `createdAt` 最小者抽标题；
- (b) 每个 complete request 的 `requests[].messages` 中**最后一个 assistant 消息文件** —— 即 **542 个** `statsSnapshot` 载体，顺带用 `extra.modelId/modelName` 解决模型归属。

合计约 **1090 / 12692 文件（8.6%）、约 50 MB / 240 MB**。`role` 直接来自 index.json，无需开文件判类型。

**容错**：每文件 `open + json.loads` 包 retry（2 次、50ms backoff），捕 `JSONDecodeError / FileNotFoundError / OSError` → skip；`state != "complete"` 或无 `usage` 的 request 跳过。

**并行**：message 解析用 `ProcessPoolExecutor(6)`（stdlib json 是 CPU-bound，GIL 下线程池无益；worker 收路径列表、返回小 dict，IPC 开销可忽略）。冷启动预估 **3–6 s**（索引 111 文件 <1s + 1090 消息文件约 50MB）；无变更的增量刷新仅 stat 约 1200 个文件，**<1 s**。

---

## 4. API 设计

全部 snake_case、Pydantic v2。共享过滤参数在 `queries.py` 里统一拼 WHERE（多条件 AND）：
`start_date: date|None`、`end_date: date|None`（作用于 `request.started_at_ms`，闭区间，本地时区换算）、`workspace: list[str]|None`（hash，可重复）、`model: list[str]|None`（model_id）。

| 端点 | 响应 |
|---|---|
| `GET /api/overview` | `total_input_tokens, total_output_tokens, total_tokens, total_credit, request_count, conversation_count, workspace_count, cache_hit_ratio, thinking_tokens, avg_elapsed_ms, date_min, date_max` |
| `GET /api/timeseries?granularity=day\|week` | `items:[{bucket, input_tokens, output_tokens, credit, requests}]`，bucket 用 `strftime('%Y-%m-%d'/'%Y-W%W', started_at_ms/1000,'unixepoch')` |
| `GET /api/projects` | `items:[{workspace_hash, display_name, path, input_tokens, output_tokens, credit, requests, conversations}]` |
| `GET /api/models` | `items:[{model_id, model_name, input_tokens, output_tokens, credit, requests, cache_hit_ratio}]` |
| `GET /api/conversations?page=1&size=20&q=&sort=ended_at_ms&order=desc` | `total, items:[{conversation_id, title, display_name, path, started_at_ms, ended_at_ms, request_count, total_tokens, credit, models:[str]}]`（`q` 对 title LIKE） |
| `GET /api/conversations/{cid}` | 头部字段 + `requests:[{request_id, started_at_ms, model_id, model_name, input_tokens, output_tokens, cache_tokens, cached_miss_tokens, last_tokens, credit, thinking_tokens, elapsed_ms}]` |
| `POST /api/refresh` | `{added, updated, deleted, errors, duration_ms}` |
| `GET /api/meta` | `{last_refresh_ms, db_path, data_root, workspace_count}` |

CORS：`allow_origins=["http://localhost:5173","http://127.0.0.1:5173"]`，methods/headers 全开。

---

## 5. 前端设计

图表用 **vue-echarts**（自动 dispose/resize + `option` 响应式，5 张图手写生命周期易漏）；HTTP 用 **axios**（params 数组序列化成重复 key，正好匹配后端 `list[str]` 过滤器；拦截器统一 `ElMessage` 报错）。

路由：`/` → DashboardView，`/conversations` → ConversationsView。三个 Pinia store（filters / dashboard / conversations），`filters` 变更 watch 触发 dashboard 全量 refetch。

**看板首屏（above the fold）**
1. 顶栏：`CodeBuddy 用量看板` | 上次同步 xx:xx | 「刷新数据」按钮
2. FilterBar：日期范围（默认全量）、项目多选、模型多选
3. 6 张 KPI 卡：总 Token / 总积分 / 请求数 / 会话数 / 缓存命中率 / 思考 Token
4. 第一行图表：**TokenTrendChart**（堆叠柱：每日 input vs output，右轴折线：当日积分）+ **CreditCumulativeChart**（累计积分折线）
5. 第二行：**ProjectTreemap**（面积=token，hover 显示积分与消歧名）+ **ModelDonut**（按积分环形，中心显示总额）+ **DailyHeatmap**（echarts calendar heatmap，每日积分；数据只跨 2 个月，calendar 正好放得下）

**会话页**：`el-table`（标题 / 项目 / 时间 / 请求数 / Token / 积分 / 模型 tag）+ `el-pagination`（后端分页）+ 点击行开 `el-drawer`（会话头信息 + 请求明细表，含缓存命中率 `cache_tokens/input_tokens`、耗时、思考 token）。时间用 dayjs 转本地时区。

Element Plus 用 `zh-cn` locale，所有文案中文（「刷新数据」「暂无数据」「加载中…」等）。

---

## 6. 构建与运行

**后端依赖最小集**：`fastapi>=0.115,<1`、`uvicorn[standard]>=0.32`、`pydantic>=2.9`。
**不装** orjson（最小读取集下 stdlib json 冷启动已 <6s）、pandas（聚合全在 SQL）、watchdog/aiofiles/sqlmodel（手动刷新按钮 + sqlite3 足够）。

```bash
# bootstrap
cd backend  && uv venv && uv pip install -e .
cd ../frontend && pnpm create vue@latest . -- --typescript --router --pinia --eslint
pnpm add echarts vue-echarts axios element-plus dayjs

# dev（两个终端）
backend>   uv run uvicorn app.main:app --port 8000 --reload
frontend>  pnpm dev          # vite :5173，vite.config.ts 配 server.proxy {'/api':'http://localhost:8000'}

# prod
frontend>  pnpm build        # → frontend/dist
>          python run.py     # uvicorn :8000，app 内 mount dist
```

**SPA fallback**：`/api` 路由注册后 `app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="spa")`，再加 `@app.get("/{p:path}")`（仅当 dist 中无该文件且 p 不以 `api` 开头）返回 `FileResponse(dist/index.html)`。
`run.py`：dist 缺失时打印「请先 pnpm build」但仍启动 API。`app.main` 启动时若 `sync_meta` 无 `last_full_scan` 自动跑一次全量 ingest。

---

## 7. 风险与对策（Top 5）

1. **项目重名**（两个 re-web、两个 re-backend）→ resolver 生成 display_name 时检测冲突，冲突则附父目录；图表/表格一律用 hash 做 key。
2. **扫描中文件被 VSCode 原地重写** → retry + skip（§3），error 文件下轮重试；写入单事务，DB 不会暴露半更新。
3. **`Data/default/VSCode/Lw==` 无工作区变体** → scanner 用 `Data/*/VSCode/*/history/*/*/index.json` 双根通配；hash `28d397e8…` 显示「未打开工作区」（seed 表含此行）。
4. **42 条 credit=0 的免费模型请求** → 0 是真实值：ModelDonut 按 token 排序（避免 0 面积扇区消失），overview 不做 `credit>0` 过滤。
5. **Windows 长路径 / 误入 file-tree** → 不递归 walk，只两级 glob + 定点读；文件名 32-hex 校验挡住 `orphan-fix-*` 瞬态文件。

补充：空 `requests` 的 6 个会话正常入库（request_count=0）；无 title 的会话列表显示 conversationId 前 8 位；npm 官方源若慢，备用 `pnpm config set registry https://registry.npmmirror.com`（仅备注，不预设执行）。

---

## 8. 实施顺序（‖ = 可并行）

1. 脚手架：目录、`pyproject.toml`、`uv sync`、`pnpm create vue` + 裁剪 + 装依赖 ‖(1a 后端 / 1b 前端)
2. `schema.sql` + `db.py` + `config.py`；`workspace_resolver.py`（对 workspaceStorage 验证 md5 公式 + seed 兜底）
3. `scanner.py` + `parser.py` + `store.py` + `refresh.py`（依赖 2）
4. **验证点**：跑全量 ingest，`sqlite3` 查 `SELECT SUM(input_tokens),SUM(output_tokens),SUM(credit),COUNT(*) FROM request` == `913734087 / 5119598 / 4027.63±0.01 / 544`
5. `queries.py` + `models.py` + `routes.py` + CORS（依赖 3，‖ 与 6）
6. 前端骨架：router / stores / client.ts / types.ts / FilterBar / AppHeader（‖ 与 5，先用 mock 数据）
7. KPI + 5 张图表组件（依赖 5、6）
8. 会话列表 + drawer（依赖 5、6，‖ 与 7）
9. `main.py` StaticFiles + fallback、`run.py`、`start.bat`、`.gitignore`、`git init`
10. `scripts/verify.py` + 浏览器走查（§9）

---

## 9. 验证方式

**`backend/scripts/verify.py`**（退出码非 0 即失败）
1. 内置 ground-truth 常量断言 DB 聚合：input `913,734,087`、output `5,119,598`、credit `4027.63±0.01`、requests `544`、conversations `97`、workspaces `14`（含 seed 表 14 行）、`cache_tokens/input_tokens ≈ 0.970`、`message_stat` 行数 `542`、模型分布 9 行逐一比对（deepseek-v4-flash 248 / deepseek-v4.1-flash 207 / glm-5.3-flash 27 / hy3 20 / hy4-preview 17 / deepseek-v4-pro 13 / glm-5.3 6 / auto 5 / glm-5.2 1）。
2. **独立重走一遍 JSON**（不复用 app 代码）交叉核对 per-workspace token 小计。
3. 恒等式抽查：全表 `total=input+output`、`input=cache+miss` 违例数必须为 0。
4. 增量幂等：连跑两次 refresh，第二次 `added=updated=deleted=0` 且聚合值不变。

**API**：7 个端点各 `curl` 一次，肉眼核对 overview 与常量一致；加 `?start_date=2026-09-01` 后各 totals 严格变小。

**浏览器**（`http://localhost:8000`）
- `/` 首屏 6 张 KPI 有数；TokenTrend 日期轴覆盖 08-07 → 09-30；Treemap 14 块且 hover 显示消歧名（`re-web (D:)` vs `re-web (Desktop)`）；Donut 含 hy3（积分 0 但 token > 0）。
- 点「刷新数据」出现 added/updated toast，顶栏同步时间更新。
- `/conversations` 翻到第 2 页、`q` 搜索命中 title、开 drawer 见请求明细（含耗时与思考 token）。
- 直接访问 `http://localhost:8000/conversations`（history fallback）不 404。

---

## 关键文件

- `backend/app/ingest/parser.py` — 数据正确性核心：title / statsSnapshot / model 抽取与容错
- `backend/app/ingest/scanner.py` — 增量判定、双根 glob、危险目录规避
- `backend/app/schema.sql` — 全部 DDL 与索引
- `backend/app/api/queries.py` — 过滤器组合与聚合 SQL，所有端点的数据来源
- `frontend/src/views/DashboardView.vue` — 首屏布局与图表编排
