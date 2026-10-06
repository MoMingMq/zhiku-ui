<template>
  <el-dialog v-model="visible" :title="`试运行：${toolName}`" width="640px" append-to-body destroy-on-close>
    <el-form label-width="110px">
      <el-form-item v-if="paramItems.length === 0" label="参数">
        <span class="form-tip">本工具未定义入参，直接执行</span>
      </el-form-item>
      <el-form-item
        v-for="item in paramItems"
        :key="item.name"
        :label="item.name"
        :required="item.required"
      >
        <el-switch v-if="item.type === 'boolean'" v-model="paramValues[item.name]" />
        <el-input-number v-else-if="item.type === 'number' || item.type === 'integer'" v-model="paramValues[item.name]" style="width: 200px" />
        <el-input
          v-else-if="item.type === 'object' || item.type === 'array'"
          v-model="paramValues[item.name]"
          type="textarea"
          :rows="3"
          :placeholder="`填写 JSON（${item.type} 类型）`"
          class="mono"
        />
        <el-input v-else v-model="paramValues[item.name]" :placeholder="item.description || '参数值'" />
        <span v-if="item.description" class="form-tip">{{ item.description }}</span>
      </el-form-item>
    </el-form>

    <el-divider content-position="left">执行结果</el-divider>
    <template v-if="result">
      <div class="result-meta">
        <el-tag :type="result.success ? 'success' : 'danger'" size="small">{{ result.success ? '成功' : '失败' }}</el-tag>
        <el-tag v-if="result.httpStatus" size="small" effect="plain">HTTP {{ result.httpStatus }}</el-tag>
        <span class="result-duration">{{ result.durationMs }} ms</span>
      </div>
      <el-alert v-if="!result.success && result.errorMsg" :title="result.errorMsg" type="error" :closable="false" show-icon class="result-error" />
      <pre v-if="result.body" class="result-body">{{ formattedBody }}</pre>
    </template>
    <el-empty v-else description="填写参数后点击执行" :image-size="60" />
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" :loading="executing" @click="handleExec">执 行</el-button>
        <el-button @click="visible = false">关 闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import api from '@/api/ai/tool';
import type { AiToolVO, ToolExecResultVO } from '@/api/ai/tool/types';
import modal from '@/plugins/modal';

/** 从 paramSchema properties 派生的表单项 */
interface ParamItem {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

const visible = ref(false);
const executing = ref(false);
const toolName = ref('');
const toolId = ref<number | string>();
const paramItems = ref<ParamItem[]>([]);
const paramValues = ref<Record<string, unknown>>({});
const result = ref<ToolExecResultVO | null>(null);

const formattedBody = computed(() => {
  const body = result.value?.body ?? '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
});

const open = (row: AiToolVO) => {
  toolId.value = row.toolId;
  toolName.value = row.toolName;
  result.value = null;
  paramItems.value = [];
  paramValues.value = {};
  // 解析入参 Schema 的顶级 properties（嵌套类型降级 JSON 文本框）
  if (row.paramSchema) {
    try {
      const schema = JSON.parse(row.paramSchema) as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
      Object.entries(schema.properties ?? {}).forEach(([name, def]) => {
        const type = typeof def.type === 'string' ? def.type : 'string';
        paramItems.value.push({
          name,
          type,
          required: Array.isArray(schema.required) && schema.required.includes(name),
          description: typeof def.description === 'string' ? def.description : ''
        });
        paramValues.value[name] = type === 'boolean' ? false : type === 'number' || type === 'integer' ? undefined : '';
      });
    } catch {
      // Schema 异常按无参处理，执行后端会给出可读错误
    }
  }
  visible.value = true;
};

/** 组装参数：object/array 文本框做 JSON 解析，number/integer 转 Number */
const buildParams = (): Record<string, unknown> | null => {
  const params: Record<string, unknown> = {};
  for (const item of paramItems.value) {
    const raw = paramValues.value[item.name];
    if (raw === undefined || raw === null || raw === '') {
      if (item.required) {
        modal.msgError(`缺少必填参数: ${item.name}`);
        return null;
      }
      continue;
    }
    if (item.type === 'object' || item.type === 'array') {
      try {
        params[item.name] = JSON.parse(raw as string);
      } catch {
        modal.msgError(`参数 ${item.name} 不是合法 JSON`);
        return null;
      }
    } else if (item.type === 'number' || item.type === 'integer') {
      params[item.name] = Number(raw);
    } else {
      params[item.name] = raw;
    }
  }
  return params;
};

const handleExec = async () => {
  const params = buildParams();
  if (params === null) return;
  executing.value = true;
  try {
    const res = await api.testAiTool(toolId.value!, params);
    result.value = res.data;
  } finally {
    executing.value = false;
  }
};

defineExpose({ open });
</script>

<style lang="scss" scoped>
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  .result-duration {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.result-error {
  margin-bottom: 10px;
}

.result-body {
  max-height: 300px;
  overflow: auto;
  margin: 0;
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.mono {
  :deep(textarea) {
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
  }
}
</style>
