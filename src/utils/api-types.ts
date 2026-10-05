/**
 * 与 `src/utils/request` 拦截器一致：resolve 的是R 风格 JSON `{ code, msg, data }`。
 * axios 1.13 + TS6 下避免从 `axios` 拉已移除的 AxiosPromise。
 */
export interface AjaxResult<T = unknown> {
  code?: number;
  msg?: string;
  data?: T;
}

export type AxiosPromise<T = unknown> = Promise<AjaxResult<T>>;
