<template>
  <div class="tool-call-item">
    <el-collapse>
      <el-collapse-item>
        <template #title>
          <span class="tool-title">
            <el-icon :color="record.success === false ? 'var(--el-color-danger)' : 'var(--el-color-primary)'">
              <SetUp />
            </el-icon>
            调用了工具 {{ record.name }}
            <el-tag v-if="record.success === false" size="small" type="danger" effect="plain">失败</el-tag>
            <el-tag v-else-if="record.success === true" size="small" type="success" effect="plain">成功</el-tag>
          </span>
        </template>
        <div class="tool-detail">
          <div class="tool-section">参数</div>
          <pre class="tool-pre">{{ pretty(record.args) }}</pre>
          <div class="tool-section">结果</div>
          <pre class="tool-pre">{{ record.result || '（空）' }}</pre>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import type { ToolCallRecordVO } from '@/api/ai/app/types';

defineProps<{ record: ToolCallRecordVO }>();

const pretty = (text: string): string => {
  if (!text) return '（空）';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};
</script>

<style lang="scss" scoped>
.tool-call-item {
  margin-bottom: 6px;

  .tool-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .tool-section {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    margin: 6px 0 4px;
  }

  .tool-pre {
    max-height: 200px;
    overflow: auto;
    margin: 0;
    padding: 8px;
    border-radius: 6px;
    background: var(--el-fill-color);
    font-family: var(--el-font-family-mono, Consolas, monospace);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }

  :deep(.el-collapse) {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  :deep(.el-collapse-item__header),
  :deep(.el-collapse-item__wrap) {
    border-bottom: none;
    background: transparent;
  }
}
</style>
