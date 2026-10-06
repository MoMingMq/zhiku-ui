export interface AiToolVO extends BaseEntity {
  toolId: number | string;
  toolName: string;
  description: string;
  icon: string | null;
  method: string;
  urlTemplate: string;
  /** JSON 数组字符串 [{key,value}] */
  headers: string | null;
  /** JSON 数组字符串 [{key,value}] */
  queryParams: string | null;
  bodyTemplate: string | null;
  /** JSON Schema 字符串（根 object，即 Function Calling parameters） */
  paramSchema: string | null;
  /** 0无 1Bearer 2自定义头 */
  authType: string;
  authKey: string | null;
  /** 掩码（***），永不回显明文 */
  authValue: string;
  authValueSet: boolean;
  /** 0否 1是（SSRF 内网白名单） */
  allowIntranet: string;
  timeoutSeconds: number;
  /** 0启用 1停用 */
  status: string;
}

export interface AiToolForm {
  toolId: number | string | undefined;
  toolName: string;
  description: string;
  icon: string | undefined;
  method: string;
  urlTemplate: string;
  headers: string | undefined;
  queryParams: string | undefined;
  bodyTemplate: string | undefined;
  paramSchema: string | undefined;
  authType: string | undefined;
  authKey: string | undefined;
  /** 编辑时留空表示不修改 */
  authValue: string | undefined;
  allowIntranet: string | undefined;
  timeoutSeconds: number | undefined;
  status: string | undefined;
}

export interface AiToolQuery extends PageQuery {
  toolName?: string;
  status?: string;
}

export interface ToolExecResultVO {
  success: boolean;
  httpStatus: number | null;
  body: string | null;
  errorMsg: string | null;
  durationMs: number;
}

export interface AiToolCallLogVO {
  logId: number | string;
  toolId: number | string;
  toolName: string;
  appId: number | string | null;
  messageId: number | string | null;
  /** 0试运行 1对话调用 */
  scene: string;
  requestSnapshot: string | null;
  responseSnapshot: string | null;
  httpStatus: number | null;
  success: string;
  errorMsg: string | null;
  durationMs: number;
  createTime: string;
}
