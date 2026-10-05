export interface AiModelVO extends BaseEntity {
  modelId: number | string;
  modelName: string;
  modelType: string;
  provider: string;
  baseUrl: string;
  modelCode: string;
  /** 掩码（如 sk-***），永不回显明文 */
  apiKey: string;
  hasKey: boolean;
  embedDim: number | undefined;
  /** 默认参数 JSON（temperature/maxTokens/topP） */
  params: string;
  isDefault: string;
  status: string;
}

export interface AiModelForm {
  modelId: number | string | undefined;
  modelName: string;
  modelType: string;
  provider: string;
  baseUrl: string;
  modelCode: string;
  /** 编辑时留空表示不修改 */
  apiKey: string | undefined;
  embedDim: number | undefined;
  isDefault: string;
  status: string;
  /** 默认参数（独立字段，提交时组装为 params JSON） */
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface AiModelQuery extends PageQuery {
  modelName?: string;
  modelType?: string;
  status?: string;
}

export interface ModelTestResult {
  success: boolean;
  costMs: number;
  message: string;
}
