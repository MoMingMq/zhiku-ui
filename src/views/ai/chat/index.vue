<template>
  <div class="p-2 app-container chat-page">
    <el-card shadow="hover" class="table-panel chat-panel-card">
      <div class="chat-layout">
        <!-- 左：应用选择 + 会话列表 -->
        <aside class="chat-side">
          <el-select v-model="selectedAppId" placeholder="选择应用" filterable style="width: 100%" @change="handleAppChange">
            <el-option v-for="a in appOptions" :key="a.appId" :label="a.appName" :value="a.appId" />
          </el-select>
          <div class="conv-actions">
            <el-button size="small" type="primary" plain icon="Plus" :disabled="!selectedAppId" @click="newConversation">新对话</el-button>
          </div>
          <div class="conv-list">
            <div
              v-for="c in conversations"
              :key="c.conversationId"
              class="conv-item"
              :class="{ 'is-active': c.conversationId === activeConversationId }"
              @click="openConversation(c.conversationId)"
            >
              <el-icon class="conv-icon"><ChatLineRound /></el-icon>
              <span class="conv-title">{{ c.title || '新对话' }}</span>
              <span class="conv-ops" @click.stop>
                <el-icon @click="renameConversation(c)"><Edit /></el-icon>
                <el-icon @click="deleteConversation(c)"><Delete /></el-icon>
              </span>
            </div>
            <el-empty v-if="!conversations.length" description="暂无会话" :image-size="50" />
          </div>
        </aside>

        <!-- 右：对话面板 -->
        <main class="chat-main">
          <chat-panel
            v-if="selectedAppId"
            ref="panelRef"
            :key="`${selectedAppId}-${activeConversationId ?? 'new'}`"
            :app-id="selectedAppId"
            :conversation-id="activeConversationId"
            :prologue="selectedApp?.prologue ?? ''"
            :suggested-questions="selectedAppSuggested"
            @done="refreshConversations"
          />
          <el-empty v-else description="选择一个应用开始对话" />
        </main>
      </div>
    </el-card>
  </div>
</template>

<script setup name="Chat" lang="ts">
import api from '@/api/ai/app';
import type { AiAppVO, AiConversationVO } from '@/api/ai/app/types';
import modal from '@/plugins/modal';

const route = useRoute();
const appOptions = ref<AiAppVO[]>([]);
const conversations = ref<AiConversationVO[]>([]);
const selectedAppId = ref<number | string | undefined>(undefined);
const activeConversationId = ref<number | string | null>(null);
const panelRef = ref<InstanceType<import('./components/chat-panel.vue').default>>();

const selectedApp = computed(() => appOptions.value.find(a => a.appId === selectedAppId.value));
const selectedAppSuggested = computed(() => {
  try {
    return JSON.parse(selectedApp.value?.suggestedQuestions ?? '[]') as string[];
  } catch {
    return [];
  }
});

const loadApps = async () => {
  const res = await api.listAiApp({ pageNum: 1, pageSize: 100, status: '0' });
  appOptions.value = res.data?.rows ?? [];
  const fromQuery = route.query.appId as string | undefined;
  if (fromQuery && appOptions.value.some(a => String(a.appId) === fromQuery)) {
    selectedAppId.value = fromQuery;
    await refreshConversations();
  }
};

const handleAppChange = async () => {
  activeConversationId.value = null;
  await refreshConversations();
};

const refreshConversations = async () => {
  if (!selectedAppId.value) {
    conversations.value = [];
    return;
  }
  const res = await api.listConversations(selectedAppId.value);
  conversations.value = res.data ?? [];
};

const openConversation = async (conversationId: number | string) => {
  activeConversationId.value = conversationId;
  await nextTick();
  panelRef.value?.loadHistory(conversationId);
};

const newConversation = () => {
  activeConversationId.value = null;
};

const renameConversation = async (c: AiConversationVO) => {
  const { value } = await ElMessageBox.prompt('会话标题', '重命名', { inputValue: c.title ?? '' });
  await api.renameConversation(c.conversationId, value);
  modal.msgSuccess('已重命名');
  await refreshConversations();
};

const deleteConversation = async (c: AiConversationVO) => {
  await modal.confirm(`删除会话"${c.title || '新对话'}"及其全部消息？`);
  await api.delConversation(c.conversationId);
  if (activeConversationId.value === c.conversationId) {
    activeConversationId.value = null;
  }
  await refreshConversations();
};

onMounted(loadApps);
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;

.chat-page {
  .chat-panel-card {
    height: calc(100vh - 123px);
    display: flex;
    flex-direction: column;

    :deep(.el-card__body) {
      flex: 1;
      min-height: 0;
      display: flex;
    }
  }
}

.chat-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;

  .chat-side {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .conv-actions {
      display: flex;
    }

    .conv-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .conv-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.2s;

        .conv-icon {
          color: var(--el-text-color-secondary);
          flex-shrink: 0;
        }

        .conv-title {
          flex: 1;
          min-width: 0;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .conv-ops {
          display: none;
          gap: 6px;

          .el-icon:hover {
            color: var(--el-color-primary);
          }
        }

        &:hover {
          background: var(--el-fill-color-light);

          .conv-ops {
            display: inline-flex;
          }
        }

        &.is-active {
          border-color: var(--el-color-primary-light-5);
          background: var(--el-fill-color-light);
        }
      }
    }
  }

  .chat-main {
    flex: 1;
    min-width: 0;
    border-left: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
  }
}
</style>
