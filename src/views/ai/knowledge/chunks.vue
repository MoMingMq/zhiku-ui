<template>
  <div class="p-2 app-container ai-kb-chunks-page">
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <el-button icon="Back" link @click="emit('back')" />
            <span class="detail-title">{{ document.fileName }}</span>
            <el-tag :type="statusType(document.status)" size="small">{{ statusLabel(document.status) }}</el-tag>
            <span v-if="document.charCount" class="form-tip">{{ document.charCount }} 字符 · 共 {{ chunkList.length }} 段</span>
          </div>
          <div class="toolbar-actions">
            <el-input v-model="keyword" placeholder="搜索分段内容" clearable style="width: 220px">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </div>
        </div>
      </template>

      <div v-loading="loading" class="chunk-list">
        <el-empty v-if="!loading && filteredChunks.length === 0" :description="keyword ? '无匹配分段' : '该文档暂无分段'" :image-size="90" />
        <div v-for="chunk in filteredChunks" :key="chunk.chunkId" class="chunk-item" :class="{ 'is-disabled': chunk.disabled === '1' }">
          <div class="chunk-head">
            <span class="chunk-seq">#{{ chunk.seq }}</span>
            <span v-if="chunk.headingPath" class="chunk-path" :title="chunk.headingPath">
              <el-icon><Guide /></el-icon>{{ chunk.headingPath }}
            </span>
            <el-tag size="small" type="info">{{ chunk.strategyTag }}</el-tag>
            <el-tag size="small" type="info">{{ chunk.charCount }} 字</el-tag>
            <div class="chunk-actions">
              <el-tooltip :content="chunk.disabled === '1' ? '已禁用（不参与检索）' : '启用中（参与检索）'" placement="top">
                <el-switch
                  :model-value="chunk.disabled === '1'"
                  inline-prompt
                  active-text="禁用"
                  inactive-text="启用"
                  @change="(val: string | number | boolean) => handleChunkToggle(chunk, Boolean(val))"
                />
              </el-tooltip>
            </div>
          </div>
          <div class="chunk-content">{{ chunk.content }}</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { changeChunkDisabled, documentChunks } from '@/api/ai/knowledge';
import { KbChunkVO, KbDocumentVO, documentStatusMap } from '@/api/ai/knowledge/types';
import modal from '@/plugins/modal';

const props = defineProps<{ document: KbDocumentVO }>();
const emit = defineEmits<{ (e: 'back'): void }>();

const chunkList = ref<KbChunkVO[]>([]);
const loading = ref(false);
const keyword = ref('');

const statusLabel = (status: string) => documentStatusMap[status]?.label ?? status;
const statusType = (status: string) => (documentStatusMap[status]?.type ?? 'info') as 'info' | 'primary' | 'warning' | 'success' | 'danger';

const filteredChunks = computed(() => {
  if (!keyword.value.trim()) return chunkList.value;
  const kw = keyword.value.trim().toLowerCase();
  return chunkList.value.filter(c => c.content.toLowerCase().includes(kw) || (c.headingPath ?? '').toLowerCase().includes(kw));
});

const loadChunks = async () => {
  loading.value = true;
  try {
    const res = await documentChunks(props.document.documentId);
    chunkList.value = res.data ?? [];
  } finally {
    loading.value = false;
  }
};

/** 分段禁用切换（禁用后不参与检索） */
const handleChunkToggle = async (chunk: KbChunkVO, disabled: boolean) => {
  await changeChunkDisabled(chunk.chunkId, disabled);
  chunk.disabled = disabled ? '1' : '0';
  modal.msgSuccess(disabled ? '已禁用，该分段不再参与检索' : '已启用');
};

onMounted(() => {
  loadChunks();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-title {
  font-size: 15px;
  font-weight: 600;
}

.chunk-list {
  min-height: 240px;
}

.chunk-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px 14px;
  margin-bottom: 10px;
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  &.is-disabled {
    opacity: 0.55;
    background-color: var(--el-fill-color-lighter);
  }

  .chunk-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .chunk-seq {
      font-weight: 600;
      color: var(--el-color-primary);
    }

    .chunk-path {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      max-width: 380px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chunk-actions {
      margin-left: auto;
    }
  }

  .chunk-content {
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
  }
}
</style>
