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
        <el-table-column label="操作" fixed="right" align="center" width="200" class-name="small-padding fixed-width">
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
            v-for="dim in [1024, 1536, 7168]"
            :key="dim"
            link
            type="primary"
            style="margin-left: 8px"
            @click="form.embedDim = dim"
          >
            {{ dim }}
          </el-button>
        </el-form-item>
        <template v-if="form.modelType === '1'">
          <el-form-item label="温度" prop="temperature">
            <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" show-input style="width: 90%" />
          </el-form-item>
          <el-form-item label="最大 Tokens" prop="maxTokens">
            <el-input-number v-model="form.maxTokens" :min="1" :max="131072" controls-position="right" />
          </el-form-item>
          <el-form-item label="Top P" prop="topP">
            <el-input-number v-model="form.topP" :min="0" :max="1" :step="0.05" controls-position="right" />
          </el-form-item>
        </template>
        <el-form-item label="设为默认" prop="isDefault">
          <el-switch v-model="form.isDefault" active-value="1" inactive-value="0" />
          <span class="form-tip">每类型至多一个默认模型（新建知识库/应用时预选）</span>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Model" lang="ts">
import { addAiModel, delAiModel, getAiModel, listAiModel, testAiModel, updateAiModel } from '@/api/ai/model';
import { AiModelForm, AiModelQuery, AiModelVO } from '@/api/ai/model/types';
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
  status: '0',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1
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
    modelCode: [{ required: true, message: '模型标识不能为空', trigger: 'blur' }],
    embedDim: [{ required: true, message: 'Embedding 模型必须配置向量维度', trigger: 'blur' }]
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

/** 新增 */
const handleAdd = () => {
  resetForm();
  templateKey.value = 'deepseek';
  applyTemplate('deepseek');
  openDialog('新增模型');
};

/** 修改（解析 params JSON 到独立参数字段） */
const handleUpdate = async (row?: Partial<AiModelVO>) => {
  resetForm();
  const modelId = row?.modelId || ids.value[0];
  const res = await getAiModel(modelId);
  const vo = res.data;
  Object.assign(form.value, vo, { apiKey: undefined });
  try {
    const params = vo.params ? JSON.parse(vo.params) : {};
    form.value.temperature = params.temperature ?? initFormData.temperature;
    form.value.maxTokens = params.maxTokens ?? initFormData.maxTokens;
    form.value.topP = params.topP ?? initFormData.topP;
  } catch {
    // params 非法时保持默认值
  }
  templateKey.value = 'custom';
  showDialog('修改模型');
};

/** 提交（组装 params JSON） */
const submitForm = () => {
  modelFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      const submitData = {
        ...form.value,
        params: JSON.stringify({
          temperature: form.value.temperature,
          maxTokens: form.value.maxTokens,
          topP: form.value.topP
        })
      };
      form.value.modelId ? await updateAiModel(submitData) : await addAiModel(submitData);
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

/** 连通性测试 */
const handleTest = async (row: AiModelVO) => {
  testingId.value = row.modelId;
  try {
    const res = await testAiModel(row.modelId);
    const result = res.data;
    if (result?.success) {
      modal.msgSuccess(`${row.modelName}：${result.message}（${result.costMs}ms）`);
    } else {
      modal.msgError(`${row.modelName} 连接失败：${result?.message || '未知错误'}`);
    }
  } finally {
    testingId.value = undefined;
  }
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
</style>
