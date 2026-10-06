<template>
  <div class="citation-list">
    <el-divider content-position="left">
      <el-icon><Collection /></el-icon>
      引用来源（{{ citations.length }}）
    </el-divider>
    <div class="citation-items">
      <span v-for="(c, i) in citations" :key="c.chunkId" class="citation-tag" @click="$emit('inspect', c.chunkId)">
        <b>[{{ i + 1 }}]</b>
        {{ c.documentName }}
        <em v-if="c.score != null">{{ (c.score * 100).toFixed(0) }}%</em>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CitationVO } from '@/api/ai/app/types';

defineProps<{ citations: CitationVO[] }>();
defineEmits<{ inspect: [chunkId: number | string] }>();
</script>

<style lang="scss" scoped>
.citation-list {
  margin-top: 6px;

  .citation-items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .citation-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--el-fill-color);
    border: 1px solid var(--el-border-color-lighter);
    color: var(--el-text-color-regular);
    cursor: pointer;
    transition: all 0.2s;

    b {
      color: var(--el-color-primary);
      font-weight: 600;
    }

    em {
      font-style: normal;
      color: var(--el-text-color-secondary);
    }

    &:hover {
      border-color: var(--el-color-primary-light-5);
      color: var(--el-color-primary);
    }
  }

  :deep(.el-divider__text) {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
