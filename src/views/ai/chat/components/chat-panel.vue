<template>
  <div class="chat-panel">
    <div ref="listRef" class="chat-list">
      <!-- 开场白与推荐问题（无历史时） -->
      <template v-if="messages.length === 0 && !streaming">
        <div v-if="appInfo.prologue" class="chat-prologue">
          <div class="prologue-text">{{ appInfo.prologue }}</div>
        </div>
        <div v-if="suggestedList.length" class="chat-suggestions">
          <el-button v-for="q in suggestedList" :key="q" size="small" round @click="sendMessage(q)">{{ q }}</el-button>
        </div>
      </template>

      <!-- 消息流 -->
      <template v-for="(msg, idx) in messages" :key="idx">
        <div v-if="'user' in msg" class="msg-user">
          <div class="msg-bubble user">{{ msg.user }}</div>
        </div>
        <div v-else class="msg-assistant">
          <div class="msg-bubble assistant">
            <tool-call-item v-for="(tc, i) in msg.assistant.toolCalls" :key="i" :record="tc" />
            <markdown-renderer v-if="msg.assistant.content" :markdown="msg.assistant.content" :is-dark="themeDark" />
            <span v-if="!msg.assistant.done && !msg.assistant.content" class="typing">正在思考…</span>
            <citation-list
              v-if="msg.assistant.done && msg.assistant.citations.length"
              :citations="msg.assistant.citations"
              @inspect="openChunkContext"
            />
          </div>
        </div>
      </template>

      <!-- 错误提示 -->
      <el-alert
        v-if="streamError"
        :title="streamError"
        type="error"
        :closable="false"
        show-icon
        class="chat-error"
      >
        <el-button v-if="retryable" size="small" type="primary" plain @click="sendMessage(lastQuestion)">重试</el-button>
      </el-alert>
    </div>

    <!-- 输入区 -->
    <div class="chat-input">
      <el-input
        v-model="input"
        type="textarea"
        :rows="2"
        :placeholder="streaming ? '生成中…' : '输入问题，Enter 发送 / Shift+Enter 换行'"
        :disabled="streaming"
        @keydown.enter.exact.prevent="handleEnter"
      />
      <el-button v-if="!streaming" type="primary" icon="Promotion" :disabled="!input.trim()" @click="handleEnter">发送</el-button>
      <el-button v-else type="danger" plain icon="VideoPause" @click="stopGenerate">停止生成</el-button>
    </div>

    <chunk-context-dialog ref="chunkDialogRef" />
  </div>
</template>

<script setup lang="ts">
import request from '@/utils/request';
import { chatSSE } from '@/api/ai/app';
import type { ChatStreamState } from '@/api/ai/app/types';
import { initialChatStreamState } from '@/api/ai/app/types';
import { useThemeDark } from '@/hooks/common/useTheme';
import { MarkdownRenderer } from 'x-markdown-vue';
import { chatStreamReducer, historyToStreamState } from './chat-stream';
import CitationList from './citation-list.vue';
import ChunkContextDialog from './chunk-context-dialog.vue';
import ToolCallItem from './tool-call-item.vue';

const props = defineProps<{
  /** 管理端传应用ID；公开模式传 shareCode */
  appId?: number | string;
  shareCode?: string;
  /** 会话ID（可空=新会话；公开模式由父层持 localStorage） */
  conversationId?: number | string | null;
  /** 应用公开信息（公开模式父层拉取后传入；管理端可传空由 reload 拉取） */
  prologue?: string;
  suggestedQuestions?: string[];
}>();

const emit = defineEmits<{ done: [conversationId: number | string] }>();

const themeDark = useThemeDark();
const listRef = ref<HTMLElement>();
const chunkDialogRef = ref<InstanceType<typeof ChunkContextDialog>>();
const input = ref('');
const streaming = ref(false);
const streamError = ref('');
const retryable = ref(false);
const lastQuestion = ref('');
const appInfo = reactive({ prologue: props.prologue ?? '', suggested: props.suggestedQuestions ?? [] });
const suggestedList = computed(() => appInfo.suggested);

/** 消息流：user 串 | assistant 流式状态 */
type DisplayMessage = { user: string } | { assistant: ChatStreamState };
const messages = ref<DisplayMessage[]>([]);
const currentStream = ref<ChatStreamState | null>(null);
const localConversationId = ref<number | string | null>(props.conversationId ?? null);
let abortController: AbortController | null = null;

const isPublic = computed(() => !!props.shareCode);

const chatUrl = () =>
  isPublic.value ? `/public/app/${props.shareCode}/chat` : `/ai/app/${props.appId}/chat`;

const openChunkContext = (chunkId: number | string) => chunkDialogRef.value?.open(chunkId);

const handleEnter = () => {
  const text = input.value.trim();
  if (!text || streaming.value) return;
  input.value = '';
  sendMessage(text);
};

const sendMessage = async (question: string) => {
  if (streaming.value) return;
  lastQuestion.value = question;
  streamError.value = '';
  retryable.value = false;
  messages.value.push({ user: question });
  currentStream.value = initialChatStreamState();
  messages.value.push({ assistant: currentStream.value });
  streaming.value = true;
  scrollToBottom();
  abortController = new AbortController();
  await chatSSE(
    chatUrl(),
    { conversationId: localConversationId.value, message: question },
    {
      onFrame: frame => {
        const stream = currentStream.value;
        if (!stream) return;
        Object.assign(stream, chatStreamReducer(stream, frame));
        if (frame.event === 'done') {
          const convId = frame.data.conversationId;
          if (convId) {
            localConversationId.value = convId;
            emit('done', convId);
          }
        }
        if (frame.event === 'error') {
          streamError.value = frame.data.message;
          retryable.value = frame.data.retryable;
        }
        scrollToBottom();
      },
      onError: () => {
        streamError.value = '连接中断，请检查网络后重试';
        retryable.value = true;
        finishStream();
      }
    },
    abortController.signal,
    !isPublic.value
  );
  finishStream();
};

const finishStream = () => {
  const stream = currentStream.value;
  if (stream && !stream.done) {
    stream.done = true;
  }
  streaming.value = false;
  abortController = null;
};

const stopGenerate = () => {
  abortController?.abort();
  finishStream();
};

const scrollToBottom = () => nextTick(() => {
  if (listRef.value) {
    listRef.value.scrollTop = listRef.value.scrollHeight;
  }
});

/** 载入历史（管理端与公开端点 URL 不同；回放形态与流式同构） */
const loadHistory = async (conversationId: number | string) => {
  const url = isPublic.value
    ? `/public/app/${props.shareCode}/conversation/${conversationId}/messages`
    : `/ai/app/conversation/${conversationId}/messages`;
  const res = await request<unknown, { code: number; data: Array<{ role: string; content: string | null; citations?: never[] | null; toolCalls?: never[] | null }> }>({
    url,
    method: 'get'
  });
  messages.value = historyToStreamState(res.data ?? []);
  localConversationId.value = conversationId;
  scrollToBottom();
};

/** 重置为新会话 */
const reset = () => {
  messages.value = [];
  localConversationId.value = props.conversationId ?? null;
  streamError.value = '';
};

defineExpose({
  reset,
  loadHistory,
  setConversation: (id: number | string | null) => (localConversationId.value = id)
});
</script>

<style lang="scss" scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  .chat-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .chat-prologue {
    align-self: center;
    text-align: center;
    color: var(--el-text-color-secondary);

    .prologue-text {
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
  }

  .chat-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .msg-user {
    display: flex;
    justify-content: flex-end;

    .msg-bubble.user {
      max-width: 78%;
      background: var(--el-color-primary);
      color: #fff;
      border-radius: 12px 12px 2px 12px;
      padding: 9px 13px;
      font-size: 14px;
      line-height: 1.6;
      word-break: break-word;
      white-space: pre-wrap;
    }
  }

  .msg-assistant {
    display: flex;
    justify-content: flex-start;

    .msg-bubble.assistant {
      max-width: 92%;
      background: var(--el-fill-color-light);
      border-radius: 12px 12px 12px 2px;
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.7;
      word-break: break-word;
    }
  }

  .typing {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .chat-error {
    margin: 0 16px;
  }

  .chat-input {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    padding: 12px 16px;
    border-top: 1px solid var(--el-border-color-lighter);

    .el-input {
      flex: 1;
    }
  }
}
</style>
