<template>
  <div class="kb-config">
    <!-- 触发按钮 + 已选卡片 + 检索参数摘要 -->
    <el-button icon="FolderChecked" @click="open">知识库与检索设置</el-button>
    <div v-if="config.kbIds.length" class="kb-cards">
      <div v-for="kb in selectedKbs" :key="kb.datasetId" class="kb-card">
        <div class="kb-card-name" :title="kb.datasetName">{{ kb.datasetName }}</div>
        <el-tooltip content="取消关联" placement="top">
          <el-icon class="kb-card-remove" @click="unbind(kb.datasetId)"><CircleClose /></el-icon>
        </el-tooltip>
      </div>
    </div>
    <div class="retrieval-summary">
      检索条数 Top {{ config.topK }} · 相似度阈值 {{ config.minScore }}%
    </div>

    <!-- 关联与检索参数对话框 -->
    <el-dialog v-model="visible" title="知识库与检索设置" width="580px" append-to-body>
      <div v-loading="loading" class="kb-list">
        <div class="section-label">关联知识库（检索范围 = 并集）</div>
        <el-checkbox-group v-model="draft.kbIds">
          <div v-for="kb in datasetOptions" :key="kb.datasetId" class="kb-option">
            <el-checkbox :value="kb.datasetId">
              <span class="kb-option-name">{{ kb.datasetName }}</span>
              <span class="kb-option-desc">{{ kb.description || '暂无描述' }}</span>
            </el-checkbox>
          </div>
        </el-checkbox-group>
        <el-empty v-if="!loading && datasetOptions.length === 0" description="暂无知识库，请先创建" :image-size="60" />
      </div>
      <el-divider />
      <el-form label-width="100px" class="retrieval-form">
        <div class="section-label">检索参数</div>
        <el-form-item label="检索条数">
          <el-input-number v-model="draft.topK" :min="1" :max="20" />
          <span class="form-tip">多库召回并集后的 Top N</span>
        </el-form-item>
        <el-form-item label="相似度阈值">
          <el-input-number v-model="draft.minScore" :min="0" :max="100" :step="5" />
          <span class="form-tip">低于该分数的命中被过滤（百分比，0=不过滤；Dify 惯例 50-70）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="confirm">确 定</el-button>
        <el-button @click="visible = false">取 消</el-button>
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

const visible = ref(false);
const loading = ref(false);
const datasetOptions = ref<Array<{ datasetId: number | string; datasetName: string; description?: string }>>([]);
const draft = reactive<KbRetrievalConfig>({ kbIds: [], topK: 5, minScore: 50 });

const config = computed(() => props.modelValue);

const selectedKbs = computed(() => datasetOptions.value.filter(kb => props.modelValue.kbIds.includes(kb.datasetId)));

const open = async () => {
  draft.kbIds = [...props.modelValue.kbIds];
  draft.topK = props.modelValue.topK;
  draft.minScore = props.modelValue.minScore;
  visible.value = true;
  if (!datasetOptions.value.length) {
    loading.value = true;
    try {
      const res = await listDataset({ pageNum: 1, pageSize: 100 });
      datasetOptions.value = res.data?.rows ?? [];
    } finally {
      loading.value = false;
    }
  }
};

const confirm = () => {
  emit('update:modelValue', { kbIds: [...draft.kbIds], topK: draft.topK, minScore: draft.minScore });
  visible.value = false;
};

const unbind = (datasetId: number | string) => {
  emit('update:modelValue', { ...props.modelValue, kbIds: props.modelValue.kbIds.filter(id => id !== datasetId) });
};

onMounted(async () => {
  const res = await listDataset({ pageNum: 1, pageSize: 100 });
  datasetOptions.value = res.data?.rows ?? [];
});
</script>

<style lang="scss" scoped>
.kb-config {
  width: 100%;

  .retrieval-summary {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .section-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-regular);
    margin-bottom: 8px;
  }

  .form-tip {
    margin-left: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
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

  .kb-list {
    min-height: 120px;
    max-height: 300px;
    overflow-y: auto;

    .kb-option {
      padding: 6px 4px;
      border-bottom: 1px dashed var(--el-border-color-extra-light);

      .kb-option-name {
        font-weight: 600;
        margin-right: 8px;
      }

      .kb-option-desc {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}
</style>
