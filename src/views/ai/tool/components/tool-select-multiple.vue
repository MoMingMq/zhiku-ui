<template>
  <div class="tool-select-multiple" :style="{ width: width || '100%' }">
    <el-select
      :model-value="modelValue"
      multiple
      filterable
      clearable
      collapse-tags
      collapse-tags-tooltip
      placeholder="选择应用可用的工具（仅启用态）"
      style="width: 100%"
      @update:model-value="handleChange"
    >
      <el-option v-for="tool in toolOptions" :key="tool.toolId" :label="tool.toolName" :value="tool.toolId">
        <div class="tool-option">
          <span>{{ tool.icon }} {{ tool.toolName }}</span>
          <span class="tool-option-desc">{{ tool.description }}</span>
        </div>
      </el-option>
    </el-select>
    <div v-if="selectedTools.length" class="selected-list">
      <div v-for="tool in selectedTools" :key="tool.toolId" class="selected-item">
        <span class="selected-name">{{ tool.icon }} {{ tool.toolName }}</span>
        <span class="selected-desc">{{ tool.description }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import api from '@/api/ai/tool';
import type { AiToolVO } from '@/api/ai/tool/types';

const props = defineProps<{
  /** 选中的工具 ID 数组（v-model） */
  modelValue: Array<number | string>;
  /** 容器宽度（默认 100%） */
  width?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: Array<number | string>] }>();

const toolOptions = ref<AiToolVO[]>([]);

const selectedTools = computed(() => toolOptions.value.filter(t => props.modelValue.includes(t.toolId)));

const handleChange = (value: Array<number | string>) => {
  emit('update:modelValue', value);
};

onMounted(async () => {
  const res = await api.listAiTool({ pageNum: 1, pageSize: 100, status: '0' });
  toolOptions.value = res.data?.rows ?? [];
});
</script>

<style lang="scss" scoped>
.tool-select-multiple {
  .tool-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    .tool-option-desc {
      max-width: 300px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .selected-list {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .selected-item {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 6px 10px;
      border: 1px solid var(--el-border-color-lighter);
      border-left: 3px solid var(--el-color-primary);
      border-radius: 6px;
      font-size: 12px;

      .selected-name {
        font-weight: 600;
        flex-shrink: 0;
      }

      .selected-desc {
        flex: 1;
        min-width: 0;
        color: var(--el-text-color-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}
</style>
