import type { AiToolCallLogVO, AiToolForm, AiToolQuery, AiToolVO, ToolExecResultVO } from './types';
import type { AxiosPromise, PageResult } from '@/utils/api-types';
import request from '@/utils/request';

// 查询工具列表（分页）
export const listAiTool = (query: AiToolQuery): AxiosPromise<PageResult<AiToolVO>> => {
  return request({ url: '/ai/tool/list', method: 'get', params: query });
};

// 查询工具详情
export const getAiTool = (toolId: number | string): AxiosPromise<AiToolVO> => {
  return request({ url: '/ai/tool/' + toolId, method: 'get' });
};

// 新增工具
export const addAiTool = (data: AiToolForm) => {
  return request({ url: '/ai/tool', method: 'post', data });
};

// 修改工具（鉴权凭据留空=不修改）
export const updateAiTool = (data: AiToolForm) => {
  return request({ url: '/ai/tool', method: 'put', data });
};

// 删除工具
export const delAiTool = (toolId: string | number | (string | number)[]) => {
  return request({ url: '/ai/tool/' + toolId, method: 'delete' });
};

// 试运行（body=示例参数 map）
export const testAiTool = (toolId: number | string, params: Record<string, unknown>): AxiosPromise<ToolExecResultVO> => {
  return request({ url: '/ai/tool/test/' + toolId, method: 'post', data: params });
};

// 应用挂载清单（M4 应用配置页）
export const listAppTools = (appId: number | string): AxiosPromise<AiToolVO[]> => {
  return request({ url: '/ai/tool/app/' + appId, method: 'get' });
};

// 绑定工具到应用
export const bindAppTools = (appId: number | string, toolIds: Array<number | string>) => {
  return request({ url: `/ai/tool/app/${appId}/bind`, method: 'post', data: { toolIds } });
};

// 解绑工具
export const unbindAppTools = (appId: number | string, toolIds: Array<number | string>) => {
  return request({ url: `/ai/tool/app/${appId}/unbind`, method: 'delete', data: { toolIds } });
};

// 调用记录（审计分页，toolId 可选）
export const listToolLog = (query: { toolId?: number | string } & PageQuery): AxiosPromise<PageResult<AiToolCallLogVO>> => {
  return request({ url: '/ai/tool/log', method: 'get', params: query });
};

export default {
  listAiTool,
  getAiTool,
  addAiTool,
  updateAiTool,
  delAiTool,
  testAiTool,
  listAppTools,
  bindAppTools,
  unbindAppTools,
  listToolLog
};
