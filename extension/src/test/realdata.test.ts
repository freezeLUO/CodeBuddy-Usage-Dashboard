/**
 * 本机真实数据自检：不依赖 Python 后端，只校验解析结果的恒等式与增量幂等。
 * 数据目录不存在时自动跳过，CI 上不会失败。
 */
import { describe, expect, it } from 'vitest'
import * as os from 'node:os'
import * as path from 'node:path'
import { rm } from 'node:fs/promises'
import { UsageStore } from '../core'
import { resolvePaths, isDirectory } from '../core/config'
import { Filters } from '../core/filters'

describe('本机真实数据', () => {
  it('解析出的用量满足恒等式且增量刷新幂等', async () => {
    const { dataRoot, workspaceStorageRoot } = resolvePaths()
    if (!(await isDirectory(dataRoot))) {
      console.warn(`[跳过] 未找到数据目录：${dataRoot}`)
      return
    }

    const cacheFile = path.join(os.tmpdir(), `codebuddy-usage-selfcheck-${process.pid}.json`)
    const store = new UsageStore({ dataRoot, workspaceStorageRoot, cacheFile })
    await store.load()
    const first = await store.refresh()
    const overview = store.overview(new Filters())

    console.log(
      `[真实数据] 扫描 ${first.scanned} / 新增 ${first.added} / 更新 ${first.updated} / 删除 ${first.deleted} / 错误 ${first.errors} / ${first.duration_ms}ms`,
    )
    console.log(
      `[真实数据] input=${overview.total_input_tokens} output=${overview.total_output_tokens} ` +
        `credit=${overview.total_credit} requests=${overview.request_count} conversations=${overview.conversation_count} ` +
        `workspaces=${overview.workspace_count} cacheHit=${overview.cache_hit_ratio}`,
    )

    // total = input + output 是硬约束；input = cache + miss 在旧数据上成立，
    // 新版 CodeBuddy 对部分模型不再上报缓存字段（cache=miss=0），因此只做统计不做断言。
    let cacheMismatch = 0
    for (const request of store.cache.requests) {
      expect(request.total_tokens).toBe(request.input_tokens + request.output_tokens)
      if (request.input_tokens !== request.cache_tokens + request.cached_miss_tokens) cacheMismatch += 1
    }
    if (cacheMismatch) {
      console.warn(`[真实数据] ${cacheMismatch} 条请求未上报缓存明细（cache=miss=0），缓存命中率会偏低`)
    }
    expect(overview.total_tokens).toBe(overview.total_input_tokens + overview.total_output_tokens)
    expect(store.cache.requests.length).toBe(overview.request_count)

    const second = await store.refresh()
    expect(second.added).toBe(0)
    expect(second.updated).toBe(0)
    expect(second.deleted).toBe(0)
    expect(second.errors).toBe(0)

    await rm(cacheFile, { force: true })
  }, 120_000)
})
