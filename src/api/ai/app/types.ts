export interface AiAppQuery extends PageQuery {
  appName?: string;
  status?: string;
}

export interface AiAppVO extends BaseEntity {
  appId: number | string;
  appName: string;
  description: string;
  icon: string | null;
  /** simple/workflow */
  appType: string;
  /** knowledge_qa 等 */
  chatType: string;
  /** 类型专属配置 JSON 字符串 */
  config: string | null;
  modelId: number | string;
  modelName: string | null;
  modelParams: string | null;
  systemPrompt: string | null;
  prologue: string | null;
  suggestedQuestions: string | null;
  shareEnabled: string;
  shareCode: string | null;
  ipWhitelist: string | null;
  status: string;
  kbIds: Array<number | string>;
  toolIds: Array<number | string>;
}

export interface AiAppForm {
  appId: number | string | undefined;
  appName: string;
  description?: string;
  icon?: string;
  appType: string;
  chatType?: string;
  config?: string;
  modelId: number | string;
  modelParams?: string;
  systemPrompt?: string;
  prologue?: string;
  suggestedQuestions?: string;
  status?: string;
}

export interface AppConfigField {
  name: string;
  label: string;
  /** kb-multi / tool-multi / input / number / switch / select */
  component: string;
  defaultValue: unknown;
  min?: number;
  max?: number;
  options?: string[];
  required: boolean;
  description?: string;
}

export interface ChatTypeVO {
  type: string;
  typeName: string;
  configFields: AppConfigField[];
  defaultConfig: string;
}

export interface CitationVO {
  chunkId: number | string;
  documentId: number | string;
  documentName: string;
  seq: number;
  headingPath: string | null;
  score: number;
  snippet: string;
}

export interface ToolCallRecordVO {
  name: string;
  args: string;
  result: string;
  success: boolean | null;
}

export interface AiConversationVO {
  conversationId: number | string;
  appId: number | string;
  title: string;
  source: string;
  createTime: string;
}

export interface AiMessageVO {
  messageId: number | string;
  conversationId: number | string;
  seq: number;
  /** 1用户 2助手 */
  role: string;
  content: string;
  citations: CitationVO[] | null;
  toolCalls: ToolCallRecordVO[] | null;
  promptTokens: number | null;
  completionTokens: number | null;
  createTime: string;
}

export interface AiAppStatsVO {
  totalQuestions: number;
  totalConversations: number;
  totalTokens: number;
  todayQuestions: number;
  last7d: Array<{ date: string; questions: number; tokens: number }>;
}

/** SSE 帧联合类型（六类语义帧） */
export type ChatFrame =
  | { event: 'citation'; data: { citations: CitationVO[] } }
  | { event: 'delta'; data: { content: string } }
  | { event: 'tool_call'; data: { toolName: string; args: string } }
  | { event: 'tool_result'; data: { toolName: string; success: boolean; result: string } }
  | { event: 'done'; data: { messageId: number; conversationId: number; promptTokens: number; completionTokens: number } }
  | { event: 'error'; data: { message: string; retryable: boolean } };

/** 流式状态（reducer 驱动） */
export interface ChatStreamState {
  content: string;
  citations: CitationVO[];
  toolCalls: ToolCallRecordVO[];
  done: boolean;
  messageId?: number;
  conversationId?: number;
  tokens?: { prompt: number; completion: number };
  error?: { message: string; retryable: boolean };
}

export const initialChatStreamState = (): ChatStreamState => ({
  content: '',
  citations: [],
  toolCalls: [],
  done: false
});
