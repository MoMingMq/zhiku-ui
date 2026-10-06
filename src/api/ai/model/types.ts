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
  /** 上下文长度上限（token，空=未知） */
  contextWindow: number | undefined;
  /** 最大输出 token（空=不限制） */
  maxOutputTokens: number | undefined;
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
  contextWindow?: number;
  maxOutputTokens?: number;
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
  /** 实测向量维度（embedding 类型返回，后端已自动回填） */
  embedDim: number | undefined;
}

/** 渲染组件类型（应用侧按此渲染参数调整控件） */
export type ParamInputType = 'input' | 'number' | 'slider' | 'switch' | 'select';

/** 模型参数定义（对标 业界方案：Map 承载 + 渲染组件元数据） */
export interface ModelParamDef {
  /** 参数名（透传模型 API 的键） */
  name: string;
  /** 显示名（应用侧控件 label，缺省用 name） */
  label: string;
  /** 默认值（类型由 inputType 决定） */
  value: unknown;
  /** 渲染组件：input 文本 / number 数字 / slider 滑块 / switch 开关 / select 下拉 */
  inputType: ParamInputType;
  /** slider/number 范围 */
  min: number | undefined;
  max: number | undefined;
  step: number | undefined;
  /** select 选项 */
  options: string[] | undefined;
}
