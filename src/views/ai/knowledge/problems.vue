<template>
  <div class="app-container kb-problems-page">
    <!-- 左：问题列表 -->
    <div class="problem-panel">
      <div class="panel-head">
        <span class="panel-title">问题（{{ problems.length }}）</span>
        <el-button v-hasPermi="['ai:kb:add']" type="primary" size="small" icon="Plus" @click="openAdd">添加问题</el-button>
      </div>
      <div class="panel-toolbar">
        <el-input v-model="keyword" placeholder="搜索问题" clearable size="small" @change="loadProblems">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>
      <div v-loading="loading" class="problem-items">
        <el-empty v-if="!loading && problems.length === 0" description="暂无问题，点击右上角添加" :image-size="70" />
        <div
          v-for="(p, i) in problems"
          :key="p.problemId"
          class="problem-item"
          :class="{ 'is-active': selectedProblem?.problemId === p.problemId }"
          @click="selectProblem(p)"
        >
          <span class="problem-num">{{ i + 1 }}.</span>
          <span class="problem-content" :title="p.content">{{ p.content }}</span>
          <!-- 阻断冒泡：操作不触发行选中 -->
          <span class="problem-actions" @click.stop>
            <el-tooltip content="关联分段" placement="top">
              <el-button v-hasPermi="['ai:kb:edit']" link type="primary" icon="Link" size="small" @click="openBind(p)" />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ai:kb:remove']" link type="danger" icon="Delete" size="small" @click="handleDelete(p)" />
            </el-tooltip>
          </span>
        </div>
      </div>
    </div>

    <!-- 右：关联分段（选中问题的绑定列表） -->
    <div class="bound-panel">
      <div class="panel-head">
        <span class="panel-title">关联分段</span>
        <span v-if="selectedProblem" class="form-tip">共 {{ boundChunks.length }} 段 · 点击解绑可移除</span>
      </div>
      <div v-loading="boundLoading" class="bound-list">
        <el-empty v-if="!selectedProblem" description="点击左侧问题，查看其关联的分段" :image-size="80" />
        <el-empty v-else-if="!boundLoading && boundChunks.length === 0" description="该问题尚未关联分段，点击「关联分段」绑定" :image-size="80" />
        <div v-for="chunk in boundChunks" :key="chunk.chunkId" class="bound-card">
          <div class="bound-content">{{ chunk.content }}</div>
          <div class="bound-foot">
            <span class="bound-doc">
              <el-icon><Document /></el-icon>
              {{ chunk.documentName }}<template v-if="chunk.title"> · {{ chunk.title }}</template> · #{{ chunk.seq }}
            </span>
            <el-button v-hasPermi="['ai:kb:edit']" link type="danger" size="small" @click="handleUnbind(chunk)">解绑</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加问题（一行一个问题，批量创建） -->
    <el-dialog v-model="addVisible" title="添加问题" width="560px" append-to-body :close-on-click-modal="false">
      <el-input
        v-model="addContent"
        type="textarea"
        :rows="8"
        placeholder="一行一个问题，支持批量添加：&#10;例如：&#10;防火墙怎么打开&#10;如何安装面板&#10;忘记密码怎么办"
        maxlength="5000"
      />
      <div class="form-tip" style="margin-top: 8px">共 {{ addCount }} 个问题，保存后逐条向量化参与检索</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="saving" :disabled="addCount === 0" @click="submitAdd">保 存</el-button>
          <el-button @click="addVisible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 关联分段（左：文档列表分页搜索 + 绑定数圆点；右：分块分页搜索 + 点击绑定/取消） -->
    <el-dialog v-model="bindVisible" :title="`关联分段 - ${bindProblem?.content?.slice(0, 20)}${bindProblem && bindProblem.content.length > 20 ? '…' : ''}`" width="960px" append-to-body :close-on-click-modal="false" destroy-on-close>
      <div class="bind-layout">
        <!-- 左：文档列表 -->
        <div class="bind-left">
          <el-input v-model="docKeyword" placeholder="搜索文档名称" clearable size="small" @change="resetDocs">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div class="bind-scroll" @scroll="onDocScroll">
            <el-empty v-if="docTotal === 0 && !docLoading" description="无文档" :image-size="50" />
            <div
              v-for="doc in docList"
              :key="doc.documentId"
              class="bind-doc-item"
              :class="{ 'is-active': doc.documentId === bindDocId, 'is-bound': boundDocCount(doc.documentId) > 0 }"
              @click="selectBindDoc(doc)"
            >
              <el-icon class="bind-doc-icon"><Document /></el-icon>
              <span class="bind-doc-name" :title="doc.fileName">{{ doc.fileName }}</span>
              <span v-if="boundDocCount(doc.documentId) > 0" class="bind-count-badge">{{ boundDocCount(doc.documentId) }}</span>
            </div>
            <div v-if="docLoading" class="bind-loading-row"><el-icon class="is-loading"><Loading /></el-icon> 加载中…</div>
            <div v-else-if="docList.length >= docTotal && docTotal > 0" class="bind-loading-row form-tip">共 {{ docTotal }} 个文档</div>
          </div>
        </div>

        <!-- 右：分块列表 -->
        <div class="bind-right">
          <el-input v-model="chunkKeyword" placeholder="检索分块" clearable size="small" @change="resetChunks">
            <template #prepend>
              <el-select v-model="searchType" style="width: 76px" @change="resetChunks">
                <el-option label="内容" value="content" />
                <el-option label="标题" value="title" />
              </el-select>
            </template>
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div class="bind-scroll" @scroll="onChunkScroll">
            <el-empty v-if="chunkTotal === 0 && !chunkLoading" description="无分块" :image-size="50" />
            <div
              v-for="chunk in chunkList"
              :key="chunk.chunkId"
              class="bind-chunk-item"
              :class="{ 'is-bound': boundChunkIdSet.has(chunk.chunkId) }"
              @click="toggleBind(chunk)"
            >
              <el-icon class="bind-check">
                <CircleCheckFilled v-if="boundChunkIdSet.has(chunk.chunkId)" />
                <CirclePlus v-else />
              </el-icon>
              <div class="bind-chunk-body">
                <div class="bind-chunk-title">#{{ chunk.seq }} {{ chunk.title || chunk.headingPath || '（无标题）' }}</div>
                <div class="bind-chunk-content">{{ chunk.content }}</div>
              </div>
            </div>
            <div v-if="chunkLoading" class="bind-loading-row"><el-icon class="is-loading"><Loading /></el-icon> 加载中…</div>
            <div v-else-if="chunkList.length >= chunkTotal && chunkTotal > 0" class="bind-loading-row form-tip">共 {{ chunkTotal }} 块</div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <span class="form-tip" style="margin-right: auto">已绑定 {{ boundChunkIdSet.size }} 段（点击分块绑定/取消）</span>
          <el-button type="primary" @click="bindVisible = false">完 成</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  addProblem,
  bindProblemChunks,
  delProblem,
  listDocument,
  listProblem,
  pageDocumentChunks,
  problemChunks,
  unbindProblemChunks
} from '@/api/ai/knowledge';
import { KbChunkVO, KbDocumentVO, KbProblemChunkVO, KbProblemVO } from '@/api/ai/knowledge/types';
import modal from '@/plugins/modal';

const props = defineProps<{ datasetId: number | string }>();

const problems = ref<KbProblemVO[]>([]);
const loading = ref(false);
const keyword = ref('');
const selectedProblem = ref<KbProblemVO | undefined>(undefined);
const boundChunks = ref<KbProblemChunkVO[]>([]);
const boundLoading = ref(false);

const addVisible = ref(false);
const addContent = ref('');
const saving = ref(false);

const bindVisible = ref(false);
const bindProblem = ref<KbProblemVO | undefined>(undefined);
/** 当前绑定弹窗的已绑分段（带文档归属，用于圆点计数） */
const bindBoundChunks = ref<KbProblemChunkVO[]>([]);
const boundChunkIdSet = computed(() => new Set(bindBoundChunks.value.map(c => c.chunkId)));

const docList = ref<KbDocumentVO[]>([]);
const docTotal = ref(0);
const docPage = ref(1);
const docKeyword = ref('');
const docLoading = ref(false);
const bindDocId = ref<number | string | undefined>(undefined);

const chunkList = ref<KbChunkVO[]>([]);
const chunkTotal = ref(0);
const chunkPage = ref(1);
const chunkKeyword = ref('');
const searchType = ref<'title' | 'content'>('content');
const chunkLoading = ref(false);

const DOC_PAGE_SIZE = 20;
const CHUNK_PAGE_SIZE = 20;

const addCount = computed(() =>
  addContent.value
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean).length
);

const boundDocCount = (documentId: number | string) =>
  bindBoundChunks.value.filter(c => c.documentId === documentId).length;

/** —— 问题列表 —— */
const loadProblems = async () => {
  loading.value = true;
  try {
    const res = await listProblem(props.datasetId, keyword.value);
    problems.value = res.data ?? [];
    // 选中项被删后清空右侧
    if (selectedProblem.value && !problems.value.some(p => p.problemId === selectedProblem.value!.problemId)) {
      selectedProblem.value = undefined;
      boundChunks.value = [];
    }
  } finally {
    loading.value = false;
  }
};

const selectProblem = async (p: KbProblemVO) => {
  selectedProblem.value = p;
  await loadBoundChunks();
};

const loadBoundChunks = async () => {
  if (!selectedProblem.value) return;
  boundLoading.value = true;
  try {
    const res = await problemChunks(selectedProblem.value.problemId);
    boundChunks.value = res.data ?? [];
  } finally {
    boundLoading.value = false;
  }
};

/** —— 添加问题（批量多行） —— */
const openAdd = () => {
  addContent.value = '';
  addVisible.value = true;
};

const submitAdd = async () => {
  saving.value = true;
  try {
    const res = await addProblem(props.datasetId, addContent.value);
    modal.msgSuccess(`已添加 ${res.data} 个问题`);
    addVisible.value = false;
    await loadProblems();
  } finally {
    saving.value = false;
  }
};

const handleDelete = async (p: KbProblemVO) => {
  await modal.confirm(`删除问题"${p.content.slice(0, 30)}${p.content.length > 30 ? '…' : ''}"？（同步删除其向量与关联）`);
  await delProblem(p.problemId);
  modal.msgSuccess('删除成功');
  await loadProblems();
};

/** —— 关联分段弹窗 —— */
const openBind = async (p: KbProblemVO) => {
  bindProblem.value = p;
  const res = await problemChunks(p.problemId);
  bindBoundChunks.value = res.data ?? [];
  docKeyword.value = '';
  chunkKeyword.value = '';
  searchType.value = 'content';
  docList.value = [];
  docTotal.value = 0;
  docPage.value = 1;
  chunkList.value = [];
  chunkTotal.value = 0;
  chunkPage.value = 1;
  bindVisible.value = true;
  await loadDocs();
  // 默认选中第一个文档并加载其分块
  if (docList.value.length > 0) {
    selectBindDoc(docList.value[0]);
  }
};

/** —— 左侧文档分页 —— */
const loadDocs = async () => {
  docLoading.value = true;
  try {
    const res = await listDocument(props.datasetId, {
      pageNum: docPage.value,
      pageSize: DOC_PAGE_SIZE,
      fileName: docKeyword.value || undefined
    } as never);
    const rows = res.data?.rows ?? [];
    docList.value = docPage.value === 1 ? rows : [...docList.value, ...rows];
    docTotal.value = res.data?.total ?? 0;
  } finally {
    docLoading.value = false;
  }
};

const resetDocs = async () => {
  docPage.value = 1;
  await loadDocs();
  if (docList.value.length > 0 && !docList.value.some(d => d.documentId === bindDocId.value)) {
    selectBindDoc(docList.value[0]);
  } else if (docList.value.length === 0) {
    bindDocId.value = undefined;
    chunkList.value = [];
    chunkTotal.value = 0;
  }
};

const onDocScroll = (e: Event) => {
  const el = e.target as HTMLElement;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4 && !docLoading.value && docList.value.length < docTotal.value) {
    docPage.value++;
    loadDocs();
  }
};

/** —— 右侧分块分页 —— */
const selectBindDoc = (doc: KbDocumentVO) => {
  bindDocId.value = doc.documentId;
  chunkPage.value = 1;
  chunkList.value = [];
  loadChunks();
};

const loadChunks = async () => {
  if (!bindDocId.value) return;
  chunkLoading.value = true;
  try {
    const res = await pageDocumentChunks(bindDocId.value, {
      pageNum: chunkPage.value,
      pageSize: CHUNK_PAGE_SIZE,
      searchType: searchType.value,
      keyword: chunkKeyword.value || undefined
    });
    const rows = res.data?.rows ?? [];
    chunkList.value = chunkPage.value === 1 ? rows : [...chunkList.value, ...rows];
    chunkTotal.value = res.data?.total ?? 0;
  } finally {
    chunkLoading.value = false;
  }
};

const resetChunks = () => {
  chunkPage.value = 1;
  loadChunks();
};

const onChunkScroll = (e: Event) => {
  const el = e.target as HTMLElement;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4 && !chunkLoading.value && chunkList.value.length < chunkTotal.value) {
    chunkPage.value++;
    loadChunks();
  }
};

/** —— 绑定/解绑切换（弹窗内） —— */
const toggleBind = async (chunk: KbChunkVO) => {
  if (!bindProblem.value) return;
  const problemId = bindProblem.value.problemId;
  if (boundChunkIdSet.value.has(chunk.chunkId)) {
    await unbindProblemChunks(problemId, [chunk.chunkId]);
    bindBoundChunks.value = bindBoundChunks.value.filter(c => c.chunkId !== chunk.chunkId);
    modal.msgSuccess('已取消关联');
  } else {
    await bindProblemChunks(problemId, [chunk.chunkId]);
    bindBoundChunks.value.push({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentName: docList.value.find(d => d.documentId === chunk.documentId)?.fileName ?? '',
      title: chunk.title,
      content: chunk.content,
      seq: chunk.seq,
      charCount: chunk.charCount
    });
    modal.msgSuccess('已关联');
  }
  await loadProblems();
};

/** —— 右侧面板解绑 —— */
const handleUnbind = async (chunk: KbProblemChunkVO) => {
  if (!selectedProblem.value) return;
  await unbindProblemChunks(selectedProblem.value.problemId, [chunk.chunkId]);
  modal.msgSuccess('已解绑');
  await Promise.all([loadBoundChunks(), loadProblems()]);
};

onMounted(() => {
  loadProblems();
});
</script>

<style lang="scss" scoped>
.kb-problems-page {
  display: flex;
  flex-direction: row !important;
  gap: 12px;
  height: calc(100vh - 84px);
  padding: 8px;

  .form-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.problem-panel,
.bound-panel {
  flex: 1;
  min-width: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.problem-panel {
  flex: 0 0 42%;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  .panel-title {
    font-size: 14px;
    font-weight: 600;
  }
}

.panel-toolbar {
  padding: 8px 14px 0;
}

.problem-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
}

.problem-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
  margin-bottom: 4px;

  &:hover {
    background: var(--el-fill-color-light);

    .problem-actions {
      opacity: 1;
    }
  }

  &.is-active {
    background: var(--el-color-primary-light-9);
  }

  .problem-num {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    flex-shrink: 0;
  }

  .problem-content {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .problem-actions {
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }
}

.bound-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
}

.bound-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  .bound-content {
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 140px;
    overflow-y: auto;
  }

  .bound-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-extra-light);

    .bound-doc {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

/* ===== 关联分段弹窗 ===== */
.bind-layout {
  display: flex;
  gap: 12px;
  height: 480px;

  .bind-left,
  .bind-right {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bind-left {
    flex: 0 0 36%;
  }

  .bind-scroll {
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    padding: 6px;
  }
}

.bind-doc-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
  margin-bottom: 2px;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.is-active {
    background: var(--el-color-primary-light-9);
  }

  .bind-doc-icon {
    color: var(--el-color-primary);
    flex-shrink: 0;
  }

  .bind-doc-name {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bind-count-badge {
    flex-shrink: 0;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--el-color-primary);
    color: #fff;
    font-size: 11px;
    line-height: 18px;
    text-align: center;
  }
}

.bind-chunk-item {
  display: flex;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 8px;
  transition: all 0.15s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  &.is-bound {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .bind-check {
    flex-shrink: 0;
    font-size: 18px;
    color: var(--el-color-placeholder);
    margin-top: 2px;
  }

  &.is-bound .bind-check {
    color: var(--el-color-primary);
  }

  .bind-chunk-body {
    flex: 1;
    min-width: 0;

    .bind-chunk-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bind-chunk-content {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}

.bind-loading-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
