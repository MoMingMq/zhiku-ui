<template>
  <div class="kb-problems-page">
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="detail-title">问题管理</span>
            <span class="form-tip">问题文本会向量化参与检索：命中问题后自动展开到其绑定的分段（共 {{ problems.length }} 条）</span>
          </div>
          <div class="toolbar-actions">
            <el-input v-model="keyword" placeholder="搜索问题" clearable style="width: 200px" @keyup.enter="loadProblems">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button v-hasPermi="['ai:kb:add']" type="primary" plain icon="Plus" @click="openEdit()">添加问题</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="filteredProblems">
        <el-table-column label="问题" align="left" prop="content" min-width="280" :show-overflow-tooltip="true" />
        <el-table-column label="绑定分段" align="center" width="110">
          <template #default="scope">
            <el-tag size="small" type="info">{{ scope.row.chunkCount ?? 0 }} 段</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="170">
          <template #default="scope">{{ parseTime(scope.row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" align="center" width="140" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-button v-hasPermi="['ai:kb:edit']" link type="primary" icon="Edit" @click="openEdit(scope.row)">编辑</el-button>
            <el-button v-hasPermi="['ai:kb:remove']" link type="danger" icon="Delete" @click="handleDelete(scope.row)"></el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 问题编辑对话框 -->
    <el-dialog v-model="editVisible" :title="editingId ? '编辑问题' : '添加问题'" width="680px" append-to-body :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="问题" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="3" placeholder="用户可能提出的问题，将向量化用于检索匹配" maxlength="1000" show-word-limit />
        </el-form-item>
        <el-form-item label="绑定分段" prop="chunkIds">
          <div class="bind-box">
            <el-select v-model="selectDocId" placeholder="选择文档后勾选其分段" style="width: 100%" @change="loadDocChunks">
              <el-option v-for="d in documents" :key="d.documentId" :label="d.fileName" :value="d.documentId" />
            </el-select>
            <el-checkbox-group v-model="form.chunkIds" class="chunk-check-list" v-loading="chunkLoading">
              <el-empty v-if="docChunkList.length === 0" description="选择文档后展示其分段" :image-size="50" />
              <el-checkbox v-for="c in docChunkList" :key="c.chunkId" :value="c.chunkId" class="chunk-check-item">
                <span class="chunk-check-title">#{{ c.seq }} {{ c.title || c.headingPath || '（无标题）' }}</span>
                <span class="chunk-check-content">{{ c.content.slice(0, 60) }}…</span>
              </el-checkbox>
            </el-checkbox-group>
            <div class="form-tip">已选 {{ form.chunkIds.length }} 段（可切换多个文档勾选，跨文档绑定）</div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="saving" @click="submitEdit">保 存</el-button>
          <el-button @click="editVisible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { addProblem, delProblem, getProblem, listDocument, listProblem, updateProblem } from '@/api/ai/knowledge';
import { KbChunkVO, KbDocumentVO, KbProblemVO, ProblemBody } from '@/api/ai/knowledge/types';
import modal from '@/plugins/modal';
import { parseTime } from '@/utils/zhiku';

const props = defineProps<{ datasetId: number | string }>();

const problems = ref<KbProblemVO[]>([]);
const documents = ref<KbDocumentVO[]>([]);
const loading = ref(false);
const saving = ref(false);
const keyword = ref('');

const editVisible = ref(false);
const formRef = ref();
const editingId = ref<number | string | undefined>(undefined);
const form = reactive<{ content: string; chunkIds: (number | string)[] }>({ content: '', chunkIds: [] });
const selectDocId = ref<number | string | undefined>(undefined);
const docChunkList = ref<KbChunkVO[]>([]);
const chunkLoading = ref(false);

const rules = {
  content: [{ required: true, message: '问题内容不能为空', trigger: 'blur' }],
  chunkIds: [{ required: true, type: 'array' as const, min: 1, message: '至少绑定一个分段', trigger: 'change' }]
};

const filteredProblems = computed(() => {
  if (!keyword.value.trim()) return problems.value;
  const kw = keyword.value.trim().toLowerCase();
  return problems.value.filter(p => p.content.toLowerCase().includes(kw));
});

const loadProblems = async () => {
  loading.value = true;
  try {
    const res = await listProblem(props.datasetId, keyword.value);
    problems.value = res.data ?? [];
  } finally {
    loading.value = false;
  }
};

const loadDocuments = async () => {
  const res = await listDocument(props.datasetId, { pageNum: 1, pageSize: 200 });
  documents.value = res.data?.rows ?? [];
};

/** 加载所选文档的分段（编辑时若已绑定其他文档分段，通过勾选状态保留） */
const loadDocChunks = async (documentId: number | string) => {
  chunkLoading.value = true;
  try {
    const res = await documentChunks(documentId);
    docChunkList.value = res.data ?? [];
  } finally {
    chunkLoading.value = false;
  }
};

const openEdit = async (row?: KbProblemVO) => {
  form.content = '';
  form.chunkIds = [];
  selectDocId.value = undefined;
  docChunkList.value = [];
  if (row) {
    editingId.value = row.problemId;
    const res = await getProblem(row.problemId);
    form.content = res.data.content;
    form.chunkIds = res.data.chunkIds ?? [];
  } else {
    editingId.value = undefined;
  }
  await loadDocuments();
  // 默认加载第一个可用文档的分段
  if (documents.value.length > 0) {
    selectDocId.value = documents.value[0].documentId;
    await loadDocChunks(selectDocId.value);
  }
  editVisible.value = true;
};

const submitEdit = () => {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    saving.value = true;
    try {
      const body: ProblemBody = {
        problemId: editingId.value,
        datasetId: props.datasetId,
        content: form.content,
        chunkIds: form.chunkIds
      };
      editingId.value ? await updateProblem(body) : await addProblem(body);
      modal.msgSuccess('已保存，问题向量已同步');
      editVisible.value = false;
      await loadProblems();
    } finally {
      saving.value = false;
    }
  });
};

const handleDelete = async (row: KbProblemVO) => {
  await modal.confirm(`删除问题"${row.content.slice(0, 30)}…"？（同步删除其向量）`);
  await delProblem(row.problemId);
  modal.msgSuccess('删除成功');
  await loadProblems();
};

onMounted(() => {
  loadProblems();
  loadDocuments();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-title {
  font-size: 15px;
  font-weight: 600;
}

.bind-box {
  width: 100%;

  .chunk-check-list {
    width: 100%;
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;

    .chunk-check-item {
      display: flex;
      align-items: flex-start;
      height: auto;

      :deep(.el-checkbox__label) {
        display: flex;
        flex-direction: column;
        line-height: 1.5;
      }

      .chunk-check-title {
        font-size: 13px;
        font-weight: 600;
      }

      .chunk-check-content {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}
</style>
