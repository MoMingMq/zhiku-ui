<template>
  <div class="app-detail">
    <aside class="app-side">
      <div class="side-back" @click="$emit('back')">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回列表</span>
      </div>
      <div class="side-name">
        <span class="side-icon">
          <el-icon v-if="isElementIcon(app?.icon)" :size="20"><component :is="app?.icon" /></el-icon>
          <template v-else>{{ app?.icon || '🤖' }}</template>
        </span>
        <span class="side-title">{{ app?.appName || '…' }}</span>
      </div>
      <el-menu :default-active="activeTab" @select="(k: string) => (activeTab = k)">
        <el-menu-item index="overview">
          <el-icon><DataAnalysis /></el-icon>
          <span>概览</span>
        </el-menu-item>
        <el-menu-item index="settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </aside>
    <main class="app-main">
      <app-overview v-if="activeTab === 'overview'" :app="app" :stats="stats" @start-chat="startChat" @refresh="loadAll" />
      <app-settings v-else-if="app" :app="app" @saved="loadAll" />
    </main>
  </div>
</template>

<script setup lang="ts">
import api from '@/api/ai/app';
import type { AiAppStatsVO, AiAppVO } from '@/api/ai/app/types';
import AppOverview from './overview.vue';
import AppSettings from './settings.vue';

const props = defineProps<{ appId: number | string }>();
const emit = defineEmits<{ back: [] }>();

const app = ref<AiAppVo2>();
type AiAppVo2 = AiAppVO;
const stats = ref<AiAppStatsVO | null>(null);
const activeTab = ref(props.appId ? 'overview' : 'overview');
const router = useRouter();

const isElementIcon = (icon: string | null | undefined): boolean => /^[A-Z][A-Za-z0-9]*$/.test(icon ?? '');

const loadAll = async () => {
  const res = await api.getAiApp(props.appId);
  app.value = res.data;
  const statsRes = await api.getAppStats(props.appId);
  stats.value = statsRes.data;
};

const startChat = () => {
  router.push({ path: '/ai/chat', query: { appId: props.appId } });
};

watch(
  () => props.appId,
  () => loadAll(),
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.app-detail {
  display: flex;
  height: calc(100vh - 123px);
  background: var(--el-bg-color);
  border-radius: 4px;

  .app-side {
    width: 200px;
    flex-shrink: 0;
    border-right: 1px solid var(--el-border-color-lighter);
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .side-back {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 6px;

      &:hover {
        background: var(--el-fill-color-light);
        color: var(--el-color-primary);
      }
    }

    .side-name {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;

      .side-icon {
        width: 38px;
        height: 38px;
        border-radius: 9px;
        background: linear-gradient(135deg, var(--el-color-primary-light-8), var(--el-color-primary-light-9));
        color: var(--el-color-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .side-title {
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    :deep(.el-menu) {
      border-right: none;
    }
  }

  .app-main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
  }
}
</style>
