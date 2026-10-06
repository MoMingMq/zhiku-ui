<template>
  <div class="chat-panel">
    <div ref="listRef" class="chat-list">
      <!-- 空态：Welcome + Prompts 居中（实时联动配置） -->
      <div v-if="messages.length === 0 && !streaming" class="chat-welcome">
        <Welcome :title="welcomeTitle" :description="appInfo.prologue || ''" variant="filled" />
        <Prompts v-if="suggestedList.length" class="chat-prompts" :items="promptItems" @item-click="onPromptClick" />
      </div>

      <!-- 消息流：BubbleList 滚动分页（滚到顶部加载更早消息） -->
      <BubbleList
        v-else
        :list="bubbleItems"
        :virtual="false"
        max-height="100%"
        :auto-scroll="true"
        :load-more-top-threshold="60"
        :top-status="topLoadStatus"
        @load-more-top="emit('load-more-top')"
        style="height: 100%"
      >
        <template #avatar="{ item }">
          <el-avatar v-if="'user' in item.msg" :size="34" style="background: var(--el-color-primary); flex-shrink: 0">我</el-avatar>
          <el-avatar v-else :size="34" style="background: var(--el-color-success); flex-shrink: 0">
            <el-icon><MagicStick /></el-icon>
          </el-avatar>
        </template>
        <template #header="{ item }">
          <tool-call-item
            v-for="(tc, i) in dedupeToolCalls(assistantOf(item).toolCalls)"
            :key="i"
            :record="tc"
          />
        </template>
        <template #content="{ item }">
          <div v-if="'user' in item.msg" class="msg-bubble user">{{ item.msg.user }}</div>
          <div v-else class="msg-bubble assistant">
            <markdown-renderer v-if="item.msg.assistant.content" :markdown="item.msg.assistant.content" :is-dark="themeDark" />
            <span v-if="!item.msg.assistant.done && !item.msg.assistant.content" class="typing">
              <el-icon class="is-loading"><Loading /></el-icon>
              正在思考…
            </span>
          </div>
        </template>
        <template #footer="{ item }">
          <!-- 引用来源：横条按钮，点击开右侧抽屉（统一查看全部引用） -->
          <button
            v-if="!('user' in item.msg) && item.msg.assistant.done && item.msg.assistant.citations.length"
            class="citation-bar"
            @click="openCitations(item.msg.assistant.citations)"
          >
            <el-icon><Collection /></el-icon>
            <span>引用来源</span>
            <span class="citation-bar-count">{{ item.msg.assistant.citations.length }}</span>
            <span
              v-for="(c, i) in dedupeCitations(item.msg.assistant.citations).slice(0, 3)"
              :key="c.chunkId"
              class="citation-bar-doc"
            >{{ c.documentName }}</span>
          </button>
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

    <!-- 引用来源抽屉：一次展示本回答全部引用，点文档切换预览 -->
    <el-drawer v-model="citationDrawer.visible" title="引用来源" size="62%" append-to-body>
      <div class="citation-drawer">
        <aside class="cd-list">
          <div
            v-for="(c, i) in citationDrawer.citations"
            :key="c.chunkId"
            class="cd-item"
            :class="{ 'is-active': c.chunkId === citationDrawer.activeId }"
            @click="selectCitation(c)"
          >
            <span class="cd-item-idx">[{{ i + 1 }}]</span>
            <div class="cd-item-body">
              <div class="cd-item-doc">{{ c.documentName }}</div>
              <div class="cd-item-path">{{ c.headingPath || '（无标题路径）' }}</div>
            </div>
            <span class="cd-item-score">{{ (c.score * 100).toFixed(0) }}%</span>
          </div>
        </aside>
        <section v-loading="citationDrawer.loading" class="cd-preview">
          <template v-if="citationDrawer.preview">
            <div class="cd-preview-meta">
              <el-tag size="small" effect="plain">{{ citationDrawer.preview.headingPath || '（无标题路径）' }}</el-tag>
              <el-tag size="small" type="info" effect="plain">#{{ citationDrawer.preview.seq }}</el-tag>
            </div>
            <div v-if="citationDrawer.preview.prevContent" class="cd-block">
              <div class="cd-block-label">上一分块</div>
              <MarkdownRenderer :markdown="citationDrawer.preview.prevContent" :is-dark="themeDark" />
            </div>
            <div class="cd-block cd-block-current">
              <div class="cd-block-label cd-block-label-current">命中的分块</div>
              <MarkdownRenderer :markdown="citationDrawer.preview.content" :is-dark="themeDark" />
            </div>
            <div v-if="citationDrawer.preview.nextContent" class="cd-block">
              <div class="cd-block-label">下一分块</div>
              <MarkdownRenderer :markdown="citationDrawer.preview.nextContent" :is-dark="themeDark" />
            </div>
          </template>
          <el-empty v-else-if="!citationDrawer.loading" description="选择左侧引用查看原文" :image-size="60" />
        </section>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import request from '@/utils/request';
import { chatSSE, getChunkContext } from '@/api/ai/app';
import type { ChatStreamState, CitationVO } from '@/api/ai/app/types';
import { initialChatStreamState } from '@/api/ai/app/types';
import { useThemeDark } from '@/hooks/common/useTheme';
import { chatStreamReducer, historyToStreamState } from './chat-stream';
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
  /** 会话消息总数（供父层滚动分页判断） */
  messageTotal?: number;
}>();

const emit = defineEmits<{
  done: [conversationId: number | string];
  /** 滚动到顶部加载更早消息（父层实现分页取数后调 prependHistory） */
  'load-more-top': [];
}>();

const { themeDark } = useThemeDark();
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

/** BubbleList 数据源（msg 透传给插槽） */
const bubbleItems = computed(() =>
  messages.value.map((m, i) => ({ id: i, placement: 'user' in m ? 'end' : 'start', msg: m }))
);

/** header 插槽用：取条目的 assistant 状态（用户条目返回空态） */
const assistantOf = (item: { msg?: DisplayMessage }): Partial<ChatStreamState> =>
  item?.msg && !('user' in item.msg) ? item.msg.assistant : ({ toolCalls: [] } as Partial<ChatStreamState>);

/** 工具调用去重（同名同参多次分片上报时只展示一次执行） */
const dedupeToolCalls = (calls: Array<{ name: string; args: string; result: string; success: boolean | null }>) => {
  const seen = new Set<string>();
  return calls.filter(c => {
    const key = `${c.name}|${c.args}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** 引用去重（同分块只留一条） */
const dedupeCitations = (citations: CitationVO[]) => {
  const seen = new Set<number | string>();
  return citations.filter(c => {
    if (seen.has(c.chunkId)) return false;
    seen.add(c.chunkId);
    return true;
  });
};

// ===== 引用来源抽屉 =====
const citationDrawer = reactive({
  visible: false,
  loading: false,
  citations: [] as CitationVO[],
  activeId: null as number | string | null,
  preview: null as { headingPath: string | null; seq: number; prevContent: string | null; content: string | null; nextContent: string | null } | null
});

const openCitations = (citations: CitationVO[]) => {
  citationDrawer.citations = dedupeCitations(citations);
  citationDrawer.visible = true;
  if (citationDrawer.citations.length) {
    selectCitation(citationDrawer.citations[0]);
  }
};

const selectCitation = async (c: CitationVO) => {
  citationDrawer.activeId = c.chunkId;
  citationDrawer.loading = true;
  try {
    const url = isPublic.value
      ? `/public/app/${props.shareCode}/chunk-context/${c.chunkId}`
      : `/ai/app/chunk/${c.chunkId}/context`;
    const res = await request<unknown, { code: number; data: typeof citationDrawer.preview }>({ url, method: 'get' });
    citationDrawer.preview = res.data;
  } finally {
    citationDrawer.loading = false;
  }
};

const onPromptClick = (item: { label?: string }) => {
  if (item.label) {
    sendMessage(item.label);
  }
};

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

/** 滚动分页：把更早的消息插到头部（父层按页取数后调用） */
const prependHistory = (earlier: Parameters<typeof historyToStreamState>[0]) => {
  const converted = historyToStreamState(earlier);
  messages.value = [...converted, ...messages.value];
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
  prependHistory,
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
      max-width: 600px;

      :deep(.elx-prompts) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        background: transparent;
      }

      :deep(.elx-prompts__item) {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
        border: 1px solid var(--el-border-color-lighter);
        border-radius: 10px;
        background: var(--el-bg-color);
        color: var(--el-text-color-regular);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        overflow: hidden;

        &:hover {
          border-color: var(--el-color-primary-light-5);
          color: var(--el-color-primary);
          transform: translateY(-1px);
          box-shadow: var(--el-box-shadow-light);
        }
      }

      :deep(.elx-prompts__item-content) {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }

  /* 消息行：头像 + 间距（市面布局：角色头像在侧，内容留白呼吸） */
  :deep(.elx-bubble-list__list) {
    padding: 20px 24px;
  }

  :deep(.elx-bubble) {
    --elx-bubble-content-max-width: min(72%, 680px) !important;
    margin-bottom: 18px;

    &.elx-bubble--end .elx-bubble__content {
      border-radius: 14px 14px 4px 14px;
    }

    &.elx-bubble--start .elx-bubble__content {
      border-radius: 4px 14px 14px 14px;
    }
  }

  .msg-bubble {
    font-size: 14px;
    line-height: 1.75;
    word-break: break-word;

    &.user {
      color: #fff;
      white-space: pre-wrap;
    }

    &.assistant {
      /* MD 渲染器适配主题：透传底色（x-md-renderer 自带内联底色需覆盖） */
      :deep(.x-md-renderer) {
        background: transparent !important;
        padding: 0 !important;
        color: inherit !important;
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

  /* 引用来源横条（市面形态：一行汇总，点开抽屉看全部） */
  .citation-bar {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding: 7px 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-bg-color);
    font-size: 12px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    transition: all 0.2s;
    max-width: 100%;

    .citation-bar-count {
      min-width: 18px;
      height: 18px;
      line-height: 18px;
      text-align: center;
      border-radius: 9px;
      background: var(--el-color-primary);
      color: #fff;
      font-weight: 600;
    }

    .citation-bar-doc {
      padding: 1px 8px;
      border-radius: 4px;
      background: var(--el-fill-color-light);
      color: var(--el-text-color-secondary);
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      & + .citation-bar-doc {
        margin-left: -4px;
      }
    }

    &:hover {
      border-color: var(--el-color-primary-light-5);
      color: var(--el-color-primary);

      .citation-bar-doc {
        color: var(--el-color-primary);
      }
    }
  }

  .chat-input {
    padding: 12px 24px 16px;

    .chat-sender {
      width: 100%;
    }
  }

  /* 引用抽屉：左列表 + 右预览（MD 渲染对齐知识库分块） */
  .citation-drawer {
    display: flex;
    height: 100%;
    gap: 14px;

    .cd-list {
      width: 240px;
      flex-shrink: 0;
      overflow-y: auto;
      border-right: 1px solid var(--el-border-color-lighter);
      padding-right: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;

      .cd-item {
        display: flex;
        gap: 8px;
        padding: 10px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.2s;

        .cd-item-idx {
          color: var(--el-color-primary);
          font-weight: 700;
          font-size: 13px;
        }

        .cd-item-body {
          flex: 1;
          min-width: 0;

          .cd-item-doc {
            font-size: 13px;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .cd-item-path {
            font-size: 12px;
            color: var(--el-text-color-secondary);
            margin-top: 2px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }

        .cd-item-score {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }

        &:hover {
          background: var(--el-fill-color-light);
        }

        &.is-active {
          border-color: var(--el-color-primary-light-5);
          background: var(--el-color-primary-light-9);
        }
      }
    }

    .cd-preview {
      flex: 1;
      min-width: 0;
      overflow-y: auto;

      .cd-preview-meta {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .cd-block {
        margin-bottom: 16px;

        .cd-block-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--el-text-color-secondary);
          margin-bottom: 6px;
        }

        .cd-block-label-current {
          color: var(--el-color-primary);
        }

        &.cd-block-current {
          padding: 12px;
          border-radius: 8px;
          background: var(--el-color-primary-light-9);
          border: 1px solid var(--el-color-primary-light-7);
        }

        /* 相邻分块的 MD 渲染同主题 */
        :deep(.x-md-renderer) {
          background: transparent !important;
          padding: 0 !important;
          color: inherit !important;
        }
      }
    }
  }
}
</style>
