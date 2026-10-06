<template>
  <div class="p-2 app-container ai-kb-docs-page">
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <el-button icon="Back" link @click="emit('back')" />
            <span class="detail-title">{{ dataset?.datasetName }}</span>
            <el-tag v-if="dataset?.embedDim" type="info" size="small">维度 {{ dataset.embedDim }}</el-tag>
            <span v-if="stat" class="form-tip">
              文档 {{ stat.documentCount }} · 分段 {{ stat.chunkCount }} · 可用 {{ stat.availableCount }}
            </span>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['ai:kb:query']" plain icon="Search" @click="hitDrawerVisible = true">命中测试</el-button>
            <el-button v-hasPermi="['ai:kb:add']" type="primary" plain icon="Upload" @click="openUpload">上传文档</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="docLoading" border class="data-table" :data="documentList">
        <el-table-column label="文档名" align="left" prop="fileName" min-width="200" :show-overflow-tooltip="true" />
        <el-table-column label="大小" align="center" width="100">
          <template #default="scope">{{ formatSize(scope.row.fileSize) }}</template>
        </el-table-column>
        <el-table-column label="字符数" align="center" prop="charCount" width="100">
          <template #default="scope">{{ scope.row.charCount ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" align="center" width="110">
          <template #default="scope">
            <el-tag :type="statusType(scope.row.status)" size="small">
              <el-icon v-if="isProcessingStatus(scope.row.status)" class="is-loading" style="margin-right: 2px"><Loading /></el-icon>
              {{ statusLabel(scope.row.status) }}
            </el-tag>
            <el-tooltip v-if="scope.row.status === 'D' && scope.row.errorMsg" :content="scope.row.errorMsg" placement="top">
              <el-icon style="margin-left: 4px; color: var(--el-color-danger); vertical-align: middle"><WarningFilled /></el-icon>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="上传时间" align="center" prop="createTime" width="170">
          <template #default="scope">{{ parseTime(scope.row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" align="center" width="240" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-button v-hasPermi="['ai:kb:query']" link type="primary" icon="View" @click="emit('open-document', scope.row)">分段</el-button>
            <el-button
              v-if="scope.row.status === 'D'"
              v-hasPermi="['ai:kb:edit']"
              link
              type="warning"
              icon="RefreshRight"
              @click="handleRetry(scope.row)"
            >
              重试
            </el-button>
            <el-button
              v-if="scope.row.status === '4' || scope.row.status === 'D'"
              v-hasPermi="['ai:kb:edit']"
              link
              type="primary"
              icon="Refresh"
              @click="handleReingest(scope.row)"
            >
              重切
            </el-button>
            <el-button v-hasPermi="['ai:kb:remove']" link type="danger" icon="Delete" @click="handleDeleteDoc(scope.row)"></el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 上传文档向导（两步：上传文档 → 选择分段机制） -->
    <el-dialog v-model="uploadVisible" title="上传文档" width="640px" append-to-body :close-on-click-modal="false">
      <el-steps :active="uploadStep" align-center finish-status="success" style="margin-bottom: 18px">
        <el-step title="上传文档" />
        <el-step title="选择分段机制" />
      </el-steps>

      <!-- 第一步：选择文件 -->
      <div v-show="uploadStep === 0">
        <el-upload
          ref="uploadRef"
          drag
          multiple
          :auto-upload="false"
          :show-file-list="true"
          accept=".pdf,.docx,.xlsx,.md,.txt,.html"
          :on-change="handleFileChange"
          :file-list="fileList"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">拖拽文件到此处，或 <em>点击上传</em></div>
          <template #tip>
            <div class="el-upload__tip">支持 PDF / DOCX / XLSX / MD / TXT / HTML，单个文件 ≤ 100MB</div>
          </template>
        </el-upload>
      </div>

      <!-- 第二步：分段机制 -->
      <div v-show="uploadStep === 1">
        <el-radio-group v-model="chunkMode" style="margin-bottom: 12px">
          <el-radio value="smart">智能分段</el-radio>
          <el-radio value="advanced">高级分段</el-radio>
        </el-radio-group>
        <template v-if="chunkMode === 'smart'">
          <p class="form-tip" style="margin: 0 0 6px">
            按文档标题层级逐级下钻切分，表格与代码块完整保留（推荐）。
          </p>
          <el-checkbox v-model="semanticEnabled">启用语义断点检测（按句子向量相似度细分主题，更准但更慢）</el-checkbox>
        </template>
        <template v-else>
          <el-form label-width="110px" style="margin-top: 4px">
            <el-form-item label="分段最大长度">
              <el-input-number v-model="maxChars" :min="200" :max="2000" :step="50" controls-position="right" />
              <span class="form-tip" style="margin-left: 8px">字符（默认 700 ≈ 500 token）</span>
            </el-form-item>
            <el-form-item label="重叠字符比例">
              <el-input-number v-model="overlapRatio" :min="0" :max="0.5" :step="0.05" controls-position="right" />
              <span class="form-tip" style="margin-left: 8px">相邻分段重叠，避免语义被切断</span>
            </el-form-item>
          </el-form>
        </template>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button v-if="uploadStep === 0" @click="uploadVisible = false">取 消</el-button>
          <el-button v-if="uploadStep === 0" type="primary" :disabled="fileList.length === 0" @click="uploadStep = 1">
            下一步
          </el-button>
          <el-button v-if="uploadStep === 1" @click="uploadStep = 0">上一步</el-button>
          <el-button v-if="uploadStep === 1" type="primary" :loading="uploading" @click="submitUpload">
            开始上传（{{ fileList.length }} 个文件）
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 命中测试抽屉 -->
    <el-drawer v-model="hitDrawerVisible" title="命中测试" size="42%" append-to-body>
      <el-form :model="hitForm" label-width="80px">
        <el-form-item label="查询语句">
          <el-input v-model="hitForm.query" placeholder="输入问题，测试分段检索命中率" @keyup.enter="handleHitTest" />
        </el-form-item>
        <el-form-item label="返回条数">
          <el-input-number v-model="hitForm.topK" :min="1" :max="20" controls-position="right" />
          <el-checkbox v-model="hitForm.rerank" style="margin-left: 16px">启用重排</el-checkbox>
          <el-button type="primary" style="margin-left: 16px" :loading="hitTesting" @click="handleHitTest">测试</el-button>
        </el-form-item>
      </el-form>
      <div v-if="hitResults.length" class="hit-results">
        <div v-for="hit in hitResults" :key="hit.chunkId" class="hit-item">
          <div class="hit-head">
            <el-progress type="dashboard" :percentage="Math.round(hit.score * 100)" :width="46" :stroke-width="5" />
            <div class="hit-meta">
              <span class="hit-doc">{{ hit.documentName }} #{{ hit.seq }}</span>
              <span v-if="hit.headingPath" class="hit-path">{{ hit.headingPath }}</span>
            </div>
          </div>
          <div class="hit-content">{{ hit.content }}</div>
        </div>
      </div>
      <el-empty v-else-if="hitTested" description="无命中结果" :image-size="60" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import type { UploadFile, UploadUserFile } from 'element-plus';
import {
  datasetStat,
  delDocument,
  getDataset,
  hitTest,
  listDocument,
  reingestDocument,
  retryDocument,
  updateDataset,
  uploadDocument
} from '@/api/ai/knowledge';
import { DocumentStat, KbDatasetVO, KbDocumentVO, RetrievalHit, documentStatusMap, isProcessingStatus } from '@/api/ai/knowledge/types';
import modal from '@/plugins/modal';
import { parseTime } from '@/utils/zhiku';

const props = defineProps<{ datasetId: number | string }>();
const emit = defineEmits<{ (e: 'back'): void; (e: 'open-document', doc: KbDocumentVO): void }>();

const dataset = ref<KbDatasetVO>();
const stat = ref<DocumentStat>();
const documentList = ref<KbDocumentVO[]>([]);
const docLoading = ref(false);

const uploadVisible = ref(false);
const uploadStep = ref(0);
const uploading = ref(false);
const fileList = ref<UploadUserFile[]>([]);
const chunkMode = ref<'smart' | 'advanced'>('smart');
const semanticEnabled = ref(false);
const maxChars = ref(700);
const overlapRatio = ref(0.15);

const hitDrawerVisible = ref(false);
const hitTesting = ref(false);
const hitTested = ref(false);
const hitResults = ref<RetrievalHit[]>([]);
const hitForm = reactive({ query: '', topK: 5, rerank: false });

let pollTimer: ReturnType<typeof setInterval> | null = null;

const statusLabel = (status: string) => documentStatusMap[status]?.label ?? status;
const statusType = (status: string) => (documentStatusMap[status]?.type ?? 'info') as 'info' | 'primary' | 'warning' | 'success' | 'danger';

const formatSize = (size?: number) => {
  if (!size) return '-';
  if (size > 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB';
  if (size > 1024) return (size / 1024).toFixed(0) + ' KB';
  return size + ' B';
};

const loadDatasetInfo = async () => {
  const [dsRes, statRes] = await Promise.all([getDataset(props.datasetId), datasetStat(props.datasetId)]);
  dataset.value = dsRes.data;
  stat.value = statRes.data;
};

const loadDocuments = async () => {
  docLoading.value = true;
  try {
    const res = await listDocument(props.datasetId, { pageNum: 1, pageSize: 200 });
    documentList.value = res.data?.rows ?? [];
    schedulePoll();
  } finally {
    docLoading.value = false;
  }
};

/** 处理中文档 5 秒轮询，稳定后自动停止 */
const schedulePoll = () => {
  const processing = documentList.value.some(d => isProcessingStatus(d.status));
  if (processing && !pollTimer) {
    pollTimer = setInterval(async () => {
      const res = await listDocument(props.datasetId, { pageNum: 1, pageSize: 200 });
      documentList.value = res.data?.rows ?? [];
      const statRes = await datasetStat(props.datasetId);
      stat.value = statRes.data;
      if (!documentList.value.some(d => isProcessingStatus(d.status))) {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
      }
    }, 5000);
  } else if (!processing && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

/** 打开上传对话框：读取库当前分段规则回填 */
const openUpload = () => {
  fileList.value = [];
  const params = dataset.value?.chunkParams ? JSON.parse(dataset.value.chunkParams) : {};
  chunkMode.value = params.mode === 'structure_semantic' ? 'smart' : 'advanced';
  semanticEnabled.value = params.mode === 'structure_semantic';
  maxChars.value = params.maxChars ?? 700;
  overlapRatio.value = params.overlapRatio ?? 0.15;
  uploadStep.value = 0;
  uploadVisible.value = true;
};

const handleFileChange = (_file: UploadFile, list: UploadUserFile[]) => {
  fileList.value = list;
};

/** 组装当前分段规则的 chunkParams JSON */
const buildChunkParams = () => {
  return JSON.stringify({
    mode: chunkMode.value === 'smart' && semanticEnabled.value ? 'structure_semantic' : 'structure',
    maxChars: maxChars.value,
    overlapRatio: overlapRatio.value,
    semanticThreshold: 0.75
  });
};

/** 上传：规则有变化则先更新库配置，再逐个上传 */
const submitUpload = async () => {
  if (fileList.value.length === 0) {
    modal.msgWarning('请先选择文件');
    return;
  }
  uploading.value = true;
  try {
    const newParams = buildChunkParams();
    if (dataset.value && dataset.value.chunkParams !== newParams) {
      await updateDataset({
        datasetId: dataset.value.datasetId,
        datasetName: dataset.value.datasetName,
        description: dataset.value.description,
        embedModelId: dataset.value.embedModelId,
        status: dataset.value.status,
        chunkParams: newParams
      });
    }
    for (const f of fileList.value) {
      if (f.raw) {
        await uploadDocument(props.datasetId, f.raw);
      }
    }
    modal.msgSuccess(`已上传 ${fileList.value.length} 个文档，解析入库已开始`);
    uploadVisible.value = false;
    uploadStep.value = 0;
    await loadDocuments();
  } finally {
    uploading.value = false;
  }
};

const handleRetry = async (doc: KbDocumentVO) => {
  await modal.confirm(`重新处理文档"${doc.fileName}"？`);
  await retryDocument(doc.documentId);
  modal.msgSuccess('已重新发起入库');
  await loadDocuments();
};

const handleReingest = async (doc: KbDocumentVO) => {
  await modal.confirm(`按当前分段规则重新切分"${doc.fileName}"？（旧分段与向量将被清理）`);
  await reingestDocument(doc.documentId);
  modal.msgSuccess('已重新发起入库');
  await loadDocuments();
};

const handleDeleteDoc = async (doc: KbDocumentVO) => {
  await modal.confirm(`删除文档"${doc.fileName}"？（分段与向量将一并清理）`);
  await delDocument(doc.documentId);
  modal.msgSuccess('删除成功');
  await loadDocuments();
};

const handleHitTest = async () => {
  if (!hitForm.query.trim()) {
    modal.msgWarning('请输入查询语句');
    return;
  }
  hitTesting.value = true;
  hitTested.value = true;
  try {
    const res = await hitTest(props.datasetId, { ...hitForm });
    hitResults.value = res.data ?? [];
  } finally {
    hitTesting.value = false;
  }
};

onMounted(() => {
  loadDatasetInfo();
  loadDocuments();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
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

.hit-results {
  max-height: calc(100vh - 260px);
  overflow-y: auto;
}

.hit-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;

  .hit-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;

    .hit-meta {
      display: flex;
      flex-direction: column;

      .hit-doc {
        font-size: 13px;
        font-weight: 600;
      }

      .hit-path {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }

  .hit-content {
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 140px;
    overflow-y: auto;
  }
}
</style>
