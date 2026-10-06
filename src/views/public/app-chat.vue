<template>
  <div class="public-chat">
    <!-- 左：会话列表（本机存储，免登录） -->
    <aside class="pub-side">
      <div class="pub-brand">
        <span class="pub-brand-logo">◆</span>
        <span class="pub-brand-name">知库 ZhiKu</span>
      </div>
      <div v-if="appInfo" class="pub-app">
        <div class="pub-app-name">{{ appInfo.appName }}</div>
        <div class="pub-app-desc">{{ appInfo.description }}</div>
      </div>
      <el-button class="pub-new" type="primary" plain icon="Plus" @click="newConversation">新对话</el-button>
      <div class="pub-convs">
        <div
          v-for="c in localConversations"
          :key="c.id"
          class="pub-conv-item"
          :class="{ 'is-active': String(c.id) === String(activeConversationId) }"
          @click="openConversation(c.id)"
        >
          <el-icon><ChatLineRound /></el-icon>
          <span class="pub-conv-title">{{ c.title }}</span>
          <el-icon class="pub-conv-del" @click.stop="removeConversation(c.id)"><Delete /></el-icon>
        </div>
        <div v-if="!localConversations.length" class="pub-conv-empty">暂无历史会话</div>
      </div>
    </aside>

    <!-- 右：对话区 -->
    <main class="pub-main">
      <template v-if="appInfo">
        <chat-panel
          ref="panelRef"
          :share-code="shareCode"
          :conversation-id="activeConversationId"
          :prologue="appInfo.prologue"
          :app-name="appInfo.appName"
          :suggested-questions="suggested"
          @done="onConversationCreated"
        />
      </template>
      <div v-else-if="!loading" class="pub-invalid">
        <el-empty description="链接不存在或已失效，请联系管理员获取新链接" :image-size="80" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import request from '@/utils/request';
import ChatPanel from '@/views/ai/chat/components/chat-panel.vue';

const route = useRoute();
const shareCode = computed(() => String(route.params.shareCode ?? ''));
const loading = ref(true);
const appInfo = ref<{ appName: string; description?: string; prologue?: string; suggestedQuestions?: string } | null>(null);
const panelRef = ref<InstanceType<typeof ChatPanel>>();
const activeConversationId = ref<number | string | null>(null);

/** 本机会话记录（免登录侧：localStorage 承载 id/标题/时间） */
interface LocalConversation {
  id: number | string;
  title: string;
  time: number;
}
const localConversations = ref<LocalConversation[]>([]);

const suggested = computed(() => {
  try {
    return JSON.parse(appInfo.value?.suggestedQuestions ?? '[]') as string[];
  } catch {
    return [];
  }
});

const storageKey = computed(() => `public_chat_convs_${shareCode.value}`);

const loadLocal = () => {
  try {
    localConversations.value = JSON.parse(localStorage.getItem(storageKey.value) ?? '[]');
  } catch {
    localConversations.value = [];
  }
};

const saveLocal = () => localStorage.setItem(storageKey.value, JSON.stringify(localConversations.value));

const onConversationCreated = (conversationId: number | string) => {
  if (!localConversations.value.some(c => String(c.id) === String(conversationId))) {
    localConversations.value.unshift({ id: conversationId, title: '新对话', time: Date.now() });
    saveLocal();
  }
  activeConversationId.value = conversationId;
  // 稍后取首问作标题（公开侧简化：首问前 16 字）
  setTimeout(async () => {
    try {
      const res = await request({
        url: `/public/app/${shareCode.value}/conversation/${conversationId}/messages`,
        method: 'get',
        headers: { clientid: import.meta.env.VITE_APP_CLIENT_ID as string }
      });
      const first = (res.data ?? []).find((m: { role: string; content: string | null }) => m.role === '1');
      if (first?.content) {
        const item = localConversations.value.find(c => String(c.id) === String(conversationId));
        if (item && item.title === '新对话') {
          item.title = first.content.slice(0, 16);
          saveLocal();
        }
      }
    } catch {
      /* 静默 */
    }
  }, 1500);
};

const openConversation = async (id: number | string) => {
  activeConversationId.value = id;
  await nextTick();
  panelRef.value?.loadHistory(id);
};

const newConversation = () => {
  activeConversationId.value = null;
  panelRef.value?.reset();
};

const removeConversation = (id: number | string) => {
  localConversations.value = localConversations.value.filter(c => String(c.id) !== String(id));
  saveLocal();
  if (String(activeConversationId.value) === String(id)) {
    newConversation();
  }
};

onMounted(async () => {
  loadLocal();
  try {
    const res = await request({
      url: `/public/app/${shareCode.value}`,
      method: 'get',
      headers: { clientid: import.meta.env.VITE_APP_CLIENT_ID as string }
    });
    appInfo.value = res.data as typeof appInfo.value;
    if (localConversations.value.length) {
      await openConversation(localConversations.value[0].id);
    }
  } catch {
    appInfo.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.public-chat {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: var(--el-bg-color-page);

  .pub-side {
    width: 260px;
    flex-shrink: 0;
    background: var(--el-bg-color);
    border-right: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    padding: 14px 12px;
    gap: 10px;

    .pub-brand {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      padding: 0 4px;

      .pub-brand-logo {
        color: var(--el-color-primary);
      }
    }

    .pub-app {
      padding: 8px 10px;
      border-radius: 10px;
      background: var(--el-color-primary-light-9);

      .pub-app-name {
        font-size: 14px;
        font-weight: 700;
      }

      .pub-app-desc {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        margin-top: 2px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }

    .pub-new {
      width: 100%;
    }

    .pub-convs {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .pub-conv-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 10px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.2s;

        > .el-icon {
          color: var(--el-text-color-secondary);
          flex-shrink: 0;
        }

        .pub-conv-title {
          flex: 1;
          min-width: 0;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pub-conv-del {
          display: none;
          color: var(--el-text-color-placeholder);

          &:hover {
            color: var(--el-color-danger);
          }
        }

        &:hover {
          background: var(--el-fill-color-light);

          .pub-conv-del {
            display: inline-flex;
          }
        }

        &.is-active {
          border-color: var(--el-color-primary-light-5);
          background: var(--el-fill-color-light);
        }
      }

      .pub-conv-empty {
        text-align: center;
        font-size: 12px;
        color: var(--el-text-color-placeholder);
        padding: 24px 0;
      }
    }
  }

  .pub-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    > :deep(.chat-panel) {
      flex: 1;
      min-height: 0;
    }

    .pub-invalid {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
