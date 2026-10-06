<template>
  <el-dialog v-model="visible" title="引用原文（含上下文）" width="640px" append-to-body>
    <div v-loading="loading" class="chunk-context">
      <template v-if="context">
        <div class="chunk-meta">
          <el-tag size="small" effect="plain">{{ context.headingPath || '（无标题路径）' }}</el-tag>
          <el-tag size="small" type="info" effect="plain">#{{ context.seq }}</el-tag>
        </div>
        <div v-if="context.prevContent" class="neighbor">
          <div class="neighbor-label">上一分块</div>
          <div class="neighbor-text">{{ context.prevContent }}</div>
        </div>
        <div class="current">
          <div class="neighbor-label current-label">命中的分块</div>
          <div class="neighbor-text current-text">{{ context.content }}</div>
        </div>
        <div v-if="context.nextContent" class="neighbor">
          <div class="neighbor-label">下一分块</div>
          <div class="neighbor-text">{{ context.nextContent }}</div>
        </div>
      </template>
      <el-empty v-else-if="!loading" description="分块不存在" :image-size="60" />
    </div>
    <template #footer>
      <el-button @click="visible = false">关 闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { getChunkContext } from '@/api/ai/app';

interface ChunkContextData {
  headingPath: string | null;
  seq: number;
  prevContent: string | null;
  content: string | null;
  nextContent: string | null;
}

const visible = ref(false);
const loading = ref(false);
const context = ref<ChunkContextData | null>(null);

const open = async (chunkId: number | string) => {
  visible.value = true;
  loading.value = true;
  context.value = null;
  try {
    const res = await getChunkContext(chunkId);
    context.value = res.data;
  } finally {
    loading.value = false;
  }
};

defineExpose({ open });
</script>

<style lang="scss" scoped>
.chunk-context {
  min-height: 120px;

  .chunk-meta {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .neighbor-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
  }

  .neighbor-text {
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    margin-bottom: 12px;
    max-height: 180px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .current-label {
    color: var(--el-color-primary);
  }

  .current-text {
    color: var(--el-text-color-primary);
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-7);
  }
}
</style>
