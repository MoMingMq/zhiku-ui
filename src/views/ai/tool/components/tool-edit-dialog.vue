<template>
  <el-dialog v-model="visible" :title="form.toolId ? '编辑工具' : '创建工具'" width="1000px" append-to-body destroy-on-close>
    <el-form ref="toolFormRef" :model="form" :rules="rules" label-width="110px">
      <!-- ==================== 基本信息 ==================== -->
      <h4 class="section-title">基本信息</h4>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="工具名" prop="toolName">
            <el-input v-model="form.toolName" placeholder="字母开头，可含数字、下划线、连字符" maxlength="64" show-word-limit />
            <span class="form-tip">即 Function Calling 工具名，对话中模型的调用标识</span>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="图标" prop="icon">
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
                  <el-tooltip v-for="name in filteredIconNames" :key="name" :content="name" placement="top" :show-after="300">
                    <span class="icon-item" :class="{ 'is-active': form.icon === name }" @click="form.icon = name">
                      <el-icon :size="18"><component :is="name" /></el-icon>
                    </span>
                  </el-tooltip>
                  <div v-if="filteredIconNames.length === 0" class="icon-empty">无匹配图标</div>
                </div>
              </div>
            </el-popover>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="说明工具做什么、什么时候用（给模型看的语义说明）"
          maxlength="500"
          show-word-limit
        />
        <span class="form-tip form-tip-warning">描述质量决定模型调用准确度，请写清楚功能与适用场景</span>
      </el-form-item>

      <!-- ==================== 请求定义 ==================== -->
      <h4 class="section-title">请求定义</h4>
      <el-row :gutter="16">
        <el-col :span="6">
          <el-form-item label="请求方式" prop="method">
            <el-select v-model="form.method" style="width: 100%">
              <el-option v-for="m in ['GET', 'POST', 'PUT', 'DELETE']" :key="m" :label="m" :value="m" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="18">
          <el-form-item label="URL" prop="urlTemplate">
            <div class="url-row">
              <el-input ref="urlInputRef" v-model="form.urlTemplate" placeholder="https://api.example.com/v1/{{path}}（主机部分不可用参数）" maxlength="1000" />
              <el-dropdown v-if="paramRows.length" trigger="click" @command="insertUrlParam">
                <el-button>插入参数</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="p in paramRows" :key="p.name" :command="p.name">{{ p.name }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <span class="form-tip">{{ }} 占位仅允许出现在路径与查询参数中</span>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="请求头">
        <div class="kv-table">
          <div v-for="(row, idx) in headerRows" :key="idx" class="kv-row">
            <el-input v-model="row.key" placeholder="名称（如 Content-Type）" style="flex: 2" />
            <el-input v-model="row.value" placeholder="值，支持 {{参数}} 占位" style="flex: 3" />
            <el-button icon="Delete" circle type="danger" plain @click="headerRows.splice(idx, 1)" />
          </div>
          <el-button icon="Plus" text type="primary" @click="headerRows.push({ key: '', value: '' })">添加请求头</el-button>
        </div>
      </el-form-item>

      <el-form-item label="查询参数">
        <div class="kv-table">
          <div v-for="(row, idx) in queryRows" :key="idx" class="kv-row">
            <el-input v-model="row.key" placeholder="名称（如 city）" style="flex: 2" />
            <el-input v-model="row.value" placeholder="值，支持 {{参数}} 占位" style="flex: 3" />
            <el-button icon="Delete" circle type="danger" plain @click="queryRows.splice(idx, 1)" />
          </div>
          <el-button icon="Plus" text type="primary" @click="queryRows.push({ key: '', value: '' })">添加查询参数</el-button>
        </div>
      </el-form-item>

      <el-form-item label="请求体">
        <div class="body-wrap">
          <div class="body-toolbar">
            <el-dropdown v-if="paramRows.length" trigger="click" @command="insertBodyParam">
              <el-button size="small">插入参数</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="p in paramRows" :key="p.name" :command="p.name">{{ p.name }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <span class="form-tip">JSON 体的参数值会自动做 JSON 转义；form 体会做 URL 编码</span>
          </div>
          <el-input ref="bodyInputRef" v-model="form.bodyTemplate" type="textarea" :rows="6" placeholder='如 {"text": "{{msg}}"}，可留空' />
        </div>
      </el-form-item>

      <!-- ==================== 入参 Schema ==================== -->
      <h4 class="section-title">入参 Schema（模型 Function Calling 的参数定义）</h4>
      <el-form-item label="编辑方式">
        <el-radio-group v-model="schemaMode" @change="handleSchemaModeChange">
          <el-radio-button value="simple">简易（参数行）</el-radio-button>
          <el-radio-button value="json">JSON 模式</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <template v-if="schemaMode === 'simple'">
        <el-form-item label="参数列表">
          <div class="schema-table">
            <div class="schema-head schema-row">
              <span>参数名</span><span>类型</span><span>必填</span><span>描述（给模型）</span><span>示例值</span><span />
            </div>
            <div v-for="(row, idx) in paramRows" :key="idx" class="schema-row">
              <el-input v-model="row.name" placeholder="如 city" />
              <el-select v-model="row.type">
                <el-option v-for="t in PARAM_TYPES" :key="t" :label="t" :value="t" />
              </el-select>
              <el-switch v-model="row.required" />
              <el-input v-model="row.description" placeholder="参数含义" />
              <el-input v-model="row.example" placeholder="示例" />
              <el-button icon="Delete" circle type="danger" plain @click="paramRows.splice(idx, 1)" />
            </div>
            <el-button icon="Plus" text type="primary" @click="paramRows.push({ name: '', type: 'string', required: true, description: '', example: '' })">
              添加参数
            </el-button>
          </div>
        </el-form-item>
      </template>
      <template v-else>
        <el-form-item label="JSON Schema">
          <el-input
            v-model="paramSchemaJson"
            type="textarea"
            :rows="10"
            placeholder='{"type":"object","properties":{...},"required":[...]}' class="mono"
          />
          <span class="form-tip">根必须为 object（Function Calling parameters 规范）；嵌套结构请在此模式维护</span>
        </el-form-item>
      </template>

      <!-- ==================== 鉴权与安全 ==================== -->
      <h4 class="section-title">鉴权与安全</h4>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="鉴权方式" prop="authType">
            <el-radio-group v-model="form.authType">
              <el-radio value="0">无</el-radio>
              <el-radio value="1">Bearer</el-radio>
              <el-radio value="2">自定义头</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col v-if="form.authType === '2'" :span="8">
          <el-form-item label="鉴权头名" prop="authKey">
            <el-input v-model="form.authKey" placeholder="如 X-Api-Key" maxlength="64" />
          </el-form-item>
        </el-col>
        <el-col v-if="form.authType !== '0'" :span="8">
          <el-form-item label="鉴权凭据">
            <el-input v-model="form.authValue" type="password" show-password autocomplete="new-password" placeholder="编辑时留空表示不修改" maxlength="512" />
            <el-tag v-if="authConfigured" size="small" type="info">已配置</el-tag>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="允许内网">
            <el-switch v-model="form.allowIntranet" active-value="1" inactive-value="0" />
            <span class="form-tip">开启后本工具可访问内网/环回地址</span>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="超时（秒）">
            <el-input-number v-model="form.timeoutSeconds" :min="1" :max="60" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="状态">
            <el-radio-group v-model="form.status">
              <el-radio value="0">启用</el-radio>
              <el-radio value="1">停用</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-alert
        v-if="form.allowIntranet === '1'"
        title="内网白名单已开启：请确认目标服务可信，避免模型间接访问敏感内网资源"
        type="warning"
        :closable="false"
        show-icon
      />
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" :loading="submitting" @click="submitForm">确 定</el-button>
        <el-button @click="visible = false">取 消</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import api from '@/api/ai/tool';
import type { AiToolForm, AiToolVO } from '@/api/ai/tool/types';
import modal from '@/plugins/modal';
import { to } from 'await-to-js';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

/** 简易视图的参数行（JSON Schema 扁平子集的友好视图） */
interface ParamRow {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean';
  required: boolean;
  description: string;
  example: string;
}

interface KeyValueRow {
  key: string;
  value: string;
}

const PARAM_TYPES = ['string', 'number', 'integer', 'boolean'] as const;

/** Element Plus 图标名清单（svgicon.ts 已全局注册为组件，component :is 直接可用） */
const ICON_NAMES = Object.keys(ElementPlusIconsVue);

const emit = defineEmits<{ reload: [] }>();

const visible = ref(false);
const submitting = ref(false);
const authConfigured = ref(false);
const toolFormRef = ref<ElFormInstance>();
const urlInputRef = ref();
const bodyInputRef = ref();

const initFormData: AiToolForm = {
  toolId: undefined,
  toolName: '',
  description: '',
  icon: undefined,
  method: 'GET',
  urlTemplate: '',
  headers: undefined,
  queryParams: undefined,
  bodyTemplate: undefined,
  paramSchema: undefined,
  authType: '0',
  authKey: undefined,
  authValue: undefined,
  allowIntranet: '0',
  timeoutSeconds: 10,
  status: '0'
};

const form = reactive<AiToolForm>({ ...initFormData });
const rules: FormRules = {
  toolName: [
    { required: true, message: '工具名不能为空', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/, message: '字母开头，可含数字、下划线、连字符', trigger: 'blur' }
  ],
  description: [{ required: true, message: '描述不能为空（描述质量决定模型调用准确度）', trigger: 'blur' }],
  method: [{ required: true, message: '请求方式不能为空', trigger: 'change' }],
  urlTemplate: [
    { required: true, message: 'URL 不能为空', trigger: 'blur' },
    { pattern: /^https?:\/\//, message: '必须以 http:// 或 https:// 开头', trigger: 'blur' }
  ],
  authKey: [{ required: true, message: '自定义头鉴权必须填写头名称', trigger: 'blur' }]
};

/** Schema 双视图状态：切换时单向转换（json→simple 含高级结构需确认丢弃） */
const schemaMode = ref<'simple' | 'json'>('simple');
const paramRows = ref<ParamRow[]>([]);
const paramSchemaJson = ref('{\n  "type": "object",\n  "properties": {}\n}');
const headerRows = ref<KeyValueRow[]>([]);
const queryRows = ref<KeyValueRow[]>([]);
const iconFilter = ref('');

const filteredIconNames = computed(() =>
  iconFilter.value ? ICON_NAMES.filter(n => n.toLowerCase().includes(iconFilter.value.toLowerCase())) : ICON_NAMES
);

/** 参数行 → JSON Schema（提交与切 JSON 视图共用） */
const rowsToSchema = (rows: ParamRow[]): string => {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  rows.filter(r => r.name).forEach(r => {
    const prop: Record<string, unknown> = { type: r.type };
    if (r.description) prop.description = r.description;
    if (r.example) prop.example = r.example;
    properties[r.name] = prop;
    if (r.required) required.push(r.name);
  });
  const schema: Record<string, unknown> = { type: 'object', properties };
  if (required.length) schema.required = required;
  return JSON.stringify(schema, null, 2);
};

/** JSON Schema → 参数行：仅接受扁平 properties；含嵌套/复杂结构返回 null */
const schemaToRows = (schemaStr: string): ParamRow[] | null => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(schemaStr);
  } catch {
    return null;
  }
  if (parsed.type !== 'object' || !parsed.properties || typeof parsed.properties !== 'object') {
    return null;
  }
  const rows: ParamRow[] = [];
  for (const [name, def] of Object.entries(parsed.properties as Record<string, Record<string, unknown>>)) {
    if (!def || typeof def.type !== 'string' || !PARAM_TYPES.includes(def.type as ParamRow['type'])) {
      return null;
    }
    rows.push({
      name,
      type: def.type as ParamRow['type'],
      required: Array.isArray(parsed.required) && (parsed.required as string[]).includes(name),
      description: typeof def.description === 'string' ? def.description : '',
      example: typeof def.example === 'string' ? def.example : ''
    });
  }
  return rows;
};

const handleSchemaModeChange = async (mode: string) => {
  if (mode === 'json') {
    paramSchemaJson.value = rowsToSchema(paramRows.value);
  } else {
    const rows = schemaToRows(paramSchemaJson.value);
    if (rows === null) {
      const [err] = await to(modal.confirm('当前 Schema 含高级结构（嵌套/非法 JSON），切回简易视图将丢弃这些内容，是否继续？') as any);
      if (err) {
        schemaMode.value = 'json';
        return;
      }
      paramRows.value = [];
    } else {
      paramRows.value = rows;
    }
  }
};

/** 在光标处插入 {{name}}（el-input 内部原生 input 的 setRangeText） */
const insertToken = (inputRef: unknown, token: string) => {
  const comp = inputRef as { $el?: HTMLElement } | undefined;
  const input = comp?.$el?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.setRangeText(token, start, end);
  input.dispatchEvent(new Event('input'));
  input.focus();
};

const insertUrlParam = (name: string) => insertToken(urlInputRef.value, `{{${name}}}`);
const insertBodyParam = (name: string) => insertToken(bodyInputRef.value, `{{${name}}}`);

const serializeKv = (rows: KeyValueRow[]): string | undefined => {
  const pairs = rows.filter(r => r.key && r.key.trim());
  return pairs.length ? JSON.stringify(pairs.map(r => ({ key: r.key.trim(), value: r.value ?? '' }))) : undefined;
};

const parseKv = (json: string | null | undefined): KeyValueRow[] => {
  if (!json) return [];
  try {
    const pairs = JSON.parse(json) as Array<{ key: string; value: string }>;
    return Array.isArray(pairs) ? pairs.map(p => ({ key: p.key ?? '', value: p.value ?? '' })) : [];
  } catch {
    return [];
  }
};

/** 打开对话框（传 row 为编辑，不传为新建） */
const open = async (row?: AiToolVO) => {
  Object.assign(form, { ...initFormData });
  schemaMode.value = 'simple';
  paramRows.value = [];
  headerRows.value = [];
  queryRows.value = [];
  paramSchemaJson.value = '{\n  "type": "object",\n  "properties": {}\n}';
  authConfigured.value = false;
  visible.value = true;
  if (row) {
    const res = await api.getAiTool(row.toolId);
    const detail = res.data;
    Object.assign(form, {
      toolId: detail.toolId,
      toolName: detail.toolName,
      description: detail.description,
      icon: detail.icon ?? undefined,
      method: detail.method,
      urlTemplate: detail.urlTemplate,
      bodyTemplate: detail.bodyTemplate ?? undefined,
      authType: detail.authType,
      authKey: detail.authKey ?? undefined,
      authValue: undefined,
      allowIntranet: detail.allowIntranet,
      timeoutSeconds: detail.timeoutSeconds,
      status: detail.status
    });
    authConfigured.value = detail.authValueSet;
    headerRows.value = parseKv(detail.headers);
    queryRows.value = parseKv(detail.queryParams);
    // 回填 Schema：扁平结构走简易视图，嵌套/复杂自动落 JSON 视图
    if (detail.paramSchema) {
      const rows = schemaToRows(detail.paramSchema);
      if (rows === null) {
        schemaMode.value = 'json';
        paramSchemaJson.value = detail.paramSchema;
      } else {
        paramRows.value = rows;
      }
    }
  }
};

const submitForm = () => {
  toolFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    let paramSchema: string | undefined;
    if (schemaMode.value === 'json') {
      try {
        const parsed = JSON.parse(paramSchemaJson.value);
        if (parsed?.type !== 'object' || typeof parsed.properties !== 'object') {
          modal.msgError('JSON Schema 根必须为 object 且含 properties');
          return;
        }
      } catch {
        modal.msgError('JSON Schema 不是合法 JSON');
        return;
      }
      paramSchema = paramSchemaJson.value;
    } else {
      const unnamed = paramRows.value.filter(r => !r.name).length;
      if (unnamed > 0) {
        modal.msgError('存在未命名参数行，请填写参数名或删除该行');
        return;
      }
      const schema = rowsToSchema(paramRows.value);
      paramSchema = JSON.parse(schema).properties && Object.keys(JSON.parse(schema).properties).length ? schema : undefined;
    }
    submitting.value = true;
    try {
      const submitData: AiToolForm = {
        ...form,
        headers: serializeKv(headerRows.value),
        queryParams: serializeKv(queryRows.value),
        paramSchema,
        authValue: form.authValue || ''
      };
      form.toolId ? await api.updateAiTool(submitData) : await api.addAiTool(submitData);
      modal.msgSuccess(form.toolId ? '修改成功' : '创建成功');
      visible.value = false;
      emit('reload');
    } finally {
      submitting.value = false;
    }
  });
};

defineExpose({ open });
</script>

<style lang="scss" scoped>
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
  line-height: 1.5;

  &.form-tip-warning {
    color: var(--el-color-warning);
  }
}

.url-row {
  display: flex;
  gap: 8px;
  width: 100%;

  .el-input {
    flex: 1;
  }
}

.kv-table,
.schema-table {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.schema-row {
  display: grid;
  grid-template-columns: 1.2fr 0.9fr 0.5fr 1.6fr 1fr 32px;
  gap: 8px;
  align-items: center;

  &.schema-head {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
}

.body-wrap {
  width: 100%;

  .body-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
  }
}

.icon-picker {
  .icon-grid {
    margin-top: 8px;
    max-height: 260px;
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

    .icon-empty {
      grid-column: 1 / -1;
      text-align: center;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      padding: 16px 0;
    }
  }
}

.mono {
  :deep(textarea) {
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
  }
}
</style>
