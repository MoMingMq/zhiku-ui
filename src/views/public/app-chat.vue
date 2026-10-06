<template>
  <div class="public-chat">
    <div class="public-shell">
      <header class="public-header">
        <div class="public-brand">
          <span class="public-logo">◆</span>
          <span>知库 ZhiKu</span>
        </div>
        <h2 v-if="appInfo">{{ appInfo.appName }}</h2>
        <p v-if="appInfo?.description" class="public-desc">{{ appInfo.description }}</p>
      </header>
      <main class="public-main">
        <template v-if="appInfo">
          <chat-panel
            ref="panelRef"
            :share-code="shareCode"
            :conversation-id="localConversationId"
            :prologue="appInfo.prologue"
            :suggested-questions="suggested"
            @done="onConversationCreated"
          />
        </template>
        <el-empty v-else-if="!loading" description="链接不存在或已失效" :image-size="80">
          <template #description>
            <p>链接不存在或已失效，请联系应用管理员获取新链接</p>
          </template>
        </el-empty>
      </main>
    </div>
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
const localConversationId = ref<number | string | null>(null);

const suggested = computed(() => {
  try {
    return JSON.parse(appInfo.value?.suggestedQuestions ?? '[]') as string[];
  } catch {
    return [];
  }
});

const storageKey = computed(() => `public_chat_conv_${shareCode.value}`);

const onConversationCreated = (conversationId: number | string) => {
  localConversationId.value = conversationId;
  localStorage.setItem(storageKey.value, String(conversationId));
};

onMounted(async () => {
  try {
    const res = await request({ url: `/public/app/${shareCode.value}`, method: 'get' });
    appInfo.value = res.data as typeof appInfo.value;
    // 恢复上次匿名会话
    const saved = localStorage.getItem(storageKey.value);
    if (saved) {
      localConversationId.value = saved;
      await nextTick();
      panelRef.value?.loadHistory(saved);
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
  min-height: 100vh;
  background: var(--el-bg-color-page);
  display: flex;
  justify-content: center;

  .public-shell {
    width: 100%;
    max-width: 880px;
    display: flex;
    flex-direction: column;

    .public-header {
      padding: 24px 20px 12px;
      text-align: center;

      .public-brand {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--el-text-color-secondary);

        .public-logo {
          font-size: 18px;
        }
      }

      h2 {
        margin: 10px 0 4px;
        font-size: 20px;
      }

      .public-desc {
        font-size: 13px;
        color: var(--el-text-color-secondary);
        margin: 0;
      }
    }

    .public-main {
      flex: 1;
      min-height: 0;
      margin: 8px 12px 12px;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;

      > :deep(.chat-panel) {
        flex: 1;
        min-height: 60vh;
      }
    }
  }
}
</style>
