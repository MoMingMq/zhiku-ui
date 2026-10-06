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
          <!-- Element Plus X Conversations 会话列表（内置激活态/菜单；样式经 :deep 适配主题与容器宽） -->
          <Conversations
            v-model:active="activeKey"
            class="conv-list"
            :items="conversationItems"
            :items-style="{ backgroundColor: 'transparent' }"
            :menu="conversationMenu"
            @change="onConversationChange"
            @menu-command="onConversationMenu"
          />
        </aside>

        <!-- 右：对话面板 -->
        <main class="chat-main">
          <chat-panel
            v-if="selectedAppId"
            ref="panelRef"
            :app-id="selectedAppId"
            :conversation-id="activeConversationId"
            :prologue="selectedApp?.prologue ?? ''"
            :app-name="selectedApp?.appName"
            :suggested-questions="selectedAppSuggested"
            @done="onChatDone"
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
import { Conversations } from 'vue-element-plus-x';
import 'vue-element-plus-x/es/Conversations/index.css';

const route = useRoute();
const appOptions = ref<AiAppVO[]>([]);
const conversations = ref<AiConversationVO[]>([]);
const selectedAppId = ref<number | string | undefined>(undefined);
const activeConversationId = ref<number | string | null>(null);
const panelRef = ref<InstanceType<import('./components/chat-panel.vue').default>>();

const selectedApp = computed(() => appOptions.value.find(a => a.appId === selectedAppId.value));

/** Conversations 数据源与激活键 */
const activeKey = ref<string | number>();
const conversationItems = computed(() =>
  conversations.value.map(c => ({
    key: String(c.conversationId),
    label: c.title || '新对话'
  }))
);

const onConversationChange = (item: { key?: string | number }) => {
  if (item.key) {
    openConversation(item.key);
  }
};

const conversationMenu = [
  { label: '重命名', key: 'rename', icon: markRaw(Edit) },
  { label: '删除', key: 'delete', icon: markRaw(Delete), divided: true }
];

const onConversationMenu = (command: { command?: string; key?: string | number }, item?: { key?: string | number }) => {
  const convId = item?.key;
  if (!convId) return;
  const c = conversations.value.find(x => String(x.conversationId) === String(convId));
  if (!c) return;
  if (String(command) === 'rename') {
    renameConversation(c);
  } else if (String(command) === 'delete') {
    deleteConversation(c);
  }
};
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
  panelRef.value?.reset();
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
  await panelRef.value?.loadHistory(conversationId);
};

const newConversation = () => {
  activeConversationId.value = null;
  panelRef.value?.reset();
};

/** done 后刷新两次：立即一次（新会话入列），2 秒后再一次（AI 生成的标题就位） */
const onChatDone = () => {
  refreshConversations();
  setTimeout(refreshConversations, 2000);
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
      max-width: 100%;

      /* EPX Conversations 根列表带内联白底/固定 280 宽，强制适配容器与主题 */
      :deep(.elx-conversations__list) {
        width: 100% !important;
        background-color: transparent !important;
        padding: 0 0 4px 0;
      }

      :deep(.elx-conversations) {
        width: 100%;
        background-color: transparent;
      }

      :deep(.elx-conversations-item) {
        border-radius: 8px;
        margin-bottom: 2px;

        &:hover {
          background-color: var(--el-fill-color-light);
        }
      }

      :deep(.elx-conversations-item--active) {
        background-color: var(--el-color-primary-light-9);
      }

      :deep(.elx-conversations-item__content) {
        font-size: 13px;
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
