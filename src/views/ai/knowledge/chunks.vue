<template>
  <div class="app-container ai-kb-chunks-page">
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <el-button icon="Back" link @click="emit('back')" />
            <span class="detail-title">{{ document.fileName }}</span>
            <el-tag :type="statusType(document.status)" size="small">{{ statusLabel(document.status) }}</el-tag>
            <span v-if="document.charCount" class="form-tip">{{ document.charCount }} 字符 · 共 {{ chunkList.length }} 段</span>
          </div>
          <div class="toolbar-actions">
            <el-input v-model="keyword" placeholder="搜索标题/内容" clearable style="width: 200px">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button v-hasPermi="['ai:kb:edit']" type="primary" plain icon="Plus" @click="openAdd">添加分段</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="14" class="chunks-row">
        <!-- 左：文档标题目录（解析产物，点击定位到对应正文分段）；固定高度独立滚动 -->
        <el-col :span="6" class="tree-col">
          <div class="tree-panel-box">
            <div class="tree-panel-title">文档目录</div>
            <el-tree
              ref="treeRef"
              :data="treeData"
              :props="{ label: 'label', children: 'children' }"
              node-key="key"
              default-expand-all
              highlight-current
              :expand-on-click-node="false"
              @node-click="handleNodeLocate"
            />
          </div>
        </el-col>

        <!-- 右：分段卡片（点击编辑 / 拖拽排序 / 启用开关 / 删除）；独立滚动 -->
        <el-col :span="18" class="chunks-col">
          <div ref="chunksScrollRef" v-loading="loading" class="chunk-grid-wrap">
            <el-empty v-if="!loading && filteredChunks.length === 0" :description="keyword ? '无匹配分段' : '该文档暂无分段'" :image-size="90" />
            <div class="chunk-grid">
              <div
                v-for="(chunk, index) in filteredChunks"
                :id="'chunk-' + chunk.chunkId"
                :key="chunk.chunkId"
                class="chunk-card"
                :class="{ 'is-disabled': chunk.disabled === '1', 'is-dragover': dragOverIndex === index, 'is-located': chunk.chunkId === locatedChunkId }"
                draggable="true"
                @dragstart="handleDragStart(index)"
                @dragover.prevent="dragOverIndex = index"
                @dragleave="dragOverIndex = -1"
                @drop.prevent="handleDrop(index)"
                @dragend="dragOverIndex = -1"
                @click="handleCardClick(chunk, $event)"
              >
                <div class="chunk-card-head">
                  <el-icon class="drag-handle" title="拖拽调整顺序"><Rank /></el-icon>
                  <span class="chunk-seq">#{{ chunk.seq }}</span>
                  <span class="chunk-title" :title="chunk.title || chunk.headingPath || ''">
                    {{ chunk.title || chunk.headingPath || '（无标题）' }}
                  </span>
                  <!-- 阻断冒泡：开关与删除不触发编辑；开关表达启用态（亮=参与检索） -->
                  <span class="chunk-card-actions" @click.stop>
                    <el-switch
                      :model-value="chunk.disabled !== '1'"
                      size="small"
                      inline-prompt
                      active-text="启用"
                      inactive-text="禁用"
                      class="chunk-switch"
                      title="禁用后该分段不再参与检索"
                      @change="(val: string | number | boolean) => handleChunkToggle(chunk, !Boolean(val))"
                    />
                    <el-icon class="chunk-delete" title="删除分段" @click="handleDeleteChunk(chunk)"><Delete /></el-icon>
                  </span>
                </div>
                <div class="chunk-card-content" :class="{ 'is-expanded': expandedChunks.has(chunk.chunkId), 'is-collapsed': isCollapsible(chunk) && !expandedChunks.has(chunk.chunkId) }">
                  <MarkdownRenderer :markdown="chunk.content" :is-dark="isDark" />
                  <span
                    v-if="isCollapsible(chunk)"
                    class="chunk-expand"
                    @click.stop="toggleExpand(chunk)"
                  >{{ expandedChunks.has(chunk.chunkId) ? '收起' : '展开全文' }}</span>
                </div>
                <!-- 父级路径面包屑（末级在标题展示，避免重复；一级/无路径不显示） -->
                <div class="chunk-card-footer">
                  <span v-if="parentPath(chunk)" class="chunk-path-crumb" :title="parentPath(chunk)">
                    {{ parentPath(chunk) }}
                  </span>
                  <span class="chunk-chars">{{ chunk.charCount }} 字</span>
                </div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 分段编辑/新增对话框（编辑模式右侧带问题绑定面板；md-editor-v3 主题走 theme prop） -->
    <el-dialog
      v-model="editDialog.visible"
      :title="editDialog.title"
      width="1000px"
      top="6vh"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="edit-layout">
        <!-- 左：标题 + 正文编辑 -->
        <div class="edit-main">
          <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="70px" label-position="top">
            <el-form-item label="标题" prop="title">
              <el-input v-model="editForm.title" placeholder="分段标题（可留空）" maxlength="255" />
            </el-form-item>
            <el-form-item label="内容" prop="content">
              <div class="content-editor">
                <MdEditor
                  v-model="editForm.content"
                  :style="{ height: '440px' }"
                  :theme="isDark ? 'dark' : 'light'"
                  language="zh-CN"
                  placeholder="分段正文（Markdown）"
                  :toolbarsExclude="['github', 'htmlPreview', 'catalog', 'save', 'mermaid', 'katex', 'chart']"
                />
                <span class="form-tip">保存后自动重新向量化并更新检索索引</span>
              </div>
            </el-form-item>
          </el-form>
        </div>

        <!-- 右：绑定问题面板（仅编辑模式；新增分段保存后才有 chunkId） -->
        <div v-if="!isNewChunk" class="edit-problems">
          <div class="edit-problems-head">
            <el-icon class="head-icon"><Link /></el-icon>
            <span>绑定问题</span>
            <span class="head-count">{{ boundProblems.length }}</span>
          </div>
          <div class="panel-tip">命中问题后自动展开到本分段</div>

          <!-- 已绑定 -->
          <div class="panel-section-title">已绑定</div>
          <div v-loading="problemsLoading" class="bound-problem-list">
            <div v-if="!problemsLoading && boundProblems.length === 0" class="panel-empty-tip">
              还没有绑定，从下方列表点击添加
            </div>
            <div v-for="p in boundProblems" :key="p.problemId" class="bound-problem-item" :title="p.content">
              <span class="problem-text">{{ p.content }}</span>
              <el-icon class="item-unbind" @click.stop="handleUnbindProblem(p)"><Close /></el-icon>
            </div>
          </div>

          <!-- 可绑定（打开即加载，输入即过滤） -->
          <div class="panel-section-title with-search">
            <span>可绑定</span>
            <el-input
              v-model="problemKeyword"
              placeholder="过滤"
              clearable
              size="small"
              class="candidate-filter"
              @change="loadCandidateProblems"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </div>
          <div class="candidate-problem-list">
            <template v-if="candidateProblems.length > 0">
              <div
                v-for="p in candidateProblems"
                :key="p.problemId"
                class="candidate-problem-item"
                :title="p.content"
                @click="handleBindProblem(p)"
              >
                <el-icon class="item-add"><Plus /></el-icon>
                <span class="problem-text">{{ p.content }}</span>
              </div>
            </template>
            <div v-else class="panel-empty-tip">
              {{ problemKeyword ? '无匹配问题（可在「问题」页创建）' : '暂无可绑定的问题' }}
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="saving" @click="submitEdit">保 存</el-button>
          <el-button @click="editDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  addChunk,
  bindProblemChunks,
  changeChunkDisabled,
  chunkProblems,
  delChunk,
  documentChunks,
  editChunk,
  listProblem,
  reorderChunks,
  unbindProblemChunks
} from '@/api/ai/knowledge';
import { ChunkEditBody, KbChunkVO, KbDocumentVO, KbProblemVO, documentStatusMap } from '@/api/ai/knowledge/types';
import { MarkdownRenderer } from 'x-markdown-vue';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { useThemeDark } from '@/hooks/common/useTheme';
import modal from '@/plugins/modal';

const props = defineProps<{ document: KbDocumentVO }>();
const emit = defineEmits<{ (e: 'back'): void }>();

interface ChunkTreeNode {
  key: string;
  label: string;
  children: ChunkTreeNode[];
}

const chunkList = ref<KbChunkVO[]>([]);
const loading = ref(false);
const saving = ref(false);
const isDark = useThemeDark();
const keyword = ref('');
const treeRef = ref();
/** 正文滚动容器（目录定位只滚动此区域，目录树不随动） */
const chunksScrollRef = ref<HTMLDivElement>();
/** 定位高亮的分段（点击目录后短暂标记） */
const locatedChunkId = ref<number | string | undefined>(undefined);

const editDialog = reactive({ visible: false, title: '编辑分段' });
const editFormRef = ref();
const editForm = reactive<ChunkEditBody>({ title: '', content: '' });
const editingChunkId = ref<number | string | undefined>(undefined);
/** undefined=新增模式（追加到末尾） */
const isNewChunk = ref(false);

/** 编辑弹窗右侧：绑定问题面板 */
const boundProblems = ref<KbProblemVO[]>([]);
const problemsLoading = ref(false);
const problemKeyword = ref('');
const candidateProblems = ref<KbProblemVO[]>([]);

const dragFromIndex = ref(-1);
const dragOverIndex = ref(-1);

/** 展开全文的分段（长正文默认截断渐隐，点击展开/收起） */
const expandedChunks = ref(new Set<number | string>());
/** 实测超高的分段（渲染后测量 DOM，字数阈值对表格/代码块不准） */
const collapsibleChunks = ref(new Set<number | string>());

const isCollapsible = (chunk: KbChunkVO) => collapsibleChunks.value.has(chunk.chunkId);

const toggleExpand = (chunk: KbChunkVO) => {
  const next = new Set(expandedChunks.value);
  if (next.has(chunk.chunkId)) {
    next.delete(chunk.chunkId);
  } else {
    next.add(chunk.chunkId);
  }
  expandedChunks.value = next;
};

/** 渲染后测量：内容实际高度超出截断高度 → 标记可折叠（展开过的天然已在集合中） */
const measureCollapsible = async () => {
  await nextTick();
  const ids = new Set<number | string>(collapsibleChunks.value);
  for (const chunk of filteredChunks.value) {
    if (ids.has(chunk.chunkId) || expandedChunks.value.has(chunk.chunkId)) {
      continue;
    }
    const content = document.getElementById('chunk-' + chunk.chunkId)?.querySelector('.chunk-card-content');
    if (content && content.scrollHeight > content.clientHeight + 4) {
      ids.add(chunk.chunkId);
    }
  }
  collapsibleChunks.value = ids;
};

/** 卡片点击打开编辑，但放行内容区交互（代码块折叠/复制、链接等） */
const handleCardClick = (chunk: KbChunkVO, e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest('button, a, .x-md-code-header, .chunk-expand')) {
    return;
  }
  openEdit(chunk);
};

/** 父级路径（headingPath 去掉末级，末级由标题展示；分隔符统一为「 / 」） */
const parentPath = (chunk: KbChunkVO) => {
  const path = chunk.headingPath ?? '';
  if (!path.includes('>')) return '';
  return path.split('>').slice(0, -1).map(p => p.trim()).filter(Boolean).join(' / ');
};

const editRules = {
  content: [{ required: true, message: '分段内容不能为空', trigger: 'blur' }]
};

const statusLabel = (status: string) => documentStatusMap[status]?.label ?? status;
const statusType = (status: string) => (documentStatusMap[status]?.type ?? 'info') as 'info' | 'primary' | 'warning' | 'success' | 'danger';

const loadChunks = async () => {
  loading.value = true;
  try {
    const res = await documentChunks(props.document.documentId);
    chunkList.value = res.data ?? [];
  } finally {
    loading.value = false;
  }
};

/** 由 headingPath 构建层级目录树（叶子 key 指向该标题下首段） */
const treeData = computed<ChunkTreeNode[]>(() => {
  const root: ChunkTreeNode = { key: '', label: '__root__', children: [] };
  for (const chunk of chunkList.value) {
    if (!chunk.headingPath) continue;
    let current = root;
    const parts = chunk.headingPath.split('>');
    parts.forEach((part, idx) => {
      const key = parts.slice(0, idx + 1).join('>');
      let child = current.children.find(c => c.key === key);
      if (!child) {
        child = { key, label: part, children: [] };
        current.children.push(child);
      }
      // 计数由 matchesTree 时聚合
      current = child;
    });
  }
  // 不展示虚拟根节点：直接输出标题层级（无标题的文档输出空树）
  return root.children;
});

const matchesKeyword = (chunk: KbChunkVO) => {
  if (!keyword.value.trim()) return true;
  const kw = keyword.value.trim().toLowerCase();
  return (
    (chunk.title ?? '').toLowerCase().includes(kw) ||
    chunk.content.toLowerCase().includes(kw) ||
    (chunk.headingPath ?? '').toLowerCase().includes(kw)
  );
};

const filteredChunks = computed(() => chunkList.value.filter(matchesKeyword));

// 渲染后测量折叠标记（必须在 filteredChunks 声明之后，TDZ）
watch(filteredChunks, () => measureCollapsible());

/** 目录节点点击：定位到该标题子树下第一个分段并短暂高亮（只滚动正文容器） */
const handleNodeLocate = (node: ChunkTreeNode) => {
  const target = chunkList.value.find(c => {
    const path = c.headingPath ?? '';
    return !node.key || path === node.key || path.startsWith(node.key + '>');
  });
  if (!target) return;
  locatedChunkId.value = target.chunkId;
  nextTick(() => {
    const container = chunksScrollRef.value;
    const el = document.getElementById('chunk-' + target.chunkId);
    if (container && el) {
      const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: Math.max(offset - 80, 0), behavior: 'smooth' });
    }
  });
  setTimeout(() => {
    locatedChunkId.value = undefined;
  }, 2000);
};

/** —— 编辑 / 新增 —— */
const openEdit = async (chunk: KbChunkVO) => {
  editingChunkId.value = chunk.chunkId;
  isNewChunk.value = false;
  editForm.title = chunk.title ?? '';
  editForm.content = chunk.content;
  editDialog.title = `编辑分段 #${chunk.seq}`;
  editDialog.visible = true;
  problemKeyword.value = '';
  // 串行：候选过滤依赖已绑定列表
  await loadBoundProblems();
  await loadCandidateProblems();
};

/** 已绑定问题列表（编辑弹窗右侧面板） */
const loadBoundProblems = async () => {
  if (!editingChunkId.value) return;
  problemsLoading.value = true;
  try {
    const res = await chunkProblems(editingChunkId.value);
    boundProblems.value = res.data ?? [];
  } finally {
    problemsLoading.value = false;
  }
};

/** 可绑定问题候选（空关键词也加载，打开弹框即可见） */
const loadCandidateProblems = async () => {
  const res = await listProblem(props.document.datasetId, problemKeyword.value || undefined);
  const boundIds = new Set(boundProblems.value.map(p => p.problemId));
  candidateProblems.value = (res.data ?? []).filter(p => !boundIds.has(p.problemId)).slice(0, 20);
};

const handleBindProblem = async (p: KbProblemVO) => {
  if (!editingChunkId.value) return;
  await bindProblemChunks(p.problemId, [editingChunkId.value]);
  boundProblems.value.push(p);
  candidateProblems.value = candidateProblems.value.filter(c => c.problemId !== p.problemId);
  modal.msgSuccess('已绑定');
};

const handleUnbindProblem = async (p: KbProblemVO) => {
  if (!editingChunkId.value) return;
  await unbindProblemChunks(p.problemId, [editingChunkId.value]);
  boundProblems.value = boundProblems.value.filter(b => b.problemId !== p.problemId);
  // 解绑后回填候选（未过滤命中当前关键词才插入）
  if (!problemKeyword.value || p.content.includes(problemKeyword.value)) {
    candidateProblems.value = [p, ...candidateProblems.value].slice(0, 20);
  }
  modal.msgSuccess('已解绑');
};

const openAdd = () => {
  editingChunkId.value = undefined;
  isNewChunk.value = true;
  editForm.title = '';
  editForm.content = '';
  editDialog.title = '添加分段';
  editDialog.visible = true;
};

const submitEdit = () => {
  editFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    saving.value = true;
    try {
      if (isNewChunk.value) {
        await addChunk(props.document.documentId, { ...editForm });
        modal.msgSuccess('分段已添加并向量化');
      } else {
        await editChunk(editingChunkId.value!, { ...editForm });
        modal.msgSuccess('分段已保存，向量已同步更新');
      }
      editDialog.visible = false;
      await loadChunks();
    } finally {
      saving.value = false;
    }
  });
};

const handleChunkToggle = async (chunk: KbChunkVO, disabled: boolean) => {
  await changeChunkDisabled(chunk.chunkId, disabled);
  chunk.disabled = disabled ? '1' : '0';
  modal.msgSuccess(disabled ? '已禁用，该分段不再参与检索' : '已启用');
};

const handleDeleteChunk = async (chunk: KbChunkVO) => {
  await modal.confirm(`删除分段 #${chunk.seq}？（同步删除其向量）`);
  await delChunk(chunk.chunkId);
  modal.msgSuccess('删除成功');
  await loadChunks();
};

/** —— 拖拽排序：拖到目标卡片位置，整体重排 —— */
const handleDragStart = (index: number) => {
  dragFromIndex.value = index;
};

const handleDrop = async (targetIndex: number) => {
  const from = dragFromIndex.value;
  dragFromIndex.value = -1;
  dragOverIndex.value = -1;
  if (from < 0 || from === targetIndex) return;
  const moved = filteredChunks.value.splice(from, 1)[0];
  filteredChunks.value.splice(targetIndex, 0, moved);
  const orderedIds = filteredChunks.value.map(c => c.chunkId);
  await reorderChunks(props.document.documentId, orderedIds);
  modal.msgSuccess('顺序已更新');
  await loadChunks();
};

onMounted(() => {
  loadChunks();
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

/* 全高布局：目录树与正文各自独立滚动，页面本身不滚动 */
.ai-kb-chunks-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 123px);
  overflow: hidden;

  .table-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;

    :deep(.el-card__body) {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
  }
}

.chunks-row {
  flex: 1;
  min-height: 0;

  .tree-col {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .chunks-col {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}

.tree-panel-box {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px 8px;

  .tree-panel-title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
    padding-left: 4px;
    color: var(--el-text-color-secondary);
  }

  /* WPS 目录感：紧凑行高、小字号、悬停浅底、选中主色 */
  :deep(.el-tree) {
    --el-tree-node-content-height: 28px;
    background: transparent;

    .el-tree-node__content {
      border-radius: 4px;

      &:hover {
        background: var(--el-fill-color-light);
      }
    }

    .el-tree-node.is-current > .el-tree-node__content {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }

    .el-tree-node__label {
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.chunk-grid-wrap {
  flex: 1;
  min-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
}

.chunk-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.chunk-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: var(--el-box-shadow-lighter);
  }

  &.is-dragover {
    border-color: var(--el-color-primary);
    border-style: dashed;
  }

  &.is-disabled {
    opacity: 0.55;
    background-color: var(--el-fill-color-lighter);
  }

  &.is-located {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
  }

  .chunk-card-head {
    display: flex;
    align-items: center;
    gap: 6px;

    .drag-handle {
      color: var(--el-text-color-placeholder);
      cursor: grab;

      &:hover {
        color: var(--el-color-primary);
      }
    }

    .chunk-seq {
      font-weight: 600;
      color: var(--el-color-primary);
      font-size: 12px;
    }

    .chunk-title {
      flex: 1;
      min-width: 0;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .chunk-card-actions {
      display: flex;
      align-items: center;
      gap: 8px;

      .chunk-switch {
        --el-switch-width: 44px;
      }

      .chunk-delete {
        color: var(--el-text-color-placeholder);

        &:hover {
          color: var(--el-color-danger);
        }
      }
    }
  }

  .chunk-card-content {
    position: relative;
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
    word-break: break-word;
    /* 长正文截断渐隐（嵌套滚动改为展开/收起），短内容不受影响 */
    max-height: 168px;
    overflow: hidden;

    &.is-expanded {
      max-height: none;
    }

    &.is-collapsed::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 30px;
      background: linear-gradient(transparent, var(--el-bg-color));
      pointer-events: none;
    }

    .chunk-expand {
      position: absolute;
      right: 0;
      bottom: 0;
      z-index: 1;
      padding: 2px 6px 2px 14px;
      font-size: 12px;
      color: var(--el-color-primary);
      cursor: pointer;
      background: linear-gradient(to right, transparent, var(--el-bg-color) 18px);
    }

    /* 渲染器根节点带内联底色与 padding（is-dark 时 rgb(30,30,30)），透明化并入卡片排版 */
    :deep(.x-md-renderer) {
      background: transparent !important;
      padding: 0 !important;
      color: inherit !important;
    }

    :deep(pre),
    :deep(code) {
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* MD 表格主题适配：读 EP 变量，浅色/暗黑自动跟随（渲染器无 wrapper 类，table 直接挂在本节点下） */
    :deep(table) {
      display: block;
      width: max-content;
      max-width: 100%;
      overflow-x: auto;
      border-collapse: collapse;
      margin: 6px 0;
      font-size: 12px;
      background-color: transparent;

      th,
      td {
        border: 1px solid var(--el-border-color-lighter);
        padding: 4px 8px;
        color: var(--el-text-color-regular);
        background-color: var(--el-bg-color);
      }

      th {
        background-color: var(--el-fill-color-light);
        font-weight: 600;
      }

      tbody tr:nth-child(2n) td {
        background-color: var(--el-fill-color-blank);
      }
    }
  }

  .chunk-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .chunk-path-crumb {
      flex: 1;
      min-width: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chunk-chars {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }
  }
}
.content-editor {
  width: 100%;

  :deep(.md-editor) {
    border-radius: 6px;
  }
}

/* ===== 编辑弹窗：左编辑 + 右绑定问题面板 ===== */
.edit-layout {
  display: flex;
  gap: 20px;

  .edit-main {
    flex: 1;
    min-width: 0;
  }

  .edit-problems {
    flex: 0 0 300px;
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-left: 1px solid var(--el-border-color-lighter);
    padding-left: 20px;
  }
}

.edit-problems-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;

  .head-icon {
    color: var(--el-color-primary);
    font-size: 16px;
  }

  .head-count {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--el-color-primary);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    line-height: 20px;
    text-align: center;
  }
}

.panel-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.panel-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);

  &.with-search {
    .candidate-filter {
      flex: 1;
      margin: 0;
    }
  }
}

.panel-empty-tip {
  padding: 14px 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.problem-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 已绑定：中性底+主色描边文字（primary-light 亮底在浅色下过白刺眼），右上角关闭 */
.bound-problem-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 44px;
  max-height: 176px;
  overflow-y: auto;
}

.bound-problem-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 28px 7px 10px;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 6px;
  background: var(--el-fill-color);

  .problem-text {
    color: var(--el-color-primary);
  }

  .item-unbind {
    position: absolute;
    top: 50%;
    right: 8px;
    transform: translateY(-50%);
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    transition: color 0.15s;

    &:hover {
      color: var(--el-color-danger);
    }
  }
}

/* 可绑定：轻量条目，hover 出现主色背景与加号 */
.candidate-problem-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 236px;
  overflow-y: auto;
}

.candidate-problem-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;

  .item-add {
    flex-shrink: 0;
    font-size: 14px;
    color: var(--el-text-color-placeholder);
    transition: color 0.15s;
  }

  &:hover {
    background: var(--el-fill-color-light);

    .item-add {
      color: var(--el-color-primary);
    }
  }
}
</style>
