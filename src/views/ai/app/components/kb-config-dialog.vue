<template>
  <div class="kb-config">
    <!-- 双按钮：选择 / 参数设置 -->
    <div class="kb-actions">
      <el-button icon="FolderChecked" @click="selectDialog.visible = true">选择</el-button>
      <el-button icon="Operation" @click="paramDialog.visible = true">参数设置</el-button>
    </div>
    <!-- 已选知识库卡片 -->
    <div v-if="config.kbIds.length" class="kb-cards">
      <div v-for="kb in selectedKbs" :key="kb.datasetId" class="kb-card">
        <div class="kb-card-name" :title="kb.datasetName">{{ kb.datasetName }}</div>
        <el-tooltip content="取消关联" placement="top">
          <el-icon class="kb-card-remove" @click="unbind(kb.datasetId)"><CircleClose /></el-icon>
        </el-tooltip>
      </div>
    </div>

    <!-- 选择：知识库卡片列表（带分页+勾选框，样式对齐知识库列表页；append-to-body 下样式用非 scoped 块） -->
    <el-dialog v-model="selectDialog.visible" title="选择知识库" width="760px" append-to-body>
      <div v-loading="selectDialog.loading" class="kb-select-grid">
        <div
          v-for="kb in datasetOptions"
          :key="kb.datasetId"
          class="kb-select-card"
          :class="{ 'is-checked': checkedIds.includes(kb.datasetId) }"
          @click="toggleCheck(kb.datasetId)"
        >
          <div class="kb-select-title">
            <el-icon class="kb-select-icon"><Collection /></el-icon>
            <span class="kb-select-name" :title="kb.datasetName">{{ kb.datasetName }}</span>
            <el-checkbox
              :model-value="checkedIds.includes(kb.datasetId)"
              class="kb-select-check"
              @click.stop
              @change="() => toggleCheck(kb.datasetId)"
            />
          </div>
          <div class="kb-select-desc">{{ kb.description || '暂无描述' }}</div>
        </div>
        <el-empty v-if="!selectDialog.loading && datasetOptions.length === 0" description="暂无知识库" :image-size="60" />
      </div>
      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @pagination="loadDatasets"
      />
      <template #footer>
        <el-button type="primary" @click="confirmSelect">确 定（已选 {{ checkedIds.length }}）</el-button>
        <el-button @click="selectDialog.visible = false">取 消</el-button>
      </template>
    </el-dialog>

    <!-- 参数设置：检索条数 / 相似度阈值 -->
    <el-dialog v-model="paramDialog.visible" title="检索参数设置" width="480px" append-to-body>
      <el-form label-width="100px">
        <el-form-item label="检索条数">
          <el-input-number v-model="paramDraft.topK" :min="1" :max="20" />
          <span class="kb-param-tip">多库召回并集后的 Top N</span>
        </el-form-item>
        <el-form-item label="相似度阈值">
          <el-input-number v-model="paramDraft.minScore" :min="0" :max="100" :step="5" />
          <span class="kb-param-tip">低于该分数的命中被过滤（百分比，0=不过滤）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="confirmParams">确 定</el-button>
        <el-button @click="paramDialog.visible = false">取 消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { listDataset } from '@/api/ai/knowledge';

/** 检索配置整体（kbIds + topK + minScore 百分比） */
export interface KbRetrievalConfig {
  kbIds: Array<number | string>;
  topK: number;
  minScore: number;
}

const props = defineProps<{ modelValue: KbRetrievalConfig }>();
const emit = defineEmits<{ 'update:modelValue': [value: KbRetrievalConfig] }>();

const selectDialog = reactive({ visible: false, loading: false });
const paramDialog = reactive({ visible: false });
const datasetOptions = ref<Array<{ datasetId: number | string; datasetName: string; description?: string }>>([]);
const allDatasetMap = ref<Map<number | string, { datasetName: string }>>(new Map());
const checkedIds = ref<Array<number | string>>([]);
const paramDraft = reactive({ topK: 5, minScore: 50 });
const total = ref(0);
const queryParams = reactive({ pageNum: 1, pageSize: 12 });

const config = computed(() => props.modelValue);

/** 已选卡片展示：翻页后不在当前页的库也要显示，维护全量名称映射 */
const selectedKbs = computed(() =>
  props.modelValue.kbIds.map(id => ({
    datasetId: id,
    datasetName: allDatasetMap.value.get(id)?.datasetName ?? `知识库 ${id}`
  }))
);

const loadDatasets = async () => {
  selectDialog.loading = true;
  try {
    const res = await listDataset({ pageNum: queryParams.pageNum, pageSize: queryParams.pageSize });
    datasetOptions.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
    datasetOptions.value.forEach(kb => allDatasetMap.value.set(kb.datasetId, kb));
    if (allDatasetMap.value.size < total.value) {
      const all = await listDataset({ pageNum: 1, pageSize: 100 });
      (all.data?.rows ?? []).forEach(kb => allDatasetMap.value.set(kb.datasetId, kb));
    }
  } finally {
    selectDialog.loading = false;
  }
};

watch(selectDialog, async s => {
  if (s.visible) {
    checkedIds.value = [...props.modelValue.kbIds];
    if (!allDatasetMap.value.size || allDatasetMap.value.size < props.modelValue.kbIds.length) {
      await loadDatasets();
    }
  }
});

watch(paramDialog, s => {
  if (s.visible) {
    paramDraft.topK = props.modelValue.topK;
    paramDraft.minScore = props.modelValue.minScore;
  }
});

const toggleCheck = (datasetId: number | string) => {
  const idx = checkedIds.value.indexOf(datasetId);
  if (idx >= 0) {
    checkedIds.value.splice(idx, 1);
  } else {
    checkedIds.value.push(datasetId);
  }
};

const confirmSelect = () => {
  emit('update:modelValue', { ...props.modelValue, kbIds: [...checkedIds.value] });
  selectDialog.visible = false;
};

const confirmParams = () => {
  emit('update:modelValue', { ...props.modelValue, topK: paramDraft.topK, minScore: paramDraft.minScore });
  paramDialog.visible = false;
};

const unbind = (datasetId: number | string) => {
  emit('update:modelValue', { ...props.modelValue, kbIds: props.modelValue.kbIds.filter(id => id !== datasetId) });
};

onMounted(loadDatasets);
</script>

<!-- scoped 样式：仅覆盖本组件直渲染区（按钮/已选卡片） -->
<style lang="scss" scoped>
.kb-config {
  width: 100%;

  .kb-actions {
    display: flex;
    gap: 8px;
  }

  .kb-cards {
    margin-top: 10px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }

  .kb-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-left: 3px solid var(--el-color-primary);
    border-radius: 6px;

    .kb-card-name {
      flex: 1;
      min-width: 0;
      font-size: 13px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .kb-card-remove {
      color: var(--el-text-color-placeholder);
      cursor: pointer;

      &:hover {
        color: var(--el-color-danger);
      }
    }
  }
}
</style>

<!-- 非 scoped：对话框 append-to-body 挂 body，scoped 样式作用不到（此前卡片样式因此失效退化成列表） -->
<style lang="scss">
.kb-select-grid {
  min-height: 160px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  .el-empty {
    grid-column: 1 / -1;
    place-self: center;
  }

  .kb-select-card {
    padding: 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--el-bg-color);
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      border-radius: 10px 10px 0 0;
      background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-5));
      opacity: 0;
      transition: opacity 0.2s;
    }

    &:hover {
      border-color: var(--el-color-primary-light-5);
      transform: translateY(-1px);
      box-shadow: var(--el-box-shadow-light);

      &::before {
        opacity: 1;
      }
    }

    &.is-checked {
      border-color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);

      &::before {
        opacity: 1;
      }
    }

    .kb-select-title {
      display: flex;
      align-items: center;
      gap: 8px;

      .kb-select-icon {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: linear-gradient(135deg, var(--el-color-primary-light-8), var(--el-color-primary-light-9));
        color: var(--el-color-primary);
        font-size: 17px;
        flex-shrink: 0;
      }

      .kb-select-name {
        flex: 1;
        min-width: 0;
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kb-select-check {
        height: auto;
      }
    }

    .kb-select-desc {
      min-height: 36px;
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

.kb-param-tip {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
