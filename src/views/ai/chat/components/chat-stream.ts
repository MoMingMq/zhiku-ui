import type { ChatFrame, ChatStreamState, CitationVO, ToolCallRecordVO } from '@/api/ai/app/types';

/**
 * 对话流帧解析 reducer（纯函数：state + 帧 → 新 state；逻辑不揉进组件，可独立单测）
 */
export const chatStreamReducer = (state: ChatStreamState, frame: ChatFrame): ChatStreamState => {
  switch (frame.event) {
    case 'citation':
      return { ...state, citations: frame.data.citations ?? [] };
    case 'delta':
      return { ...state, content: state.content + (frame.data.content ?? '') };
    case 'tool_call':
      return {
        ...state,
        toolCalls: [
          ...state.toolCalls,
          { name: frame.data.toolName, args: frame.data.args, result: '', success: null } as ToolCallRecordVO
        ]
      };
    case 'tool_result': {
      const toolCalls = [...state.toolCalls];
      for (let i = toolCalls.length - 1; i >= 0; i--) {
        if (toolCalls[i].name === frame.data.toolName && toolCalls[i].success === null) {
          toolCalls[i] = { ...toolCalls[i], result: frame.data.result, success: frame.data.success };
          break;
        }
      }
      return { ...state, toolCalls };
    }
    case 'done':
      return {
        ...state,
        done: true,
        messageId: frame.data.messageId,
        conversationId: frame.data.conversationId,
        tokens: { prompt: frame.data.promptTokens, completion: frame.data.completionTokens }
      };
    case 'error':
      return { ...state, done: true, error: { message: frame.data.message, retryable: frame.data.retryable } };
    default:
      return state;
  }
};

/**
 * 历史消息渲染态转换（与流式形态同构，回放零差异）
 */
export const historyToStreamState = (messages: Array<{
  role: string;
  content: string | null;
  citations?: CitationVO[] | null;
  toolCalls?: ToolCallRecordVO[] | null;
}>): Array<{ user: string } | { assistant: ChatStreamState }> => {
  const list: Array<{ user: string } | { assistant: ChatStreamState }> = [];
  for (const message of messages) {
    if (message.role === '1') {
      list.push({ user: message.content ?? '' });
    } else if (message.role === '2') {
      list.push({
        assistant: {
          content: message.content ?? '',
          citations: message.citations ?? [],
          toolCalls: message.toolCalls ?? [],
          done: true
        }
      });
    }
  }
  return list;
};
