import type { AiModelForm, AiModelQuery, AiModelVO, ModelParamDef, ModelTestResult } from './types';
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

// 模型参数定义列表（应用侧按 inputType 渲染组件）
export function getModelParams(modelId: number | string): AxiosPromise<ModelParamDef[]> {
  return request({
    url: '/ai/model/' + modelId + '/params',
    method: 'get'
  });
}

// 模型参数设置（参数定义含渲染组件元数据）
export function updateModelParams(modelId: number | string, params: ModelParamDef[]) {
  return request({
    url: '/ai/model/' + modelId + '/params',
    method: 'put',
    data: params
  });
}

export default { listAiModel, getAiModel, addAiModel, updateAiModel, delAiModel, testAiModel, getModelParams, updateModelParams };
