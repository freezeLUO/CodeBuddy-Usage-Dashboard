/**
 * 传给 `acquireVsCodeApi().postMessage` 的数据会走结构化克隆，
 * 而 Vue 的 reactive 对象是 Proxy，克隆时会抛
 * `Failed to execute 'postMessage' on 'MessagePort': [object Array] could not be cloned`。
 * 请求体都很小，统一 JSON 往返一次转成纯数据最省事。
 */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
