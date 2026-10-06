<template>
  <div class="p-2 app-container ai-kb-chunks-page">
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

      <el-row :gutter="14">
        <!-- 左：文档标题目录（解析产物，点击定位到对应正文分段） -->
        <el-col :span="6">
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

        <!-- 右：分段卡片（点击编辑 / 拖拽排序 / 启用开关 / 删除） -->
        <el-col :span="18">
          <div v-loading="loading" class="chunk-grid-wrap">
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
                @click="openEdit(chunk)"
              >
                <div class="chunk-card-head">
                  <el-icon class="drag-handle" title="拖拽调整顺序"><Rank /></el-icon>
                  <span class="chunk-seq">#{{ chunk.seq }}</span>
                  <span class="chunk-title" :title="chunk.title || chunk.headingPath || ''">
                    {{ chunk.title || chunk.headingPath || '（无标题）' }}
                  </span>
                  <!-- 阻断冒泡：开关与删除不触发编辑 -->
                  <span class="chunk-card-actions" @click.stop>
                    <el-switch
                      :model-value="chunk.disabled === '1'"
                      size="small"
                      @change="(val: string | number | boolean) => handleChunkToggle(chunk, Boolean(val))"
                    />
                    <el-icon class="chunk-delete" title="删除分段" @click="handleDeleteChunk(chunk)"><Delete /></el-icon>
                  </span>
                </div>
                <div class="chunk-card-content">
                  <MarkdownRenderer :markdown="chunk.content" :is-dark="false" />
                </div>
                <div class="chunk-card-footer">
                  <el-tag v-if="chunk.headingPath" size="small" type="info" class="chunk-path-tag" :title="chunk.headingPath">
                    {{ chunk.headingPath }}
                  </el-tag>
                  <span class="chunk-chars">{{ chunk.charCount }} 字</span>
                </div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 分段编辑/新增对话框 -->
    <el-dialog v-model="editDialog.visible" :title="editDialog.title" width="640px" append-to-body :close-on-click-modal="false">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="70px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="editForm.title" placeholder="分段标题（可留空）" maxlength="255" />
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <div class="content-editor">
            <el-tabs v-model="editorTab" class="editor-tabs">
              <el-tab-pane label="编辑" name="edit" />
              <el-tab-pane label="预览" name="preview" />
            </el-tabs>
            <el-input v-if="editorTab === 'edit'" v-model="editForm.content" type="textarea" :rows="10" placeholder="分段正文（支持 Markdown）" />
            <div v-else class="content-preview">
              <MarkdownRenderer :markdown="editForm.content || '（空）'" :is-dark="false" />
            </div>
            <span class="form-tip">保存后自动重新向量化并更新检索索引</span>
          </div>
        </el-form-item>
      </el-form>
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
import { addChunk, changeChunkDisabled, delChunk, documentChunks, editChunk, reorderChunks } from '@/api/ai/knowledge';
import { ChunkEditBody, KbChunkVO, KbDocumentVO, documentStatusMap } from '@/api/ai/knowledge/types';
import { MarkdownRenderer } from 'x-markdown-vue';
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
const editorTab = ref('edit');
const keyword = ref('');
const treeRef = ref();
/** 定位高亮的分段（点击目录后短暂标记） */
const locatedChunkId = ref<number | string | undefined>(undefined);

const editDialog = reactive({ visible: false, title: '编辑分段' });
const editFormRef = ref();
const editForm = reactive<ChunkEditBody>({ title: '', content: '' });
const editingChunkId = ref<number | string | undefined>(undefined);
/** undefined=新增模式（追加到末尾） */
const isNewChunk = ref(false);

const dragFromIndex = ref(-1);
const dragOverIndex = ref(-1);

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
  const root: ChunkTreeNode = { key: '', label: '全部分段', children: [] };
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
      current = child;
    });
  }
  return root.children.length > 0 ? [root] : [];
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

/** 目录节点点击：滚动定位到该标题子树下第一个分段并短暂高亮 */
const handleNodeLocate = (node: ChunkTreeNode) => {
  const target = chunkList.value.find(c => !node.key || (c.headingPath ?? '').startsWith(node.key));
  if (!target) return;
  locatedChunkId.value = target.chunkId;
  nextTick(() => {
    document.getElementById('chunk-' + target.chunkId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  setTimeout(() => {
    locatedChunkId.value = undefined;
  }, 2000);
};

/** —— 编辑 / 新增 —— */
const openEdit = (chunk: KbChunkVO) => {
  editingChunkId.value = chunk.chunkId;
  isNewChunk.value = false;
  editForm.title = chunk.title ?? '';
  editForm.content = chunk.content;
  editDialog.title = `编辑分段 #${chunk.seq}`;
  editDialog.visible = true;
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

.tree-panel-box {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px;

  .tree-panel-title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--el-text-color-secondary);
  }
}

.chunk-grid-wrap {
  min-height: 240px;
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
      font-size: 13px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chunk-card-actions {
      display: flex;
      align-items: center;
      gap: 8px;

      .chunk-delete {
        color: var(--el-text-color-placeholder);

        &:hover {
          color: var(--el-color-danger);
        }
      }
    }
  }

  .chunk-card-content {
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
    word-break: break-word;
    max-height: 140px;
    overflow-y: auto;
  }

  .chunk-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .chunk-path-tag {
      max-width: 200px;
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

  .editor-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 8px;
    }
  }

  .content-preview {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    padding: 12px;
    max-height: 320px;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.7;
  }
}
</style>
