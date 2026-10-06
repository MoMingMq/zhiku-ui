<template>
  <div class="app-settings">
    <!-- 左：设置表单 -->
    <div class="settings-form">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <h4 class="section-title">基本信息</h4>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="应用名称" prop="appName">
              <el-input v-model="form.appName" maxlength="100" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="图标">
              <el-popover placement="bottom-start" :width="440" trigger="click" :teleported="false">
                <template #reference>
                  <el-input :model-value="form.icon" placeholder="点击选择图标" readonly style="width: 220px">
                    <template #prepend>
                      <el-icon v-if="form.icon"><component :is="form.icon" /></el-icon>
                    </template>
                  </el-input>
                </template>
                <div class="icon-picker">
                  <el-input v-model="iconFilter" placeholder="搜索图标名" clearable size="small" />
                  <div class="icon-grid">
                    <el-tooltip v-for="name in filteredIcons" :key="name" :content="name" placement="top" :show-after="300">
                      <span class="icon-item" :class="{ 'is-active': form.icon === name }" @click="form.icon = name">
                        <el-icon :size="18"><component :is="name" /></el-icon>
                      </span>
                    </el-tooltip>
                  </div>
                </div>
              </el-popover>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>

        <h4 class="section-title">对话模型</h4>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="模型" prop="modelId">
              <el-select v-model="form.modelId" placeholder="选择对话模型" style="width: 100%" @change="handleModelChange">
                <el-option v-for="m in llmModels" :key="m.modelId" :label="`${m.modelName}（${m.modelCode}）`" :value="m.modelId" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item v-if="paramDefs.length" label="参数配置">
              <el-button icon="Operation" @click="paramsDialog.visible = true">模型参数配置</el-button>
              <span class="form-tip">{{ paramDefs.length }} 项参数（{{ paramDefs.map(p => p.label).join('、') }}）</span>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 模型参数对话框（对齐模型管理的参数设置形态） -->
        <el-dialog v-model="paramsDialog.visible" title="模型参数配置" width="640px" append-to-body>
          <el-form label-width="120px">
            <el-form-item v-for="p in paramDefs" :key="p.name" :label="p.label">
              <el-slider
                v-if="p.inputType === 'slider'"
                :model-value="Number(paramValues[p.name] ?? p.value)"
                :min="p.min ?? 0"
                :max="p.max ?? 1"
                :step="p.step ?? 0.1"
                style="width: 80%"
                @update:model-value="(v: number | undefined) => setParam(p.name, v)"
              />
              <el-input-number
                v-else-if="p.inputType === 'number'"
                :model-value="Number(paramValues[p.name] ?? p.value)"
                :min="p.min"
                :max="p.max"
                :step="p.step"
                @update:model-value="(v: number | undefined) => setParam(p.name, v)"
              />
              <el-switch v-else-if="p.inputType === 'switch'" :model-value="Boolean(paramValues[p.name] ?? p.value)" @update:model-value="(v: boolean) => setParam(p.name, v)" />
              <el-select
                v-else-if="p.inputType === 'select'"
                :model-value="String(paramValues[p.name] ?? p.value ?? '')"
                style="width: 180px"
                @update:model-value="(v: string) => setParam(p.name, v)"
              >
                <el-option v-for="o in p.options ?? []" :key="o" :label="o" :value="o" />
              </el-select>
              <el-input v-else :model-value="String(paramValues[p.name] ?? p.value ?? '')" style="width: 220px" @update:model-value="(v: string) => setParam(p.name, v)" />
            </el-form-item>
            <el-empty v-if="!paramDefs.length" description="该模型未定义参数" :image-size="60" />
          </el-form>
          <template #footer>
            <el-button type="primary" @click="paramsDialog.visible = false">完 成</el-button>
          </template>
        </el-dialog>

        <h4 class="section-title">对话类型</h4>
        <el-form-item label="类型">
          <el-select :model-value="form.chatType" style="width: 240px" @change="handleChatTypeChange">
            <el-option v-for="t in chatTypes" :key="t.type" :label="t.typeName" :value="t.type" />
          </el-select>
          <span class="form-tip">不同类型有不同的专属配置；切换将重置专属配置</span>
        </el-form-item>
        <!-- 专属配置区：按 configFields 动态渲染 -->
        <dynamic-config-fields ref="dynamicRef" :fields="activeTypeFields" />

        <h4 class="section-title">提示词与开场</h4>
        <el-form-item label="系统提示词">
          <el-input v-model="form.systemPrompt" type="textarea" :rows="5" placeholder="定义助手角色与回答规则" />
          <span class="form-tip">{knowledge_context} 由系统自动注入检索资料；建议保留"仅根据资料回答，无法回答就明说"</span>
          <el-button size="small" text type="primary" @click="restorePrompt">恢复默认模板</el-button>
        </el-form-item>
        <el-form-item label="开场白">
          <el-input v-model="form.prologue" type="textarea" :rows="2" placeholder="打开对话时的问候语（可选）" />
        </el-form-item>
        <el-form-item label="推荐问题">
          <el-input v-model="suggestedText" type="textarea" :rows="3" placeholder="每行一个问题，对话页展示为快捷按钮（可选）" />
        </el-form-item>
      </el-form>
      <div class="form-actions">
        <el-button type="primary" :loading="saving" @click="save">保 存</el-button>
      </div>
    </div>

    <!-- 右：调试对话面板 -->
    <div class="settings-debug">
      <div class="debug-title">调试对话（保存后生效）</div>
      <chat-panel ref="debugPanelRef" :app-id="app.appId" :prologue="form.prologue ?? ''" :suggested-questions="liveSuggested" />
    </div>
  </div>
</template>

<script setup lang="ts">
import api from '@/api/ai/app';
import { bindAppTools, unbindAppTools } from '@/api/ai/tool';
import type { AiAppForm, AiAppVO, AppConfigField, ChatTypeVO } from '@/api/ai/app/types';
import { getModelParams, listAiModel } from '@/api/ai/model';
import type { AiModelVO, ModelParamDef } from '@/api/ai/model/types';
import modal from '@/plugins/modal';
import ChatPanel from '@/views/ai/chat/components/chat-panel.vue';
import DynamicConfigFields from './components/dynamic-config-fields.vue';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

const props = defineProps<{ app: AiAppVO }>();
const emit = defineEmits<{ saved: [] }>();

const ICON_NAMES = Object.keys(ElementPlusIconsVue);
const formRef = ref<ElFormInstance>();
const dynamicRef = ref<InstanceType<typeof DynamicConfigFields>>();
const debugPanelRef = ref<InstanceType<typeof ChatPanel>>();
const saving = ref(false);
const llmModels = ref<AiModelVO[]>([]);
const chatTypes = ref<ChatTypeVO[]>([]);
const paramDefs = ref<ModelParamDef[]>([]);
const paramValues = ref<Record<string, unknown>>({});
const iconFilter = ref('');
const suggestedText = ref('');
const paramsDialog = reactive({ visible: false });

/** 推荐问题实时预览（textarea 按行拆，随输入联动右侧调试面板） */
const liveSuggested = computed(() =>
  suggestedText.value.split('\n').map(s => s.trim()).filter(Boolean)
);

const initFormData: AiAppForm = {
  appId: undefined,
  appName: '',
  description: '',
  icon: undefined,
  appType: 'simple',
  chatType: 'knowledge_qa',
  config: undefined,
  modelId: '',
  modelParams: undefined,
  systemPrompt: undefined,
  prologue: undefined,
  suggestedQuestions: undefined,
  status: '0'
};
const form = reactive<AiAppForm>({ ...initFormData });
const rules: FormRules = {
  appName: [{ required: true, message: '应用名称不能为空', trigger: 'blur' }],
  modelId: [{ required: true, message: '必须选择对话模型', trigger: 'change' }]
};

const filteredIcons = computed(() =>
  iconFilter.value ? ICON_NAMES.filter(n => n.toLowerCase().includes(iconFilter.value.toLowerCase())) : ICON_NAMES
);

const activeTypeFields = computed<AppConfigField[]>(
  () => chatTypes.value.find(t => t.type === form.chatType)?.configFields ?? []
);

const setParam = (name: string, value: unknown) => {
  paramValues.value[name] = value;
};

const handleModelChange = async (modelId: number | string) => {
  paramDefs.value = [];
  paramValues.value = {};
  const res = await getModelParams(modelId);
  paramDefs.value = res.data ?? [];
  paramDefs.value.forEach(p => (paramValues.value[p.name] = p.value));
};

const handleChatTypeChange = async (type: string) => {
  const target = chatTypes.value.find(t => t.type === type);
  if (target && dynamicRef.value) {
    dynamicRef.value.load(JSON.parse(target.defaultConfig), []);
    modal.msgSuccess(`已切换为${target.typeName}，专属配置已重置`);
  }
};

const restorePrompt = () => {
  form.systemPrompt = '你是企业知识库助手。仅根据提供的【参考资料】回答用户问题；资料中没有答案时明确说明无法回答，不要编造。';
};

const save = () => {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    saving.value = true;
    try {
      const dynamic = dynamicRef.value;
      const config = dynamic ? dynamic.buildConfig() : {};
      const suggested = suggestedText.value.split('\n').map(s => s.trim()).filter(Boolean);
      await api.updateAiApp({
        ...form,
        config: JSON.stringify(config),
        modelParams: paramDefs.value.length ? JSON.stringify(paramValues.value) : undefined,
        suggestedQuestions: suggested.length ? JSON.stringify(suggested) : undefined
      } as AiAppForm);
      // 工具挂载同步（M3 挂载接口）
      const prevTools = props.app.toolIds ?? [];
      const nextTools = dynamic?.modelValue.tools ?? [];
      const toBind = nextTools.filter(id => !prevTools.includes(id));
      const toUnbind = prevTools.filter(id => !nextTools.includes(id));
      if (toBind.length) await bindAppTools(props.app.appId, toBind);
      if (toUnbind.length) await unbindAppTools(props.app.appId, toUnbind);
      modal.msgSuccess('保存成功');
      emit('saved');
    } finally {
      saving.value = false;
    }
  });
};

const load = async () => {
  Object.assign(form, {
    appId: props.app.appId,
    appName: props.app.appName,
    description: props.app.description ?? '',
    icon: props.app.icon ?? undefined,
    appType: props.app.appType,
    chatType: props.app.chatType ?? 'knowledge_qa',
    modelId: props.app.modelId,
    systemPrompt: props.app.systemPrompt ?? undefined,
    prologue: props.app.prologue ?? undefined,
    status: props.app.status
  });
  try {
    suggestedText.value = (JSON.parse(props.app.suggestedQuestions ?? '[]') as string[]).join('\n');
  } catch {
    suggestedText.value = '';
  }
  if (props.app.modelParams) {
    try {
      paramValues.value = JSON.parse(props.app.modelParams);
    } catch {
      paramValues.value = {};
    }
  }
  if (props.app.modelId) {
    const res = await getModelParams(props.app.modelId);
    paramDefs.value = res.data ?? [];
    paramDefs.value.forEach(p => {
      if (paramValues.value[p.name] === undefined) {
        paramValues.value[p.name] = p.value;
      }
    });
  }
  nextTick(() => {
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(props.app.config ?? '{}');
    } catch {
      config = {};
    }
    dynamicRef.value?.load(config, props.app.toolIds ?? []);
  });
};

watch(
  () => props.app,
  () => load(),
  { immediate: true }
);

onMounted(async () => {
  const [modelsRes, typesRes] = await Promise.all([
    listAiModel({ pageNum: 1, pageSize: 100, modelType: '1' }),
    api.listAppChatTypes()
  ]);
  llmModels.value = modelsRes.data?.rows ?? [];
  chatTypes.value = typesRes.data ?? [];
});
</script>

<style lang="scss" scoped>
.app-settings {
  display: flex;
  height: 100%;
  min-height: 0;

  .settings-form {
    flex: 1.4;
    min-width: 0;
    overflow-y: auto;
    padding: 16px;

    .section-title {
      margin: 8px 0 16px;
      font-size: 14px;
      color: var(--el-text-color-primary);
      border-left: 3px solid var(--el-color-primary);
      padding-left: 8px;
    }

    .form-tip {
      display: block;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .form-actions {
      padding: 8px 0 16px 110px;
    }
  }

  .settings-debug {
    flex: 1;
    min-width: 0;
    border-left: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;

    .debug-title {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    > :deep(.chat-panel) {
      flex: 1;
      min-height: 0;
    }
  }
}

.icon-picker {
  .icon-grid {
    margin-top: 8px;
    max-height: 240px;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 4px;

    .icon-item {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 7px 0;
      border-radius: 6px;
      cursor: pointer;
      color: var(--el-text-color-regular);
      border: 1px solid transparent;

      &:hover {
        background: var(--el-fill-color-light);
      }

      &.is-active {
        border-color: var(--el-color-primary);
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }
    }
  }
}
</style>
