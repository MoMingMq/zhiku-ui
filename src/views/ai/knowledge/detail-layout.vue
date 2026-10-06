<template>
  <div class="p-2 app-container kb-detail-layout">
    <!-- 左侧固定菜单：知识库名称 + 返回 + 子菜单 -->
    <div class="layout-side">
      <div class="side-header" @click="emit('back')">
        <el-icon class="side-back"><Back /></el-icon>
        <div class="side-header-text">
          <span class="side-kicker">知识库</span>
          <span class="side-name" :title="dataset?.datasetName">{{ dataset?.datasetName || '...' }}</span>
        </div>
      </div>
      <el-menu :default-active="activeMenu" class="side-menu" @select="handleMenuSelect">
        <el-menu-item index="documents">
          <el-icon><Document /></el-icon>
          <span>知识库</span>
        </el-menu-item>
        <el-menu-item index="hit-test">
          <el-icon><Aim /></el-icon>
          <span>测试</span>
        </el-menu-item>
      </el-menu>
      <div class="side-footer" v-if="dataset?.embedDim">
        <span class="form-tip">向量维度 {{ dataset.embedDim }}</span>
      </div>
    </div>

    <!-- 右侧内容区 -->
    <div class="layout-content">
      <kb-documents v-if="activeMenu === 'documents'" :dataset-id="datasetId" />
      <kb-hit-test v-else-if="activeMenu === 'hit-test'" :dataset-id="datasetId" />
    </div>
  </div>
</template>

<script setup lang="ts">
import KbDocuments from './documents.vue';
import KbHitTest from './hit-test.vue';
import { getDataset } from '@/api/ai/knowledge';
import { KbDatasetVO } from '@/api/ai/knowledge/types';

const props = defineProps<{ datasetId: number | string }>();
const emit = defineEmits<{ (e: 'back'): void }>();

const dataset = ref<KbDatasetVO>();
const activeMenu = ref('documents');

const handleMenuSelect = (index: string) => {
  activeMenu.value = index;
};

onMounted(async () => {
  const res = await getDataset(props.datasetId);
  dataset.value = res.data;
});
</script>

<style lang="scss" scoped>
.kb-detail-layout {
  display: flex;
  gap: 12px;
  align-items: stretch;
  min-height: calc(100vh - 120px);
}

.layout-side {
  width: 220px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: flex;
  flex-direction: column;

  .side-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px;
    cursor: pointer;
    border-bottom: 1px solid var(--el-border-color-lighter);

    &:hover .side-back {
      color: var(--el-color-primary);
    }

    .side-back {
      font-size: 16px;
      color: var(--el-text-color-secondary);
    }

    .side-header-text {
      display: flex;
      flex-direction: column;
      min-width: 0;

      .side-kicker {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      .side-name {
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .side-menu {
    border-right: none;
    flex: 1;
  }

  .side-footer {
    padding: 12px 14px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

.layout-content {
  flex: 1;
  min-width: 0;
}
</style>
