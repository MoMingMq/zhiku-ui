<template>
  <div class="kb-detail-wrap">
    <!-- 顶部：返回 + 库名 + 统计 + 命中测试 -->
    <el-card shadow="hover" class="detail-header">
      <div class="detail-header-body">
        <el-button icon="Back" link @click="handleBack">返回列表</el-button>
        <span class="detail-title">{{ dataset?.datasetName }}</span>
        <el-tag v-if="dataset?.embedDim" type="info" size="small">维度 {{ dataset.embedDim }}</el-tag>
        <span v-if="stat" class="detail-stat">
          文档 {{ stat.documentCount }} · 分块 {{ stat.chunkCount }} · 可用 {{ stat.availableCount }}
        </span>
        <div class="detail-header-actions">
          <el-button plain icon="Scale" @click="hitDialogVisible = true">命中测试</el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="12" class="detail-body">
      <!-- 左：文档列表 -->
      <el-col :span="8" class="doc-col">
        <el-card shadow="hover" class="doc-panel">
          <template #header>
            <div class="panel-heading">
              <div>
                <span class="panel-kicker">Documents</span>
                <h3>文档目录</h3>
              </div>
              <el-upload
                v-hasPermi="['ai:kb:add']"
                :show-file-list="false"
                accept=".pdf,.docx,.xlsx,.md,.txt,.html"
                :http-request="handleUpload"
              >
                <el-button type="primary" size="small" icon="Upload" :loading="uploading">上传文档</el-button>
              </el-upload>
            </div>
          </template>
          <div v-loading="docLoading" class="doc-list">
            <el-empty v-if="documentList.length === 0" description="暂无文档，点击右上角上传" :image-size="80" />
            <div
              v-for="doc in documentList"
              :key="doc.documentId"
              class="doc-item"
              :class="{ 'is-active': doc.documentId === selectedDocumentId }"
              @click="selectDocument(doc)"
            >
              <div class="doc-item-main">
                <el-icon class="doc-icon"><Document /></el-icon>
                <div class="doc-meta">
                  <span class="doc-name" :title="doc.fileName">{{ doc.fileName }}</span>
                  <span class="doc-sub">
                    {{ formatSize(doc.fileSize) }}
                    <template v-if="doc.charCount"> · {{ doc.charCount }} 字符</template>
                  </span>
                  <span v-if="doc.status === 'D' && doc.errorMsg" class="doc-error" :title="doc.errorMsg">
                    {{ doc.errorMsg }}
                  </span>
                </div>
                <el-tag :type="statusType(doc.status)" size="small" class="doc-status">
                  {{ statusLabel(doc.status) }}
                </el-tag>
              </div>
              <div class="doc-actions">
                <el-button
                  v-if="doc.status === 'D'"
                  v-hasPermi="['ai:kb:edit']"
                  link
                  type="warning"
                  size="small"
                  icon="RefreshRight"
                  @click.stop="handleRetry(doc)"
                >
                  重试
                </el-button>
                <el-button
                  v-if="doc.status === '4' || doc.status === 'D'"
                  v-hasPermi="['ai:kb:edit']"
                  link
                  type="primary"
                  size="small"
                  icon="Refresh"
                  @click.stop="handleReingest(doc)"
                >
                  重切
                </el-button>
                <el-button
                  v-hasPermi="['ai:kb:remove']"
                  link
                  type="danger"
                  size="small"
                  icon="Delete"
                  @click.stop="handleDeleteDoc(doc)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右：分块列表 -->
      <el-col :span="16" class="chunk-col">
        <el-card shadow="hover" class="chunk-panel">
          <template #header>
            <div class="panel-heading">
              <div>
                <span class="panel-kicker">Chunks</span>
                <h3>分块内容{{ selectedDoc ? `：${selectedDoc.fileName}` : '' }}</h3>
              </div>
              <span v-if="chunkList.length" class="form-tip">共 {{ chunkList.length }} 块</span>
            </div>
          </template>
          <div v-loading="chunkLoading" class="chunk-list">
            <el-empty v-if="!selectedDocumentId" description="左侧选择文档查看分块" :image-size="80" />
            <el-empty v-else-if="chunkList.length === 0" description="该文档暂无分块" :image-size="80" />
            <div v-for="chunk in chunkList" :key="chunk.chunkId" class="chunk-item" :class="{ 'is-disabled': chunk.disabled === '1' }">
              <div class="chunk-head">
                <span class="chunk-seq">#{{ chunk.seq }}</span>
                <span v-if="chunk.headingPath" class="chunk-path" :title="chunk.headingPath">
                  <el-icon><Guide /></el-icon>{{ chunk.headingPath }}
                </span>
                <el-tag size="small" type="info">{{ chunk.strategyTag }}</el-tag>
                <el-tag size="small" type="info" class="chunk-chars">{{ chunk.charCount }} 字</el-tag>
                <div class="chunk-actions">
                  <el-tooltip :content="chunk.disabled === '1' ? '已禁用（不参与检索）' : '参与检索'" placement="top">
                    <el-switch
                      :model-value="chunk.disabled === '1'"
                      inline-prompt
                      active-text="禁用"
                      inactive-text="启用"
                      @change="(val: string | number | boolean) => handleChunkToggle(chunk, Boolean(val))"
                    />
                  </el-tooltip>
                </div>
              </div>
              <div class="chunk-content">{{ chunk.content }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 命中测试对话框 -->
    <el-dialog v-model="hitDialogVisible" title="检索命中测试" width="720px" append-to-body>
      <el-form :model="hitForm" label-width="80px">
        <el-form-item label="查询语句">
          <el-input v-model="hitForm.query" placeholder="输入问题测试检索质量" @keyup.enter="handleHitTest" />
        </el-form-item>
        <el-form-item label="返回条数">
          <el-input-number v-model="hitForm.topK" :min="1" :max="20" controls-position="right" />
          <el-checkbox v-model="hitForm.rerank" style="margin-left: 16px">启用重排（Rerank）</el-checkbox>
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
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  changeChunkDisabled,
  datasetStat,
  delDocument,
  documentChunks,
  getDataset,
  hitTest,
  listDocument,
  reingestDocument,
  retryDocument,
  uploadDocument
} from '@/api/ai/knowledge';
import {
  DocumentStat,
  KbChunkVO,
  KbDatasetVO,
  KbDocumentVO,
  RetrievalHit,
  documentStatusMap,
  isProcessingStatus
} from '@/api/ai/knowledge/types';
import modal from '@/plugins/modal';

const props = defineProps<{ datasetId: number | string }>();
const emit = defineEmits<{ (e: 'back'): void }>();

const dataset = ref<KbDatasetVO>();
const stat = ref<DocumentStat>();
const documentList = ref<KbDocumentVO[]>([]);
const chunkList = ref<KbChunkVO[]>([]);
const selectedDocumentId = ref<number | string | undefined>(undefined);
const selectedDoc = computed(() => documentList.value.find(d => d.documentId === selectedDocumentId.value));
const docLoading = ref(false);
const chunkLoading = ref(false);
const uploading = ref(false);
const hitDialogVisible = ref(false);
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

/** 加载库名与统计 */
const loadDatasetInfo = async () => {
  const [dsRes, statRes] = await Promise.all([getDataset(props.datasetId), datasetStat(props.datasetId)]);
  dataset.value = dsRes.data;
  stat.value = statRes.data;
};

/** 加载文档列表（存在处理中状态时启动轮询） */
const loadDocuments = async () => {
  docLoading.value = true;
  try {
    const res = await listDocument(props.datasetId, { pageNum: 1, pageSize: 100 });
    documentList.value = res.data?.rows ?? [];
    schedulePoll();
    if (selectedDocumentId.value) {
      const current = documentList.value.find(d => d.documentId === selectedDocumentId.value);
      // 选中文档状态变化时刷新右侧分块
      if (current && current.status === '4' && chunkList.value.length === 0) {
        await loadChunks(current.documentId);
      }
    }
  } finally {
    docLoading.value = false;
  }
};

/** 处理中文档 5 秒轮询；全部稳定即停止 */
const schedulePoll = () => {
  const processing = documentList.value.some(d => isProcessingStatus(d.status));
  if (processing && !pollTimer) {
    pollTimer = setInterval(async () => {
      const res = await listDocument(props.datasetId, { pageNum: 1, pageSize: 100 });
      const before = JSON.stringify(documentList.value.map(d => [d.documentId, d.status]));
      documentList.value = res.data?.rows ?? [];
      const after = JSON.stringify(documentList.value.map(d => [d.documentId, d.status]));
      if (before !== after) {
        const statRes = await datasetStat(props.datasetId);
        stat.value = statRes.data;
      }
      if (!documentList.value.some(d => isProcessingStatus(d.status))) {
        stopPoll();
      }
    }, 5000);
  } else if (!processing) {
    stopPoll();
  }
};

const stopPoll = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

/** 选中文档 → 加载分块 */
const selectDocument = async (doc: KbDocumentVO) => {
  selectedDocumentId.value = doc.documentId;
  await loadChunks(doc.documentId);
};

const loadChunks = async (documentId: number | string) => {
  chunkLoading.value = true;
  try {
    const res = await documentChunks(documentId);
    chunkList.value = res.data ?? [];
  } finally {
    chunkLoading.value = false;
  }
};

/** 上传文档 */
const handleUpload = async (options: { file: File }) => {
  uploading.value = true;
  try {
    await uploadDocument(props.datasetId, options.file);
    modal.msgSuccess('上传成功，已开始解析入库');
    await loadDocuments();
  } finally {
    uploading.value = false;
  }
};

/** 重试失败文档 */
const handleRetry = async (doc: KbDocumentVO) => {
  await modal.confirm(`重新处理文档"${doc.fileName}"？`);
  await retryDocument(doc.documentId);
  modal.msgSuccess('已重新发起入库');
  await loadDocuments();
};

/** 重切文档 */
const handleReingest = async (doc: KbDocumentVO) => {
  await modal.confirm(`按当前分块策略重新切分并入库"${doc.fileName}"？（旧分块与向量将被清理）`);
  await reingestDocument(doc.documentId);
  modal.msgSuccess('已重新发起入库');
  chunkList.value = [];
  await loadDocuments();
};

/** 删除文档 */
const handleDeleteDoc = async (doc: KbDocumentVO) => {
  await modal.confirm(`删除文档"${doc.fileName}"？（分块与向量将一并清理）`);
  await delDocument(doc.documentId);
  if (selectedDocumentId.value === doc.documentId) {
    selectedDocumentId.value = undefined;
    chunkList.value = [];
  }
  modal.msgSuccess('删除成功');
  await loadDocuments();
  const statRes = await datasetStat(props.datasetId);
  stat.value = statRes.data;
};

/** 分块禁用切换 */
const handleChunkToggle = async (chunk: KbChunkVO, disabled: boolean) => {
  await changeChunkDisabled(chunk.chunkId, disabled);
  chunk.disabled = disabled ? '1' : '0';
  modal.msgSuccess(disabled ? '已禁用，该分块不再参与检索' : '已启用');
};

/** 命中测试 */
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

const handleBack = () => {
  stopPoll();
  emit('back');
};

onMounted(() => {
  loadDatasetInfo();
  loadDocuments();
});

onUnmounted(() => {
  stopPoll();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.content-stack;

.kb-detail-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-header-body {
  display: flex;
  align-items: center;
  gap: 12px;

  .detail-title {
    font-size: 16px;
    font-weight: 600;
  }

  .detail-stat {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .detail-header-actions {
    margin-left: auto;
  }
}

.doc-list {
  min-height: 300px;
}

.doc-item {
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &.is-active {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }

  .doc-item-main {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .doc-icon {
    color: var(--el-color-primary);
  }

  .doc-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    .doc-name {
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .doc-sub,
    .doc-error {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .doc-error {
      color: var(--el-color-danger);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.doc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 4px;
}

.chunk-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;

  &.is-disabled {
    opacity: 0.55;
    background-color: var(--el-fill-color-lighter);
  }

  .chunk-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;

    .chunk-seq {
      font-weight: 600;
      color: var(--el-color-primary);
    }

    .chunk-path {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chunk-actions {
      margin-left: auto;
    }
  }

  .chunk-content {
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 180px;
    overflow-y: auto;
  }
}

.hit-results {
  max-height: 420px;
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
