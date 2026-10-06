<template>
  <div class="p-2 app-container ai-kb-page">
    <!-- ================= 知识库列表（卡片式，对标 业界方案） ================= -->
    <template v-if="!viewingDatasetId">
      <el-card shadow="hover" class="table-panel">
        <template #header>
          <div class="toolbar-shell">
            <div class="table-heading">
              <span class="panel-kicker">Knowledge Base</span>
              <h3>知识库</h3>
              <p>共 {{ total }} 个知识库。文档上传后自动解析、分段并向量化。</p>
            </div>
            <div class="toolbar-actions">
              <el-input
                v-model="queryParams.datasetName"
                placeholder="搜索知识库名称"
                clearable
                style="width: 220px"
                @keyup.enter="handleQuery"
              >
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <el-button v-hasPermi="['ai:kb:add']" type="primary" icon="Plus" @click="handleAdd">创建知识库</el-button>
            </div>
          </div>
        </template>

        <div v-loading="loading" class="kb-card-grid">
          <el-empty v-if="!loading && datasetList.length === 0" description="还没有知识库，点击右上角创建" />
          <div v-for="row in datasetList" :key="row.datasetId" class="kb-card" @click="enterDetail(row)">
            <div class="kb-card-title">
              <el-icon class="kb-card-icon"><Collection /></el-icon>
              <span class="kb-card-name" :title="row.datasetName">{{ row.datasetName }}</span>
              <!-- 阻断冒泡：小点与菜单点击不得触发卡片进入详情 -->
              <span class="kb-card-more-wrap" @click.stop>
                <el-dropdown trigger="click" @command="(cmd: string) => handleCardCommand(cmd, row)">
                  <el-icon class="kb-card-more" @click.stop><MoreFilled /></el-icon>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit" v-hasPermi="['ai:kb:edit']">编辑</el-dropdown-item>
                      <el-dropdown-item command="delete" divided v-hasPermi="['ai:kb:remove']">
                        <span style="color: var(--el-color-danger)">删除</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </span>
            </div>
            <div class="kb-card-desc">{{ row.description || '暂无描述' }}</div>
            <div class="kb-card-stat">
              <span>文档 {{ statMap[row.datasetId]?.documentCount ?? '-' }}</span>
              <span>分段 {{ statMap[row.datasetId]?.chunkCount ?? '-' }}</span>
              <span v-if="row.embedDim">维度 {{ row.embedDim }}</span>
            </div>
            <div class="kb-card-footer">
              <span>{{ parseTime(row.createTime) }}</span>
            </div>
          </div>
        </div>

        <pagination
          v-show="total > 0"
          v-model:page="queryParams.pageNum"
          v-model:limit="queryParams.pageSize"
          :total="total"
          @pagination="getList"
        />
      </el-card>

      <!-- 创建/编辑知识库对话框（对标竞品：名称+描述+向量模型） -->
      <el-dialog v-model="dialog.visible" :title="dialog.title" width="520px" append-to-body>
        <el-form ref="datasetFormRef" :model="form" :rules="rules" label-width="90px">
          <el-form-item label="知识库名称" prop="datasetName">
            <el-input v-model="form.datasetName" placeholder="请输入知识库名称" maxlength="100" show-word-limit />
          </el-form-item>
          <el-form-item label="描述" prop="description">
            <el-input v-model="form.description" type="textarea" :rows="3" placeholder="知识库用途说明（可选）" maxlength="500" show-word-limit />
          </el-form-item>
          <el-form-item label="向量模型" prop="embedModelId">
            <el-select v-model="form.embedModelId" placeholder="选择 Embedding 模型" style="width: 100%" :disabled="!!form.datasetId">
              <el-option
                v-for="m in embedModels"
                :key="m.modelId"
                :label="`${m.modelName}（维度 ${m.embedDim ?? '?'}）`"
                :value="m.modelId"
              />
            </el-select>
            <span class="form-tip">分段规则在上传文档时设置</span>
          </el-form-item>
          <el-form-item label="重排模型" prop="rerankModelId">
            <el-select v-model="form.rerankModelId" placeholder="不重排（可选）" style="width: 100%" clearable>
              <el-option v-for="m in rerankModels" :key="m.modelId" :label="m.modelName" :value="m.modelId" />
            </el-select>
            <span class="form-tip">应用对话检索本库时按此模型重排结果；不选且有系统默认 Rerank 时用默认，均无则不重排</span>
          </el-form-item>
          <template v-if="form.datasetId">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="form.status">
                <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </template>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button type="primary" @click="submitForm">确 定</el-button>
            <el-button @click="cancel">取 消</el-button>
          </div>
        </template>
      </el-dialog>
    </template>

    <!-- ================= 知识库详情（左侧固定菜单布局） ================= -->
    <kb-detail-layout v-else :dataset-id="viewingDatasetId" @back="exitDetail" />
  </div>
</template>

<script setup name="Knowledge" lang="ts">
import KbDetailLayout from './detail-layout.vue';
import { addDataset, delDataset, datasetStat, getDataset, listDataset, updateDataset } from '@/api/ai/knowledge';
import { DocumentStat, KbDatasetForm, KbDatasetQuery, KbDatasetVO } from '@/api/ai/knowledge/types';
import { listAiModel } from '@/api/ai/model';
import { AiModelVO } from '@/api/ai/model/types';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { parseTime } from '@/utils/zhiku';

const { sys_normal_disable } = toRefs<any>(useDict('sys_normal_disable'));

const datasetList = ref<KbDatasetVO[]>([]);
const { loading, withLoading } = useLoading(true);
const total = ref(0);
const datasetFormRef = ref<ElFormInstance>();
const statMap = ref<Record<string, DocumentStat>>({});
const embedModels = ref<AiModelVO[]>([]);
const rerankModels = ref<AiModelVO[]>([]);
/** 正在查看的知识库 */
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
    pageSize: 12,
    datasetName: undefined,
    status: undefined
  },
  rules: {
    datasetName: [{ required: true, message: '知识库名称不能为空', trigger: 'blur' }],
    embedModelId: [{ required: true, message: '必须选择向量模型', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs<PageData<KbDatasetForm, KbDatasetQuery>>(data);
const { dialog, resetForm, openDialog, showDialog, closeDialog } = useFormDialog({
  form,
  formRef: datasetFormRef,
  initialFormData: initFormData
});

/** 查询知识库列表 + 各库统计 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listDataset(queryParams.value);
    datasetList.value = res.data?.rows;
    total.value = res.data?.total;
    datasetList.value.forEach(row => loadStat(row.datasetId));
  });
};

const loadStat = async (datasetId: number | string) => {
  const res = await datasetStat(datasetId);
  statMap.value[datasetId] = res.data;
};

const loadRerankModels = async () => {
  const res = await listAiModel({ pageNum: 1, pageSize: 100, modelType: '3' });
  rerankModels.value = res.data?.rows ?? [];
};

const loadEmbedModels = async () => {
  const res = await listAiModel({ pageNum: 1, pageSize: 100, modelType: '2' });
  embedModels.value = res.data?.rows ?? [];
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const cancel = () => {
  closeDialog();
  resetForm();
};

const handleAdd = () => {
  resetForm();
  loadEmbedModels();
  loadRerankModels();
  openDialog('创建知识库');
};

const handleCardCommand = async (cmd: string, row: KbDatasetVO) => {
  if (cmd === 'edit') {
    resetForm();
    const res = await getDataset(row.datasetId);
    Object.assign(form.value, res.data);
    loadEmbedModels();
    loadRerankModels();
  loadRerankModels();
    showDialog('编辑知识库');
  } else if (cmd === 'delete') {
    await modal.confirm(`删除知识库"${row.datasetName}"？将级联删除其下全部文档、分段、向量与问题，并解除应用挂载。`);
    await delDataset(row.datasetId);
    modal.msgSuccess('删除成功');
    await getList();
  }
};

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

/** 进入/退出第二层，进入第三层 */
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
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.kb-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  min-height: 200px;
}

.kb-card {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--el-bg-color);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-5));
    opacity: 0;
    transition: opacity 0.25s;
  }

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: var(--el-box-shadow);
    transform: translateY(-2px);

    &::before {
      opacity: 1;
    }
  }

  .kb-card-title {
    display: flex;
    align-items: center;
    gap: 10px;

    .kb-card-icon {
      width: 38px;
      height: 38px;
      border-radius: 9px;
      background: linear-gradient(135deg, var(--el-color-primary-light-8), var(--el-color-primary-light-9));
      color: var(--el-color-primary);
      font-size: 19px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .kb-card-name {
      flex: 1;
      font-size: 15px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .kb-card-more {
      color: var(--el-text-color-placeholder);
      cursor: pointer;
      font-size: 16px;

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }

  .kb-card-desc {
    min-height: 42px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .kb-card-stat {
    display: flex;
    gap: 8px;

    span {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--el-fill-color-light);
      color: var(--el-text-color-regular);
    }
  }

  .kb-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--el-border-color-extra-light);
    padding-top: 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
