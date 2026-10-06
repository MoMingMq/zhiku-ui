export interface KbDatasetVO extends BaseEntity {
  datasetId: number | string;
  datasetName: string;
  description: string;
  embedModelId: number | string;
  embedDim: number | undefined;
  /** 分块参数 JSON（mode/maxChars/overlapRatio/semanticThreshold） */
  chunkParams: string;
  status: string;
  createTime: string;
}

export interface KbDatasetForm {
  datasetId: number | string | undefined;
  datasetName: string;
  description: string;
  embedModelId: number | string | undefined;
  status: string;
  /** 分块策略（表单独立字段，提交时组装 chunkParams JSON） */
  chunkMode: string;
  maxChars: number;
  overlapRatio: number;
  semanticThreshold: number;
}

export interface KbDatasetQuery extends PageQuery {
  datasetName?: string;
  status?: string;
}

export interface DocumentStat {
  documentCount: number;
  chunkCount: number;
  availableCount: number;
}

export interface KbDocumentVO extends BaseEntity {
  documentId: number | string;
  datasetId: number | string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: string;
  errorMsg: string;
  charCount: number | undefined;
  createTime: string;
}

export interface KbChunkVO extends BaseEntity {
  chunkId: number | string;
  documentId: number | string;
  datasetId: number | string;
  seq: number;
  title: string;
  content: string;
  headingPath: string;
  strategyTag: string;
  charCount: number;
  disabled: string;
}

export interface RetrievalHit {
  chunkId: number | string;
  documentId: number | string;
  documentName: string;
  content: string;
  headingPath: string;
  seq: number;
  score: number;
  datasetId: number | string;
}

export interface HitTestForm {
  query: string;
  topK: number;
  rerank: boolean;
}

/** 分段编辑/新增请求体 */
export interface ChunkEditBody {
  title: string;
  content: string;
}

/** 文档状态机（本地映射，后端无字典） */
export const documentStatusOptions = [
  { value: '0', label: '已上传', type: 'info' },
  { value: '1', label: '解析中', type: 'primary' },
  { value: '2', label: '分块中', type: 'primary' },
  { value: '3', label: '向量化中', type: 'warning' },
  { value: '4', label: '可用', type: 'success' },
  { value: 'D', label: '失败', type: 'danger' }
] as const;

export const documentStatusMap: Record<string, { label: string; type: string }> = Object.fromEntries(
  documentStatusOptions.map(o => [o.value, { label: o.label, type: o.type }])
);

/** 文档状态是否处理中（轮询判定用） */
export const isProcessingStatus = (status: string) => ['0', '1', '2', '3'].includes(status);
