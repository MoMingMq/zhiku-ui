import type { AiModelForm, AiModelQuery, AiModelVO, ModelTestResult } from './types';
import type { AxiosPromise, PageResult } from '@/utils/api-types';
import request from '@/utils/request';

// 查询模型配置列表
export function listAiModel(query: AiModelQuery): AxiosPromise<PageResult<AiModelVO>> {
  return request({
    url: '/ai/model/list',
    method: 'get',
    params: query
  });
}

// 查询模型配置详细
export function getAiModel(modelId: number | string): AxiosPromise<AiModelVO> {
  return request({
    url: '/ai/model/' + modelId,
    method: 'get'
  });
}

// 新增模型配置
export function addAiModel(data: AiModelForm) {
  return request({
    url: '/ai/model',
    method: 'post',
    data: data
  });
}

// 修改模型配置
export function updateAiModel(data: AiModelForm) {
  return request({
    url: '/ai/model',
    method: 'put',
    data: data
  });
}

// 删除模型配置
export function delAiModel(modelId: string | number | (string | number)[]) {
  return request({
    url: '/ai/model/' + modelId,
    method: 'delete'
  });
}

// 连通性测试（按模型类型发最小请求）
export function testAiModel(modelId: number | string): AxiosPromise<ModelTestResult> {
  return request({
    url: '/ai/model/test/' + modelId,
    method: 'post'
  });
}

// 模型参数设置（Map 承载：参数名→默认值，应用侧按值类型动态生成控件）
export function updateModelParams(modelId: number | string, params: Record<string, unknown>) {
  return request({
    url: '/ai/model/' + modelId + '/params',
    method: 'put',
    data: params
  });
}

export default { listAiModel, getAiModel, addAiModel, updateAiModel, delAiModel, testAiModel, updateModelParams };
