<template>
  <div class="p-2 app-container ai-kb-page">
    <!-- 知识库列表模式 -->
    <template v-if="!viewingDatasetId">
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
          <el-form-item label="知识库名称" prop="datasetName">
            <el-input v-model="queryParams.datasetName" placeholder="请输入名称" clearable @keyup.enter="handleQuery" />
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

      <el-card shadow="hover" class="table-panel">
        <template #header>
          <div class="toolbar-shell">
            <div class="table-heading">
              <span class="panel-kicker">Knowledge Base</span>
              <h3>知识库列表</h3>
              <p>共 {{ total }} 个知识库。文档上传后自动解析、分块并向量化（结构感知管线）。</p>
            </div>
            <div class="toolbar-actions">
              <el-button v-hasPermi="['ai:kb:add']" type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
              <el-button
                v-hasPermi="['ai:kb:remove']"
                type="danger"
                plain
                icon="Delete"
                :disabled="multiple"
                @click="handleDelete()"
              >
                删除
              </el-button>
              <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
            </div>
          </div>
        </template>
        <el-table v-loading="loading" border class="data-table" :data="datasetList" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="55" align="center" />
          <el-table-column label="名称" align="left" prop="datasetName" min-width="140" :show-overflow-tooltip="true" />
          <el-table-column label="描述" align="left" prop="description" min-width="160" :show-overflow-tooltip="true" />
          <el-table-column label="向量维度" align="center" prop="embedDim" width="90" />
          <el-table-column label="文档统计" align="center" width="150">
            <template #default="scope">
              <span v-if="statMap[scope.row.datasetId]">
                文档 {{ statMap[scope.row.datasetId].documentCount }} / 分块
                {{ statMap[scope.row.datasetId].chunkCount }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" align="center" prop="status" width="80">
            <template #default="scope">
              <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
            </template>
          </el-table-column>
          <el-table-column label="创建时间" align="center" prop="createTime" width="160">
            <template #default="scope">
              <span>{{ parseTime(scope.row.createTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" fixed="right" align="center" width="220" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-tooltip content="文档管理" placement="top">
                <el-button v-hasPermi="['ai:kb:query']" link type="primary" icon="FolderOpened" @click="enterDetail(scope.row)"></el-button>
              </el-tooltip>
              <el-tooltip content="修改" placement="top">
                <el-button v-hasPermi="['ai:kb:edit']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <el-button v-hasPermi="['ai:kb:remove']" link type="danger" icon="Delete" @click="handleDelete(scope.row)"></el-button>
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

      <!-- 添加或修改知识库对话框 -->
      <el-dialog v-model="dialog.visible" :title="dialog.title" width="620px" append-to-body>
        <el-form ref="datasetFormRef" :model="form" :rules="rules" label-width="100px">
          <el-form-item label="知识库名称" prop="datasetName">
            <el-input v-model="form.datasetName" placeholder="请输入知识库名称" />
          </el-form-item>
          <el-form-item label="描述" prop="description">
            <el-input v-model="form.description" type="textarea" :rows="2" placeholder="知识库用途说明" />
          </el-form-item>
          <el-form-item label="向量模型" prop="embedModelId">
            <el-select v-model="form.embedModelId" placeholder="选择 Embedding 模型" style="width: 100%">
              <el-option
                v-for="m in embedModels"
                :key="m.modelId"
                :label="`${m.modelName}（${m.modelCode}，维度 ${m.embedDim ?? '?'}）`"
                :value="m.modelId"
              />
            </el-select>
            <span class="form-tip">向量维度自动从模型带出，保存后不可更换已入库文档的维度</span>
          </el-form-item>
          <el-form-item label="分块模式" prop="chunkMode">
            <el-radio-group v-model="form.chunkMode">
              <el-radio value="structure">结构感知（推荐）</el-radio>
              <el-radio value="structure_semantic">结构 + 语义（高质量）</el-radio>
            </el-radio-group>
            <span class="form-tip">语义模式按句子向量相似度检测主题断点，入库耗时与向量调用量增加</span>
          </el-form-item>
          <el-form-item label="分块长度" prop="maxChars">
            <el-input-number v-model="form.maxChars" :min="200" :max="2000" :step="50" controls-position="right" />
            <span class="form-tip">单块最大字符数（默认 700 ≈ 500 token）</span>
          </el-form-item>
          <el-form-item label="重叠比例" prop="overlapRatio">
            <el-input-number v-model="form.overlapRatio" :min="0" :max="0.5" :step="0.05" controls-position="right" />
          </el-form-item>
          <el-form-item v-if="form.chunkMode === 'structure_semantic'" label="语义阈值" prop="semanticThreshold">
            <el-input-number v-model="form.semanticThreshold" :min="0.3" :max="0.95" :step="0.05" controls-position="right" />
            <span class="form-tip">相邻句相似度低于该值即断开（越小切分越细）</span>
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
    </template>

    <!-- 知识库详情（左文档右分块） -->
    <kb-detail v-else :dataset-id="viewingDatasetId" @back="exitDetail" />
  </div>
</template>

<script setup name="Knowledge" lang="ts">
import KbDetail from './detail.vue';
import { addDataset, delDataset, datasetStat, getDataset, listDataset, updateDataset } from '@/api/ai/knowledge';
import { DocumentStat, KbDatasetForm, KbDatasetQuery, KbDatasetVO } from '@/api/ai/knowledge/types';
import { listAiModel } from '@/api/ai/model';
import { AiModelVO } from '@/api/ai/model/types';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { parseTime } from '@/utils/zhiku';

const { sys_normal_disable } = toRefs<any>(useDict('sys_normal_disable'));

const datasetList = ref<KbDatasetVO[]>([]);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const { ids, single, multiple, handleSelectionChange } = useTableSelection<KbDatasetVO>(item => item.datasetId);
const total = ref(0);
const datasetFormRef = ref<ElFormInstance>();
const queryFormRef = ref<ElFormInstance>();
const statMap = ref<Record<string, DocumentStat>>({});
const embedModels = ref<AiModelVO[]>([]);
/** 进入详情模式的知识库 ID */
const viewingDatasetId = ref<number | string | undefined>(undefined);

const initFormData: KbDatasetForm = {
  datasetId: undefined,
  datasetName: '',
  description: '',
  embedModelId: undefined,
  status: '0',
  chunkMode: 'structure',
  maxChars: 700,
  overlapRatio: 0.15,
  semanticThreshold: 0.75
};

const data = reactive<PageData<KbDatasetForm, KbDatasetQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    datasetName: undefined,
    status: undefined
  },
  rules: {
    datasetName: [{ required: true, message: '知识库名称不能为空', trigger: 'blur' }],
    embedModelId: [{ required: true, message: '必须选择向量模型', trigger: 'change' }],
    maxChars: [{ required: true, message: '分块长度不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs<PageData<KbDatasetForm, KbDatasetQuery>>(data);
const { dialog, resetForm, openDialog, showDialog, closeDialog } = useFormDialog({
  form,
  formRef: datasetFormRef,
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

/** 查询知识库列表 + 统计 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listDataset(queryParams.value);
    datasetList.value = res.data?.rows;
    total.value = res.data?.total;
    datasetList.value.forEach(row => loadStat(row.datasetId));
  });
};

/** 加载知识库统计（文档数/分块数） */
const loadStat = async (datasetId: number | string) => {
  const res = await datasetStat(datasetId);
  statMap.value[datasetId] = res.data;
};

/** 加载 Embedding 模型下拉 */
const loadEmbedModels = async () => {
  const res = await listAiModel({ pageNum: 1, pageSize: 100, modelType: '2' });
  embedModels.value = res.data?.rows ?? [];
};

/** 搜索 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

/** 取消 */
const cancel = () => {
  closeDialog();
  resetForm();
};

/** 新增 */
const handleAdd = () => {
  resetForm();
  loadEmbedModels();
  openDialog('新增知识库');
};

/** 修改（解析 chunkParams JSON 回填） */
const handleUpdate = async (row?: Partial<KbDatasetVO>) => {
  resetForm();
  const datasetId = row?.datasetId || ids.value[0];
  const res = await getDataset(datasetId);
  const vo = res.data;
  Object.assign(form.value, vo);
  try {
    const params = vo.chunkParams ? JSON.parse(vo.chunkParams) : {};
    form.value.chunkMode = params.mode ?? 'structure';
    form.value.maxChars = params.maxChars ?? 700;
    form.value.overlapRatio = params.overlapRatio ?? 0.15;
    form.value.semanticThreshold = params.semanticThreshold ?? 0.75;
  } catch {
    // chunkParams 非法时保持默认
  }
  loadEmbedModels();
  showDialog('修改知识库');
};

/** 提交（组装 chunkParams JSON） */
const submitForm = () => {
  datasetFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      const submitData = {
        ...form.value,
        chunkParams: JSON.stringify({
          mode: form.value.chunkMode,
          maxChars: form.value.maxChars,
          overlapRatio: form.value.overlapRatio,
          semanticThreshold: form.value.semanticThreshold
        })
      };
      form.value.datasetId ? await updateDataset(submitData) : await addDataset(submitData);
      modal.msgSuccess('操作成功');
      closeDialog();
      await getList();
    }
  });
};

/** 删除 */
const handleDelete = async (row?: Partial<KbDatasetVO>) => {
  const datasetIds = row?.datasetId || ids.value;
  await modal.confirm('是否确认删除知识库编号为"' + datasetIds + '"的数据项？');
  await delDataset(datasetIds);
  await getList();
  modal.msgSuccess('删除成功');
};

/** 进入/退出详情模式 */
const enterDetail = (row: KbDatasetVO) => {
  viewingDatasetId.value = row.datasetId;
};
const exitDetail = () => {
  viewingDatasetId.value = undefined;
  getList();
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
