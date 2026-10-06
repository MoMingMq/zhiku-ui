<template>
  <div class="app-overview">
    <!-- 基本信息块 -->
    <el-card shadow="never" class="ov-card">
      <template #header><span class="ov-title">基本信息</span></template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="应用名称">{{ app.appName }}</el-descriptions-item>
        <el-descriptions-item label="应用类型">
          <el-tag size="small" effect="plain">{{ app.appType === 'simple' ? '简易应用' : app.appType }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="对话类型">
          <el-tag size="small" type="success" effect="plain">{{ app.chatType }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="对话模型">{{ app.modelName || '未选择' }}</el-descriptions-item>
        <el-descriptions-item label="知识库">{{ app.kbIds?.length ?? 0 }} 个</el-descriptions-item>
        <el-descriptions-item label="工具">{{ app.toolIds?.length ?? 0 }} 个</el-descriptions-item>
        <el-descriptions-item label="描述" :span="3">{{ app.description || '暂无' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 公开访问区 -->
      <div class="share-block">
        <div class="share-head">
          <span class="share-label">公开访问</span>
          <el-switch :model-value="app.shareEnabled === '1'" :loading="shareLoading" @change="toggleShare" />
          <span class="share-tip">开启后任何人可通过链接直接使用本应用对话（无需登录）</span>
        </div>
        <div v-if="app.shareEnabled === '1' && app.shareCode" class="share-url">
          <el-input :model-value="publicUrl" readonly>
            <template #append>
              <el-button icon="CopyDocument" @click="copyUrl">复制</el-button>
            </template>
          </el-input>
        </div>
        <div class="ip-row">
          <el-input
            v-model="ipWhitelist"
            placeholder="IP 白名单（如 10.0.0.1,192.168.0.0/24，留空不限）"
            size="small"
            style="max-width: 420px"
          />
          <el-button size="small" @click="saveIpWhitelist">保存白名单</el-button>
        </div>
      </div>

      <div class="ov-actions">
        <el-button type="primary" icon="ChatDotRound" @click="$emit('start-chat')">开始对话</el-button>
      </div>
    </el-card>

    <!-- 监控统计块 -->
    <el-card shadow="never" class="ov-card">
      <template #header><span class="ov-title">监控统计</span></template>
      <div v-if="stats" class="stat-grid">
        <div class="stat-item">
          <div class="stat-num">{{ stats.totalQuestions }}</div>
          <div class="stat-label">提问总数</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ stats.totalConversations }}</div>
          <div class="stat-label">会话总数</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ stats.totalTokens }}</div>
          <div class="stat-label">Token 总消耗</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ stats.todayQuestions }}</div>
          <div class="stat-label">今日提问</div>
        </div>
      </div>
      <el-table v-if="stats?.last7d?.length" :data="stats.last7d" size="small" class="stat-table">
        <el-table-column label="日期" prop="date" width="120" />
        <el-table-column label="提问数" prop="questions" width="100" />
        <el-table-column label="Token 消耗" prop="tokens" />
      </el-table>
      <el-empty v-else-if="stats" description="暂无对话数据" :image-size="60" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import api from '@/api/ai/app';
import type { AiAppStatsVO, AiAppVO } from '@/api/ai/app/types';
import modal from '@/plugins/modal';

const props = defineProps<{ app: AiAppVO; stats: AiAppStatsVO | null }>();
const emit = defineEmits<{ 'start-chat': []; refresh: [] }>();

const shareLoading = ref(false);
const ipWhitelist = ref(props.app.ipWhitelist ?? '');

watch(
  () => props.app.ipWhitelist,
  v => (ipWhitelist.value = v ?? '')
);

const publicUrl = computed(() => `${window.location.origin}/public/app/${props.app.shareCode}`);

const toggleShare = async (enabled: string | number | boolean) => {
  shareLoading.value = true;
  try {
    await api.toggleAppShare(props.app.appId, !!enabled);
    modal.msgSuccess(enabled ? '公开访问已开启' : '公开访问已关闭（旧链接立即失效）');
    emit('refresh');
  } finally {
    shareLoading.value = false;
  }
};

const saveIpWhitelist = async () => {
  await api.updateAppIpWhitelist(props.app.appId, ipWhitelist.value);
  modal.msgSuccess('白名单已保存');
  emit('refresh');
};

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(publicUrl.value);
    modal.msgSuccess('链接已复制');
  } catch {
    modal.msgError('复制失败，请手动选择复制');
  }
};
</script>

<style lang="scss" scoped>
.app-overview {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  .ov-title {
    font-weight: 600;
  }

  .share-block {
    margin-top: 16px;
    border-top: 1px dashed var(--el-border-color-lighter);
    padding-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .share-head {
      display: flex;
      align-items: center;
      gap: 10px;

      .share-label {
        font-weight: 600;
      }

      .share-tip {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    .share-url {
      max-width: 640px;
    }

    .ip-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }

  .ov-actions {
    margin-top: 14px;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 12px;

    .stat-item {
      text-align: center;
      padding: 16px 0;
      border-radius: 8px;
      background: var(--el-fill-color-light);

      .stat-num {
        font-size: 24px;
        font-weight: 700;
        color: var(--el-color-primary);
      }

      .stat-label {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        margin-top: 4px;
      }
    }
  }
}
</style>
