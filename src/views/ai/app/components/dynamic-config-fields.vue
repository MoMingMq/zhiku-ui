<template>
  <div v-if="fields.length" class="dynamic-config-fields">
    <el-form-item v-for="field in fields" :key="field.name" :label="field.label" :required="field.required">
      <!-- 知识库关联（按钮 + 对话框多选 + 已选卡片） -->
      <kb-config-dialog
        v-if="field.component === 'kb-config' || field.component === 'kb-multi'"
        :model-value="modelValue.kbIds"
        @update:model-value="(v: Array<number | string>) => emitKbChange(v)"
      />
      <!-- 工具多选（复用 M3 组件交互形态：多选下拉） -->
      <el-select
        v-else-if="field.component === 'tool-multi'"
        v-model="modelValue.tools"
        multiple
        filterable
        clearable
        placeholder="选择应用可用的工具"
        style="width: 100%"
      >
        <el-option v-for="t in toolOptions" :key="t.toolId" :label="t.toolName" :value="t.toolId">
          <span>{{ t.icon }} {{ t.toolName }}</span>
          <span class="tool-desc">{{ t.description }}</span>
        </el-option>
      </el-select>
      <!-- 开关 -->
      <el-switch v-else-if="field.component === 'switch'" v-model="modelValue.bools[field.name]" />
      <!-- 数字 -->
      <el-input-number
        v-else-if="field.component === 'number'"
        v-model="modelValue.numbers[field.name]"
        :min="field.min ?? 1"
        :max="field.max ?? 999"
      />
      <!-- 单选 -->
      <el-select v-else-if="field.component === 'select'" v-model="modelValue.strings[field.name]" style="width: 220px">
        <el-option v-for="o in field.options ?? []" :key="o" :label="o" :value="o" />
      </el-select>
      <!-- 文本 -->
      <el-input v-else v-model="modelValue.strings[field.name]" style="width: 320px" />
      <span v-if="field.description" class="field-tip">{{ field.description }}</span>
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import type { AppConfigField } from '@/api/ai/app/types';
import KbConfigDialog from './kb-config-dialog.vue';
import { listAiTool } from '@/api/ai/tool';
import type { AiToolVO } from '@/api/ai/tool/types';

const props = defineProps<{ fields: AppConfigField[] }>();

/** 动态配置承载（三仓分类便于 v-model 绑定；组装回 config JSON 由父层完成） */
const modelValue = reactive({
  kbIds: [] as Array<number | string>,
  tools: [] as Array<number | string>,
  bools: {} as Record<string, boolean>,
  numbers: {} as Record<string, number | undefined>,
  strings: {} as Record<string, string>
});
const emit = defineEmits<{ kbChange: [kbIds: Array<number | string>] }>();

const toolOptions = ref<AiToolVO[]>([]);

/** 从 config JSON 初始化各仓 */
const load = (config: Record<string, unknown>, tools: Array<number | string>) => {
  modelValue.kbIds = (config.kbIds as Array<number | string>) ?? [];
  modelValue.tools = tools ?? [];
  for (const field of props.fields) {
    const value = config[field.name];
    if (field.component === 'switch') {
      modelValue.bools[field.name] = Boolean(value ?? field.defaultValue ?? false);
    } else if (field.component === 'number') {
      modelValue.numbers[field.name] = (value as number) ?? (field.defaultValue as number);
    } else {
      modelValue.strings[field.name] = (value as string) ?? (field.defaultValue as string) ?? '';
    }
  }
};

/** 组装回 config JSON（kbIds/tools 由父层另行同步关系表） */
const buildConfig = (): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const field of props.fields) {
    if (field.component === 'kb-multi') {
      result[field.name] = modelValue.kbIds;
    } else if (field.component === 'switch') {
      result[field.name] = modelValue.bools[field.name];
    } else if (field.component === 'number') {
      result[field.name] = modelValue.numbers[field.name];
    } else {
      result[field.name] = modelValue.strings[field.name];
    }
  }
  return result;
};

const emitKbChange = (v: Array<number | string>) => {
  modelValue.kbIds = v;
  emit('kbChange', v);
};

onMounted(async () => {
  const toolRes = await listAiTool({ pageNum: 1, pageSize: 100, status: '0' });
  toolOptions.value = toolRes.data?.rows ?? [];
});

defineExpose({ modelValue, load, buildConfig });
</script>

<style lang="scss" scoped>
.dynamic-config-fields {
  .field-tip {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .tool-desc {
    float: right;
    max-width: 300px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
