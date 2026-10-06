import type {
  AiAppForm,
  AiAppQuery,
  AiAppStatsVO,
  AiAppVO,
  AiConversationVO,
  AiMessageVO,
  ChatFrame,
  ChatTypeVO
} from './types';
import type { AxiosPromise, PageResult } from '@/utils/api-types';
import request from '@/utils/request';
import { getToken } from '@/utils/auth';

// 查询应用列表
export const listAiApp = (query: AiAppQuery): AxiosPromise<PageResult<AiAppVO>> => {
  return request({ url: '/ai/app/list', method: 'get', params: query });
};

// 应用详情（含 kbIds/toolIds/modelName）
export const getAiApp = (appId: number | string): AxiosPromise<AiAppVO> => {
  return request({ url: '/ai/app/' + appId, method: 'get' });
};

// 对话类型清单（设置页动态配置）
export const listAppChatTypes = (): AxiosPromise<ChatTypeVO[]> => {
  return request({ url: '/ai/app/chat-types', method: 'get' });
};

// 新增应用
export const addAiApp = (data: AiAppForm) => {
  return request({ url: '/ai/app', method: 'post', data });
};

// 修改应用（设置页全量保存）
export const updateAiApp = (data: AiAppForm) => {
  return request({ url: '/ai/app', method: 'put', data });
};

// 删除应用
export const delAiApp = (appId: string | number | (string | number)[]) => {
  return request({ url: '/ai/app/' + appId, method: 'delete' });
};

// 公开访问开关（开=返回新 shareCode；关=null）
export const toggleAppShare = (appId: number | string, enabled: boolean): AxiosPromise<string | null> => {
  return request({ url: `/ai/app/${appId}/share/${enabled}`, method: 'put' });
};

// 更新 IP 白名单
export const updateAppIpWhitelist = (appId: number | string, ipWhitelist: string) => {
  return request({ url: `/ai/app/${appId}/ip-whitelist`, method: 'put', data: { ipWhitelist } });
};

// 监控统计
export const getAppStats = (appId: number | string): AxiosPromise<AiAppStatsVO> => {
  return request({ url: `/ai/app/${appId}/stats`, method: 'get' });
};

// 会话列表（当前用户，应用维度）
export const listConversations = (appId: number | string): AxiosPromise<AiConversationVO[]> => {
  return request({ url: `/ai/app/${appId}/conversation/list`, method: 'get' });
};

// 重命名会话
export const renameConversation = (conversationId: number | string, title: string) => {
  return request({ url: `/ai/app/conversation/${conversationId}/rename`, method: 'put', data: { title } });
};

// 删除会话
export const delConversation = (conversationId: number | string) => {
  return request({ url: '/ai/app/conversation/' + conversationId, method: 'delete' });
};

// 消息历史（含 citation/toolCalls 回放）
export const listMessages = (conversationId: number | string): AxiosPromise<AiMessageVO[]> => {
  return request({ url: `/ai/app/conversation/${conversationId}/messages`, method: 'get' });
};

// 分块上下文（citation 弹窗：相邻三块）
export const getChunkContext = (chunkId: number | string) => {
  return request({ url: `/ai/app/chunk/${chunkId}/context`, method: 'get' });
};

/** SSE 帧回调 */
export interface ChatSSECallbacks {
  onFrame: (frame: ChatFrame) => void;
  onError?: (err: unknown) => void;
}

/**
 * 对话 SSE 消费（fetch + ReadableStream；EventSource 不支持 POST 与自定义头）
 * @param url 完整接口地址（管理端 /ai/app/{id}/chat 或公开 /public/app/{code}/chat）
 * @param withAuth 是否携带鉴权头（公开端点 false）
 */
export const chatSSE = async (
  url: string,
  body: { conversationId?: number | string | null; message: string },
  callbacks: ChatSSECallbacks,
  signal?: AbortSignal,
  withAuth = true
): Promise<void> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    clientid: import.meta.env.VITE_APP_CLIENT_ID as string
  };
  if (withAuth) {
    headers.Authorization = `Bearer ${getToken()}`;
  }
  let resp: Response;
  try {
    resp = await fetch(import.meta.env.VITE_APP_BASE_API + url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    callbacks.onError?.(err);
    return;
  }
  if (!resp.ok || !resp.body) {
    callbacks.onError?.(new Error(`HTTP ${resp.status}`));
    return;
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const rawFrame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const frame = parseFrame(rawFrame);
      if (frame) {
        callbacks.onFrame(frame);
      }
    }
  }
};

/** 解析一帧（event: xxx \n data: {...}） */
export const parseFrame = (raw: string): ChatFrame | null => {
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data += line.slice(5).trim();
    }
  }
  if (!data) {
    return null;
  }
  try {
    return { event, data: JSON.parse(data) } as ChatFrame;
  } catch {
    return null;
  }
};

export default {
  listAiApp,
  getAiApp,
  listAppChatTypes,
  addAiApp,
  updateAiApp,
  delAiApp,
  toggleAppShare,
  updateAppIpWhitelist,
  getAppStats,
  listConversations,
  renameConversation,
  delConversation,
  listMessages,
  getChunkContext,
  chatSSE
};
