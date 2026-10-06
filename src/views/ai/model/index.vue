<template>
  <div class="p-2 app-container ai-model-page">
    <!-- 搜索卡片 -->
    <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
      <template #header>
        <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
          <div>
            <span class="panel-kicker">Search Filters</span>
            <h3>筛选条件</h3>
          </div>
        </div>
      </template>
      <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
        <el-form-item label="模型名称" prop="modelName">
          <el-input v-model="queryParams.modelName" placeholder="请输入模型名称" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="模型类型" prop="modelType">
          <el-select v-model="queryParams.modelType" placeholder="模型类型" clearable style="width: 160px">
            <el-option v-for="dict in ai_model_type" :key="dict.value" :label="dict.label" :value="dict.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="queryParams.status" placeholder="状态" clearable style="width: 140px">
            <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格卡片 -->
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Model Config</span>
            <h3>模型列表</h3>
            <p>共 {{ total }} 条记录。接入 OpenAI 兼容端点（DeepSeek / 通义兼容 / Ollama 等）后可被应用与知识库引用。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['ai:model:add']" type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
            <el-button v-hasPermi="['ai:model:edit']" type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">
              修改
            </el-button>
            <el-button v-hasPermi="['ai:model:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">
              删除
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>
      <el-table v-loading="loading" border class="data-table" :data="modelList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="模型名称" align="center" prop="modelName" :show-overflow-tooltip="true" min-width="120" />
        <el-table-column label="类型" align="center" prop="modelType" width="110">
          <template #default="scope">
            <dict-tag :options="ai_model_type" :value="scope.row.modelType" />
          </template>
        </el-table-column>
        <el-table-column label="模型标识" align="center" prop="modelCode" :show-overflow-tooltip="true" min-width="130" />
        <el-table-column label="API 地址" align="center" prop="baseUrl" :show-overflow-tooltip="true" min-width="180" />
        <el-table-column label="API Key" align="center" prop="apiKey" width="110">
          <template #default="scope">
            <el-tag v-if="scope.row.hasKey" type="success" size="small">{{ scope.row.apiKey }}</el-tag>
            <el-tag v-else type="info" size="small">未配置</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="维度" align="center" prop="embedDim" width="70">
          <template #default="scope">
            <span>{{ scope.row.embedDim || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="默认" align="center" prop="isDefault" width="70">
          <template #default="scope">
            <el-tag v-if="scope.row.isDefault === '1'" type="warning" size="small">默认</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" align="center" prop="status" width="80">
          <template #default="scope">
            <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" align="center" width="230" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="测试连接" placement="top">
              <el-button
                v-hasPermi="['ai:model:query']"
                link
                type="success"
                icon="Connection"
                :loading="testingId === scope.row.modelId"
                @click="handleTest(scope.row)"
              ></el-button>
            </el-tooltip>
            <el-tooltip content="参数设置" placement="top">
              <el-button v-hasPermi="['ai:model:edit']" link type="warning" icon="Setting" @click="openParams(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['ai:model:edit']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ai:model:remove']" link type="danger" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </el-card>

    <!-- 添加或修改模型对话框 -->
    <el-dialog v-model="dialog.visible" :title="dialog.title" width="640px" append-to-body>
      <el-form ref="modelFormRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="模型名称" prop="modelName">
          <el-input v-model="form.modelName" placeholder="请输入显示名称，如 DeepSeek-V3" />
        </el-form-item>
        <el-form-item label="模型类型" prop="modelType">
          <el-radio-group v-model="form.modelType" @change="handleTypeChange">
            <el-radio v-for="dict in ai_model_type" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="接入模板" prop="provider">
          <el-select v-model="templateKey" placeholder="选择预置模板自动填充" style="width: 100%" @change="applyTemplate">
            <el-option v-for="t in availableTemplates" :key="t.key" :label="t.label" :value="t.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="API 地址" prop="baseUrl">
          <el-input v-model="form.baseUrl" placeholder="https://api.deepseek.com（OpenAI 兼容端点）" />
        </el-form-item>
        <el-form-item label="模型标识" prop="modelCode">
          <el-input v-model="form.modelCode" placeholder="deepseek-chat / text-embedding-v3 等" />
        </el-form-item>
        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="form.modelId ? '已配置（留空表示不修改）' : '请输入 API Key'"
          />
        </el-form-item>
        <el-form-item v-if="form.modelType === '2'" label="向量维度" prop="embedDim">
          <el-input-number v-model="form.embedDim" :min="1" controls-position="right" />
          <el-button
            v-for="dim in [1024, 1536, 3072, 7168]"
            :key="dim"
            link
            type="primary"
            style="margin-left: 8px"
            @click="setEmbedDim(dim)"
          >
            {{ dim }}
          </el-button>
          <div class="form-tip" style="width: 100%; margin-left: 0">
            可留空：保存后点击列表「测试连接」，将按模型实际输出自动回填（决定向量库 collection 路由，如 bge-large-zh 1024、Qwen3-Embedding-8B 4096）
          </div>
        </el-form-item>
        <el-form-item v-if="form.modelType === '1'" label="上下文长度" prop="contextWindow">
          <el-input-number v-model="form.contextWindow" :min="1" :max="1000000" controls-position="right" placeholder="token" />
          <span class="form-tip">模型上下文窗口上限（token）；对话应用按此预算裁剪历史与检索资料，留空按默认预算</span>
        </el-form-item>
        <el-form-item v-if="form.modelType === '1'" label="最大输出" prop="maxOutputTokens">
          <el-input-number v-model="form.maxOutputTokens" :min="1" :max="100000" controls-position="right" placeholder="token" />
          <span class="form-tip">单次回答最大输出 token（留空不限制）；应用未覆盖参数时以此为准</span>
        </el-form-item>
        <el-form-item label="设为默认" prop="isDefault">
          <el-switch v-model="form.isDefault" active-value="1" inactive-value="0" />
          <span class="form-tip">每类型至多一个默认模型（新建知识库/应用时预选）</span>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="推理参数（温度、max_tokens 等）通过列表行「参数设置」配置（Map 任意增删）；应用侧将按参数类型动态生成调整控件"
        />
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 模型参数设置对话框（参数定义 + 渲染组件元数据，应用侧按组件渲染） -->
    <el-dialog v-model="paramsDialog.visible" :title="paramsDialog.title" width="760px" append-to-body>
      <div class="params-toolbar">
        <span class="form-tip">定义模型参数及其在应用侧的渲染组件（应用配置时按组件生成调整控件）</span>
        <el-button
          v-for="p in presetParams"
          :key="p.name"
          size="small"
          plain
          type="primary"
          :disabled="paramRows.some(r => r.name === p.name)"
          @click="paramRows.push(JSON.parse(JSON.stringify(p)))"
        >
          + {{ p.label || p.name }}
        </el-button>
      </div>
      <div v-if="paramRows.length === 0" class="params-empty">暂无参数，可通过上方快捷按钮或"添加参数"新建</div>
      <div v-for="(row, index) in paramRows" :key="index" class="param-item">
        <div class="param-row-main">
          <el-input v-model="row.name" placeholder="参数名（如 temperature）" style="width: 200px" />
          <el-input v-model="row.label" placeholder="显示名（可选）" style="width: 140px" />
          <el-select v-model="row.inputType" placeholder="渲染组件" style="width: 120px" @change="handleInputTypeChange(row)">
            <el-option label="文本框" value="input" />
            <el-option label="数字" value="number" />
            <el-option label="滑块" value="slider" />
            <el-option label="开关" value="switch" />
            <el-option label="下拉" value="select" />
          </el-select>
          <div class="param-value-control">
            <span class="param-value-label">默认值</span>
            <el-input v-if="row.inputType === 'input'" v-model="row.value as string" placeholder="字符串" style="width: 160px" />
            <el-input-number
              v-else-if="row.inputType === 'number' || row.inputType === 'slider'"
              v-model="row.value as number"
              :min="row.inputType === 'slider' ? (row.min ?? undefined) : undefined"
              :max="row.inputType === 'slider' ? (row.max ?? undefined) : undefined"
              controls-position="right"
              style="width: 160px"
            />
            <el-switch v-else-if="row.inputType === 'switch'" v-model="row.value as boolean" />
            <el-select v-else-if="row.inputType === 'select'" v-model="row.value" placeholder="默认选项" style="width: 160px">
              <el-option v-for="opt in row.options || []" :key="opt" :label="opt" :value="opt" />
            </el-select>
          </div>
          <el-button link type="danger" icon="Delete" @click="paramRows.splice(index, 1)"></el-button>
        </div>
        <div v-if="row.inputType === 'slider' || row.inputType === 'number'" class="param-row-config">
          <span class="param-value-label">{{ row.inputType === 'slider' ? '范围' : '限制' }}</span>
          <el-input-number v-model="row.min" placeholder="最小" controls-position="right" style="width: 110px" />
          <span class="param-value-label">~</span>
          <el-input-number v-model="row.max" placeholder="最大" controls-position="right" style="width: 110px" />
          <template v-if="row.inputType === 'slider'">
            <span class="param-value-label">步长</span>
            <el-input-number v-model="row.step" :min="0.01" :step="0.05" controls-position="right" style="width: 100px" />
          </template>
        </div>
        <div v-else-if="row.inputType === 'select'" class="param-row-config">
          <span class="param-value-label">选项</span>
          <el-select
            v-model="row.options"
            placeholder="输入后回车添加选项"
            multiple
            filterable
            allow-create
            default-first-option
            style="width: 420px"
            :reserve-keyword="false"
          />
        </div>
      </div>
      <el-button
        style="margin-top: 8px; width: 100%"
        plain
        icon="Plus"
        :disabled="paramRows.length >= 20"
        @click="paramRows.push({ name: '', label: '', value: '', inputType: 'input', min: undefined, max: undefined, step: undefined, options: undefined })"
      >
        添加参数
      </el-button>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitParams">确 定</el-button>
          <el-button @click="paramsDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Model" lang="ts">
import { addAiModel, delAiModel, getAiModel, listAiModel, testAiModel, updateAiModel, updateModelParams } from '@/api/ai/model';
import { AiModelForm, AiModelQuery, AiModelVO, ModelParamDef } from '@/api/ai/model/types';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';

const { ai_model_type, sys_normal_disable } = toRefs<any>(useDict('ai_model_type', 'sys_normal_disable'));

const modelList = ref<AiModelVO[]>([]);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const { ids, single, multiple, handleSelectionChange } = useTableSelection<AiModelVO>(item => item.modelId);
const total = ref(0);
const modelFormRef = ref<ElFormInstance>();
const queryFormRef = ref<ElFormInstance>();
const testingId = ref<number | string | undefined>(undefined);

/**
 * 接入模板（provider 后端恒为 openai_compatible，模板仅用于自动填充）
 * types 声明模板支持的模型类型（1=LLM 2=Embedding 3=Rerank），下拉按当前类型过滤
 */
const providerTemplates = [
  {
    key: 'deepseek',
    label: 'DeepSeek',
    types: ['1'],
    baseUrl: 'https://api.deepseek.com',
    chatCode: 'deepseek-chat',
    embedCode: '',
    rerankCode: ''
  },
  {
    key: 'qwen',
    label: '通义千问（兼容模式）',
    types: ['1', '2'],
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    chatCode: 'qwen-plus',
    embedCode: 'text-embedding-v3',
    rerankCode: ''
  },
  {
    key: 'siliconflow',
    label: 'SiliconFlow',
    types: ['1', '2', '3'],
    baseUrl: 'https://api.siliconflow.cn/v1',
    chatCode: 'deepseek-ai/DeepSeek-V3',
    embedCode: 'BAAI/bge-large-zh-v1.5',
    rerankCode: 'BAAI/bge-reranker-v2-m3'
  },
  {
    key: 'jina',
    label: 'Jina（重排/向量）',
    types: ['2', '3'],
    baseUrl: 'https://api.jina.ai/v1',
    chatCode: '',
    embedCode: 'jina-embeddings-v3',
    rerankCode: 'jina-reranker-v2-base-multilingual'
  },
  {
    key: 'ollama',
    label: 'Ollama（本地）',
    types: ['1', '2'],
    baseUrl: 'http://localhost:11434',
    chatCode: 'qwen2.5:7b',
    embedCode: 'nomic-embed-text',
    rerankCode: ''
  },
  { key: 'custom', label: '自定义', types: ['1', '2', '3'], baseUrl: '', chatCode: '', embedCode: '', rerankCode: '' }
];
const templateKey = ref('deepseek');

/** 当前类型可用的模板（类型切换联动过滤，不支持的模板不出现） */
const availableTemplates = computed(() => providerTemplates.filter(t => t.types.includes(form.value.modelType)));

/** 按类型取模板建议的模型标识 */
const templateCode = (t: (typeof providerTemplates)[number]) => {
  if (form.value.modelType === '2') return t.embedCode;
  if (form.value.modelType === '3') return t.rerankCode;
  return t.chatCode;
};

const initFormData: AiModelForm = {
  modelId: undefined,
  modelName: '',
  modelType: '1',
  provider: 'openai_compatible',
  baseUrl: '',
  modelCode: '',
  apiKey: undefined,
  embedDim: undefined,
  isDefault: '0',
  status: '0'
};

const data = reactive<PageData<AiModelForm, AiModelQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    modelName: undefined,
    modelType: undefined,
    status: undefined
  },
    rules: {
      modelName: [{ required: true, message: '模型名称不能为空', trigger: 'blur' }],
      modelType: [{ required: true, message: '模型类型不能为空', trigger: 'change' }],
      baseUrl: [
        { required: true, message: 'API 地址不能为空', trigger: 'blur' },
        { type: 'url', message: '必须是合法 URL（http/https）', trigger: 'blur' }
      ],
      modelCode: [{ required: true, message: '模型标识不能为空', trigger: 'blur' }]
    }
});

const { queryParams, form, rules } = toRefs<PageData<AiModelForm, AiModelQuery>>(data);
const { dialog, resetForm, openDialog, showDialog, closeDialog } = useFormDialog({
  form,
  formRef: modelFormRef,
  initialFormData: initFormData
});
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  afterReset: () => {
    handleQuery();
  }
});

/** 查询模型列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listAiModel(queryParams.value);
    modelList.value = res.data?.rows;
    total.value = res.data?.total;
  });
};

/** 搜索 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

/** 接入模板自动填充 */
const applyTemplate = (key: string) => {
  const template = providerTemplates.find(t => t.key === key);
  if (!template) return;
  form.value.baseUrl = template.baseUrl;
  const code = templateCode(template);
  if (code) {
    form.value.modelCode = code;
  }
};

/** 类型切换：清空不适用字段；当前模板不支持新类型时自动切换到第一个可用模板 */
const handleTypeChange = () => {
  if (form.value.modelType !== '2') {
    form.value.embedDim = undefined;
  }
  const currentSupported = providerTemplates.some(
    t => t.key === templateKey.value && t.types.includes(form.value.modelType)
  );
  if (!currentSupported) {
    templateKey.value = availableTemplates.value[0]?.key ?? 'custom';
  }
  applyTemplate(templateKey.value);
};

/** 取消 */
const cancel = () => {
  closeDialog();
  resetForm();
};

/** 新增（先开对话框再填模板——openDialog 内部会 reset 表单，先填会被清空） */
const handleAdd = () => {
  templateKey.value = 'deepseek';
  openDialog('新增模型');
  applyTemplate('deepseek');
};

/** 快捷维度赋值并清除该字段校验（程序赋值不触发 change 校验） */
const setEmbedDim = (dim: number) => {
  form.value.embedDim = dim;
  modelFormRef.value?.clearValidate('embedDim');
};

/** 修改 */
const handleUpdate = async (row?: Partial<AiModelVO>) => {
  resetForm();
  const modelId = row?.modelId || ids.value[0];
  const res = await getAiModel(modelId);
  const vo = res.data;
  // apiKey 不回显（留空=不修改）；params 为模型默认参数，推理参数由应用侧覆盖配置
  Object.assign(form.value, vo, { apiKey: undefined });
  templateKey.value = 'custom';
  showDialog('修改模型');
};

/** 提交 */
const submitForm = () => {
  modelFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      form.value.modelId ? await updateAiModel(form.value) : await addAiModel(form.value);
      modal.msgSuccess('操作成功');
      closeDialog();
      await getList();
    }
  });
};

/** 删除 */
const handleDelete = async (row?: Partial<AiModelVO>) => {
  const modelIds = row?.modelId || ids.value;
  await modal.confirm('是否确认删除模型编号为"' + modelIds + '"的数据项？');
  await delAiModel(modelIds);
  await getList();
  modal.msgSuccess('删除成功');
};

/** 连通性测试（embedding 类型成功后后端已自动回填维度，刷新列表同步显示） */
const handleTest = async (row: AiModelVO) => {
  testingId.value = row.modelId;
  try {
    const res = await testAiModel(row.modelId);
    const result = res.data;
    if (result?.success) {
      modal.msgSuccess(`${row.modelName}：${result.message}（${result.costMs}ms）`);
      if (result.embedDim) {
        await getList();
      }
    } else {
      modal.msgError(`${row.modelName} 连接失败：${result?.message || '未知错误'}`);
    }
  } finally {
    testingId.value = undefined;
  }
};

/** —— 模型参数设置（参数定义含渲染组件元数据，独立于编辑表单） —— */
const paramsDialog = reactive({ visible: false, title: '参数设置' });
const paramRows = ref<ModelParamDef[]>([]);
const paramsModelId = ref<number | string | undefined>(undefined);
const paramsModelName = ref('');

/** 常用参数快捷添加（带渲染组件与范围） */
const presetParams: ModelParamDef[] = [
  { name: 'temperature', label: '温度', value: 0.7, inputType: 'slider', min: 0, max: 2, step: 0.1, options: undefined },
  { name: 'top_p', label: 'Top P', value: 1, inputType: 'slider', min: 0, max: 1, step: 0.05, options: undefined },
  { name: 'max_tokens', label: '最大 Tokens', value: 2048, inputType: 'number', min: 1, max: 131072, step: undefined, options: undefined },
  { name: 'enable_search', label: '联网搜索', value: false, inputType: 'switch', min: undefined, max: undefined, step: undefined, options: undefined }
];

/** 渲染组件切换：重置不兼容的默认值 */
const handleInputTypeChange = (row: ModelParamDef) => {
  if (row.inputType === 'switch') {
    row.value = false;
  } else if (row.inputType === 'number' || row.inputType === 'slider') {
    row.value = typeof row.value === 'number' ? row.value : 0;
  } else if (row.inputType === 'select') {
    row.value = row.options?.[0] ?? '';
  } else {
    row.value = row.value == null ? '' : String(row.value);
  }
};

const openParams = (row: AiModelVO) => {
  paramsModelId.value = row.modelId;
  paramsModelName.value = row.modelName;
  paramRows.value = [];
  try {
    const params = row.params ? JSON.parse(row.params) : [];
    if (Array.isArray(params)) {
      paramRows.value = params;
    }
  } catch {
    // params 非法时按空处理
  }
  paramsDialog.title = `参数设置 - ${row.modelName}`;
  paramsDialog.visible = true;
};

const submitParams = async () => {
  if (!paramsModelId.value) return;
  for (const row of paramRows.value) {
    if (!row.name?.trim()) {
      modal.msgError('参数名不能为空');
      return;
    }
    if (row.inputType === 'slider' && (row.min == null || row.max == null)) {
      modal.msgError(`参数 ${row.name}：滑块组件必须配置最小值/最大值`);
      return;
    }
    if (row.inputType === 'select' && !row.options?.length) {
      modal.msgError(`参数 ${row.name}：下拉组件必须配置选项`);
      return;
    }
  }
  await updateModelParams(paramsModelId.value, paramRows.value);
  modal.msgSuccess(`已保存 ${paramsModelName.value} 的 ${paramRows.value.length} 个参数`);
  paramsDialog.visible = false;
  await getList();
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;

.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.params-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;

  .form-tip {
    margin-left: 0;
    margin-right: auto;
  }
}

.params-empty {
  padding: 16px 0;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.param-item {
  padding: 10px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  margin-bottom: 8px;
}

.param-row-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.param-row-config {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding-left: 4px;
}

.param-value-control {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.param-value-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
</style>
