<template>
  <div class="kb-problems-page">
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="detail-title">问题管理</span>
            <span class="form-tip">问题文本向量化参与检索：命中问题后自动展开到其绑定的分段（共 {{ problems.length }} 条）</span>
          </div>
          <div class="toolbar-actions">
            <el-input v-model="keyword" placeholder="搜索问题" clearable style="width: 200px" @change="loadProblems">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button v-hasPermi="['ai:kb:add']" type="primary" plain icon="Plus" @click="openAdd">添加问题</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="problems" @row-click="openDrawer">
        <el-table-column label="编号" align="center" width="70" type="index" />
        <el-table-column label="问题" align="left" prop="content" min-width="300" :show-overflow-tooltip="true" />
        <el-table-column label="关联分段" align="center" width="100">
          <template #default="scope">
            <el-tag size="small" :type="scope.row.chunkCount > 0 ? 'primary' : 'info'">{{ scope.row.chunkCount ?? 0 }} 段</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="170">
          <template #default="scope">{{ parseTime(scope.row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" align="center" width="160" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="关联分段" placement="top">
              <el-button v-hasPermi="['ai:kb:edit']" link type="primary" icon="Link" @click.stop="openBind(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ai:kb:remove']" link type="danger" icon="Delete" @click.stop="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

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

    <!-- 问题详情抽屉（点击行：展示关联分块，可解绑） -->
    <el-drawer v-model="drawerVisible" :title="drawerTitle" size="46%" append-to-body>
      <div v-loading="drawerLoading" class="drawer-chunk-list">
        <el-empty v-if="!drawerLoading && drawerChunks.length === 0" description="该问题尚未关联分段，点击操作列「关联分段」绑定" :image-size="80" />
        <div v-for="chunk in drawerChunks" :key="chunk.chunkId" class="drawer-chunk-card">
          <div class="drawer-chunk-content">{{ chunk.content }}</div>
          <div class="drawer-chunk-foot">
            <span class="drawer-chunk-doc">
              <el-icon><Document /></el-icon>
              {{ chunk.documentName }}<template v-if="chunk.title"> · {{ chunk.title }}</template> · #{{ chunk.seq }}
            </span>
            <el-button v-hasPermi="['ai:kb:edit']" link type="danger" size="small" @click="handleUnbind(chunk)">解绑</el-button>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 关联分段弹窗（左：文档列表分页搜索 + 绑定数圆点；右：分块分页搜索 + 点击绑定/取消） -->
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
              :class="{ 'is-active': doc.documentId === bindDocId }"
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
          <el-button type="primary" @click="closeBind">完 成</el-button>
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
import { parseTime } from '@/utils/zhiku';

const props = defineProps<{ datasetId: number | string }>();

const problems = ref<KbProblemVO[]>([]);
const loading = ref(false);
const keyword = ref('');

const addVisible = ref(false);
const addContent = ref('');
const saving = ref(false);

/** 抽屉（点行） */
const drawerVisible = ref(false);
const drawerLoading = ref(false);
const drawerProblem = ref<KbProblemVO | undefined>(undefined);
const drawerChunks = ref<KbProblemChunkVO[]>([]);
const drawerTitle = computed(() =>
  drawerProblem.value ? `问题详情 - ${drawerProblem.value.content.slice(0, 24)}${drawerProblem.value.content.length > 24 ? '…' : ''}` : '问题详情'
);

/** 绑定弹窗 */
const bindVisible = ref(false);
const bindProblem = ref<KbProblemVO | undefined>(undefined);
/** 当前绑定弹窗的已绑分段（带文档归属，用于圆点计数与切换态） */
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
  } finally {
    loading.value = false;
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

/** —— 抽屉（点击行） —— */
const openDrawer = async (row: KbProblemVO) => {
  drawerProblem.value = row;
  drawerVisible.value = true;
  drawerLoading.value = true;
  try {
    const res = await problemChunks(row.problemId);
    drawerChunks.value = res.data ?? [];
  } finally {
    drawerLoading.value = false;
  }
};

const handleUnbind = async (chunk: KbProblemChunkVO) => {
  if (!drawerProblem.value) return;
  await unbindProblemChunks(drawerProblem.value.problemId, [chunk.chunkId]);
  modal.msgSuccess('已解绑');
  await Promise.all([openDrawerRefresh(), loadProblems()]);
};

const openDrawerRefresh = async () => {
  if (!drawerProblem.value) return;
  const res = await problemChunks(drawerProblem.value.problemId);
  drawerChunks.value = res.data ?? [];
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

const closeBind = async () => {
  bindVisible.value = false;
  await loadProblems();
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
};

onMounted(() => {
  loadProblems();
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

:deep(.el-table__row) {
  cursor: pointer;
}

/* ===== 抽屉 ===== */
.drawer-chunk-list {
  min-height: 200px;
}

.drawer-chunk-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  .drawer-chunk-content {
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 140px;
    overflow-y: auto;
  }

  .drawer-chunk-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-extra-light);

    .drawer-chunk-doc {
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
    background: var(--el-fill-color);
    box-shadow: inset 3px 0 0 var(--el-color-primary);

    .bind-doc-name {
      color: var(--el-color-primary);
      font-weight: 600;
    }
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
    background: var(--el-fill-color);

    .bind-chunk-title {
      color: var(--el-color-primary);
    }
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
