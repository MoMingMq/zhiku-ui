<template>
  <div class="chat-panel">
    <div ref="listRef" class="chat-list">
      <!-- 空态：Welcome + Prompts 居中（实时联动配置） -->
      <div v-if="messages.length === 0 && !streaming" class="chat-welcome">
        <Welcome :title="welcomeTitle" :description="appInfo.prologue || ''" variant="filled" />
        <Prompts v-if="suggestedList.length" class="chat-prompts" :items="promptItems" @item-click="onPromptClick" />
      </div>

      <!-- 消息流：Element Plus X BubbleList（自动跟随滚动/回底按钮），item 插槽自绘 -->
      <BubbleList v-else :list="bubbleItems" max-height="100%" :auto-scroll="true" style="height: 100%">
        <template #item="{ item }">
          <div v-if="'user' in item.msg" class="msg-row user-row">
            <div class="msg-bubble user">{{ item.msg.user }}</div>
          </div>
          <div v-else class="msg-row assistant-row">
            <div class="msg-bubble assistant">
              <tool-call-item v-for="(tc, i) in item.msg.assistant.toolCalls" :key="i" :record="tc" />
              <markdown-renderer v-if="item.msg.assistant.content" :markdown="item.msg.assistant.content" :is-dark="themeDark" />
              <span v-if="!item.msg.assistant.done && !item.msg.assistant.content" class="typing">
                <el-icon class="is-loading"><Loading /></el-icon>
                正在思考…
              </span>
              <citation-list
                v-if="item.msg.assistant.done && item.msg.assistant.citations.length"
                :citations="item.msg.assistant.citations"
                @inspect="openChunkContext"
              />
            </div>
          </div>
        </template>
      </BubbleList>

      <!-- 错误提示 -->
      <el-alert v-if="streamError" :title="streamError" type="error" :closable="false" show-icon class="chat-error">
        <el-button v-if="retryable" size="small" type="primary" plain @click="sendMessage(lastQuestion)">重试</el-button>
      </el-alert>
    </div>

    <!-- 输入区：Element Plus X Sender（Enter 发送 / Shift+Enter 换行；loading 态变停止按钮） -->
    <div class="chat-input">
      <XSender
        ref="senderRef"
        class="chat-sender"
        :loading="streaming"
        placeholder="输入问题，Enter 发送 / Shift+Enter 换行"
        @submit="handleSenderSubmit"
        @cancel="stopGenerate"
      />
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
import { chatStreamReducer, historyToStreamState } from './chat-stream';
import CitationList from './citation-list.vue';
import ChunkContextDialog from './chunk-context-dialog.vue';
import ToolCallItem from './tool-call-item.vue';
import { BubbleList, Prompts, Welcome, XSender } from 'vue-element-plus-x';
import 'vue-element-plus-x/es/Bubble/index.css';
import 'vue-element-plus-x/es/BubbleList/index.css';
import 'vue-element-plus-x/es/Welcome/index.css';
import 'vue-element-plus-x/es/Prompts/index.css';
import 'vue-element-plus-x/es/XSender/index.css';
import { MarkdownRenderer } from 'x-markdown-vue';

const props = defineProps<{
  /** 管理端传应用ID；公开模式传 shareCode */
  appId?: number | string;
  shareCode?: string;
  /** 会话ID（可空=新会话；公开模式由父层持 localStorage） */
  conversationId?: number | string | null;
  /** 应用公开信息（实时联动：配置页输入即预览） */
  prologue?: string;
  appName?: string;
  suggestedQuestions?: string[];
}>();

const emit = defineEmits<{ done: [conversationId: number | string] }>();

const { themeDark } = useThemeDark();
const chunkDialogRef = ref<InstanceType<typeof ChunkContextDialog>>();
const senderRef = ref<InstanceType<typeof XSender>>();
const streaming = ref(false);
const streamError = ref('');
const retryable = ref(false);
const lastQuestion = ref('');

const appInfo = computed(() => ({
  prologue: props.prologue ?? '',
  suggested: props.suggestedQuestions ?? []
}));
const suggestedList = computed(() => appInfo.value.suggested);
const welcomeTitle = computed(() => (props.appName ? `你好，我是 ${props.appName}` : '你好'));
const promptItems = computed(() => suggestedList.value.map((q, i) => ({ key: i, label: q })));

/** 消息流：user 串 | assistant 流式状态 */
type DisplayMessage = { user: string } | { assistant: ChatStreamState };
const messages = ref<DisplayMessage[]>([]);
const currentStream = ref<ChatStreamState | null>(null);
const localConversationId = ref<number | string | null>(props.conversationId ?? null);
let abortController: AbortController | null = null;

const isPublic = computed(() => !!props.shareCode);
const chatUrl = () => (isPublic.value ? `/public/app/${props.shareCode}/chat` : `/ai/app/${props.appId}/chat`);

/** BubbleList 数据源（msg 透传给 item 插槽） */
const bubbleItems = computed(() =>
  messages.value.map((m, i) => ({ id: i, placement: 'user' in m ? 'end' : 'start', msg: m }))
);

const openChunkContext = (chunkId: number | string) => chunkDialogRef.value?.open(chunkId);

const onPromptClick = (item: { label?: string }) => {
  if (item.label) {
    sendMessage(item.label);
  }
};

/** XSender 提交：getModelValue 取纯文本（富文本取 .text），发送后 onClear 清空编辑器 */
const handleSenderSubmit = () => {
  if (streaming.value) return;
  const model = senderRef.value?.getModelValue();
  const text = (model?.text ?? '').trim();
  if (!text) return;
  senderRef.value?.onClear();
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

/** 载入历史（管理端与公开端点 URL 不同；回放形态与流式同构） */
const loadHistory = async (conversationId: number | string) => {
  const url = isPublic.value
    ? `/public/app/${props.shareCode}/conversation/${conversationId}/messages`
    : `/ai/app/conversation/${conversationId}/messages`;
  const res = await request<unknown, { code: number; data: Parameters<typeof historyToStreamState>[0] }>({
    url,
    method: 'get'
  });
  messages.value = historyToStreamState(res.data ?? []);
  localConversationId.value = conversationId;
};

/** 重置为新会话（回开场白） */
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
    display: flex;
    flex-direction: column;
  }

  .chat-welcome {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 24px;

    .chat-prompts {
      width: 100%;
      max-width: 560px;
    }
  }

  .msg-row {
    display: flex;
    padding: 6px 16px;

    &.user-row {
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

    &.assistant-row {
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
  }

  .typing {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .chat-error {
    margin: 0 16px 8px;
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
