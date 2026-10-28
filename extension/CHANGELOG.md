# Changelog

## 0.2.1

- 修复完整看板与侧边栏加载失败：webview 把 Vue 的 reactive 代理直接 `postMessage` 给宿主，结构化克隆报 `[object Array] could not be cloned`。现在所有请求体发送前统一转成纯数据，克隆失败也会立即报错而不是卡满 20 秒超时。

## 0.2.0

- 新增 WorkBuddy 数据源：解析 `~/.workbuddy/projects/*/*.jsonl` 里的逐次模型调用，统计 Token、积分、思考 Token、模型与项目分布。
- 看板与侧边栏顶部新增 CodeBuddy / WorkBuddy 开关，选择写入 `codebuddyUsage.provider`；两个数据源各用一份缓存，切换互不覆盖。
- 新增配置项 `codebuddyUsage.workbuddyRoot`（默认 `~/.workbuddy`，可用环境变量 `WORKBUDDY_HOME` 覆盖）。
- WorkBuddy 的 jsonl 不含单次调用耗时，「平均耗时」显示为「未记录」。

## 0.1.0

首个版本。

- 侧边栏摘要：总 Token / 总积分 / 请求数 / 会话数、时间范围快捷切换、Token 与积分迷你趋势、Top 项目与 Top 模型、最近会话。
- 完整看板（编辑器区）：6 项 KPI、Token 与积分趋势、累计积分、项目树图、模型环形图、积分日历热力图、会话分页列表与逐请求明细。
- 本地数据增量解析：以会话为失效单元，按 `(mtime_ns, size)` 指纹判定新增/变更/删除，缓存为原子写入的 JSON。
- 跟随 VSCode 浅色/深色/高对比主题；数据目录为空或缺失时展示空态与设置引导。
- 支持手动指定数据目录与 workspaceStorage 目录，可配置定时刷新间隔。
