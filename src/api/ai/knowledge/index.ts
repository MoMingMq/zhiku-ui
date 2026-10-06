import type {
  ChunkEditBody,
  ChunkPageQuery,
  DocumentStat,
  HitTestForm,
  KbChunkVO,
  KbDatasetForm,
  KbDatasetQuery,
  KbDatasetVO,
  KbDocumentVO,
  KbProblemChunkVO,
  KbProblemVO,
  RetrievalHit
} from './types';
import type { AxiosPromise, PageResult } from '@/utils/api-types';
import request from '@/utils/request';

// ==================== 知识库 ====================

// 查询知识库列表
export function listDataset(query: KbDatasetQuery): AxiosPromise<PageResult<KbDatasetVO>> {
  return request({
    url: '/ai/kb/dataset/list',
    method: 'get',
    params: query
  });
}

// 查询知识库详细
export function getDataset(datasetId: number | string): AxiosPromise<KbDatasetVO> {
  return request({
    url: '/ai/kb/dataset/' + datasetId,
    method: 'get'
  });
}

// 新增知识库
export function addDataset(data: KbDatasetForm) {
  return request({
    url: '/ai/kb/dataset',
    method: 'post',
    data: data
  });
}

// 修改知识库
export function updateDataset(data: KbDatasetForm) {
  return request({
    url: '/ai/kb/dataset',
    method: 'put',
    data: data
  });
}

// 删除知识库
export function delDataset(datasetId: string | number | (string | number)[]) {
  return request({
    url: '/ai/kb/dataset/' + datasetId,
    method: 'delete'
  });
}

// 知识库统计（文档数/分块数/可用数）
export function datasetStat(datasetId: number | string): AxiosPromise<DocumentStat> {
  return request({
    url: '/ai/kb/dataset/' + datasetId + '/stat',
    method: 'get'
  });
}

// 检索命中测试
export function hitTest(datasetId: number | string, data: HitTestForm): AxiosPromise<RetrievalHit[]> {
  return request({
    url: '/ai/kb/dataset/' + datasetId + '/hitTest',
    method: 'post',
    data: data
  });
}

// 向量对账（Milvus vs MySQL）
export function vectorCount(datasetId: number | string): AxiosPromise<{ milvusCount: number; mysqlChunkCount: number }> {
  return request({
    url: '/ai/kb/dataset/' + datasetId + '/vectorCount',
    method: 'get'
  });
}

// ==================== 文档 ====================

// 查询文档列表（左栏，按知识库过滤）
export function listDocument(
  datasetId: number | string,
  query: PageQuery
): AxiosPromise<PageResult<KbDocumentVO>> {
  return request({
    url: '/ai/kb/document/list',
    method: 'get',
    params: { datasetId, ...query }
  });
}

// 上传文档（multipart）
export function uploadDocument(datasetId: number | string, file: File) {
  const formData = new FormData();
  formData.append('datasetId', String(datasetId));
  formData.append('file', file);
  return request({
    url: '/ai/kb/document/upload',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

// 查询文档的分块列表（右栏）
export function documentChunks(documentId: number | string): AxiosPromise<KbChunkVO[]> {
  return request({
    url: '/ai/kb/document/' + documentId + '/chunks',
    method: 'get'
  });
}

// 重试失败文档
export function retryDocument(documentId: number | string) {
  return request({
    url: '/ai/kb/document/' + documentId + '/retry',
    method: 'post'
  });
}

// 重切文档（换分块策略后整文档重跑）
export function reingestDocument(documentId: number | string) {
  return request({
    url: '/ai/kb/document/' + documentId + '/reingest',
    method: 'post'
  });
}

// 删除文档
export function delDocument(documentId: number | string) {
  return request({
    url: '/ai/kb/document/' + documentId,
    method: 'delete'
  });
}

// ==================== 分段 ====================

// 切换分段禁用状态（禁用后不参与检索）
export function changeChunkDisabled(chunkId: number | string, disabled: boolean) {
  return request({
    url: '/ai/kb/document/chunk/' + chunkId + '/disabled',
    method: 'put',
    params: { disabled }
  });
}

// 编辑分段（标题/正文；正文变更自动重新向量化）
export function editChunk(chunkId: number | string, data: ChunkEditBody) {
  return request({
    url: '/ai/kb/document/chunk/' + chunkId,
    method: 'put',
    data: data
  });
}

// 新增分段（追加到文档末尾并向量化）
export function addChunk(documentId: number | string, data: ChunkEditBody) {
  return request({
    url: '/ai/kb/document/' + documentId + '/chunk',
    method: 'post',
    data: data
  });
}

// 删除分段（同步删除向量）
export function delChunk(chunkId: number | string) {
  return request({
    url: '/ai/kb/document/chunk/' + chunkId,
    method: 'delete'
  });
}

// 分段排序（拖拽后按新顺序重排 seq）
export function reorderChunks(documentId: number | string, chunkIds: (number | string)[]) {
  return request({
    url: '/ai/kb/document/' + documentId + '/chunks/order',
    method: 'put',
    data: chunkIds
  });
}

// ==================== 问题 ====================

// 查询问题列表
export function listProblem(datasetId: number | string, keyword?: string): AxiosPromise<KbProblemVO[]> {
  return request({
    url: '/ai/kb/problem/list',
    method: 'get',
    params: { datasetId, keyword }
  });
}

// 查询问题详情（含关联分段）
export function getProblem(problemId: number | string): AxiosPromise<KbProblemVO> {
  return request({
    url: '/ai/kb/problem/' + problemId,
    method: 'get'
  });
}

// 批量新增问题（content 一行一个问题）
export function addProblem(datasetId: number | string, content: string): AxiosPromise<number> {
  return request({
    url: '/ai/kb/problem',
    method: 'post',
    data: { datasetId, content }
  });
}

// 查询问题关联的分段（含文档名）
export function problemChunks(problemId: number | string): AxiosPromise<KbProblemChunkVO[]> {
  return request({
    url: '/ai/kb/problem/' + problemId + '/chunks',
    method: 'get'
  });
}

// 绑定分段（追加关联）
export function bindProblemChunks(problemId: number | string, chunkIds: (number | string)[]) {
  return request({
    url: '/ai/kb/problem/' + problemId + '/bind',
    method: 'put',
    data: { chunkIds }
  });
}

// 解绑分段
export function unbindProblemChunks(problemId: number | string, chunkIds: (number | string)[]) {
  return request({
    url: '/ai/kb/problem/' + problemId + '/unbind',
    method: 'put',
    data: { chunkIds }
  });
}

// 删除问题（同步删向量）
export function delProblem(problemIds: string | number | (string | number)[]) {
  return request({
    url: '/ai/kb/problem/' + problemIds,
    method: 'delete'
  });
}

// ==================== 分段分页 ====================

// 分页查询文档分段（绑定弹窗滚动分页）
export function pageDocumentChunks(
  documentId: number | string,
  query: ChunkPageQuery
): AxiosPromise<PageResult<KbChunkVO>> {
  return request({
    url: '/ai/kb/document/' + documentId + '/chunk/page',
    method: 'get',
    params: query
  });
}

export default {
  listDataset,
  getDataset,
  addDataset,
  updateDataset,
  delDataset,
  datasetStat,
  hitTest,
  vectorCount,
  listDocument,
  uploadDocument,
  documentChunks,
  retryDocument,
  reingestDocument,
  delDocument,
  changeChunkDisabled,
  editChunk,
  addChunk,
  delChunk,
  reorderChunks,
  listProblem,
  getProblem,
  addProblem,
  problemChunks,
  bindProblemChunks,
  unbindProblemChunks,
  delProblem,
  pageDocumentChunks
};
