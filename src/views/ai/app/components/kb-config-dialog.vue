<template>
  <div class="kb-config">
    <!-- 触发按钮 + 已选卡片 -->
    <el-button icon="FolderChecked" @click="open">知识库与检索设置</el-button>
    <div v-if="selectedKbs.length" class="kb-cards">
      <div v-for="kb in selectedKbs" :key="kb.datasetId" class="kb-card">
        <div class="kb-card-name" :title="kb.datasetName">{{ kb.datasetName }}</div>
        <el-tooltip content="取消关联" placement="top">
          <el-icon class="kb-card-remove" @click="unbind(kb.datasetId)"><CircleClose /></el-icon>
        </el-tooltip>
      </div>
    </div>

    <!-- 关联对话框：库多选 -->
    <el-dialog v-model="visible" title="关联知识库" width="560px" append-to-body>
      <div v-loading="loading" class="kb-list">
        <el-checkbox-group v-model="checkedIds">
          <div v-for="kb in datasetOptions" :key="kb.datasetId" class="kb-option">
            <el-checkbox :value="kb.datasetId">
              <span class="kb-option-name">{{ kb.datasetName }}</span>
              <span class="kb-option-desc">{{ kb.description || '暂无描述' }}</span>
            </el-checkbox>
          </div>
        </el-checkbox-group>
        <el-empty v-if="!loading && datasetOptions.length === 0" description="暂无知识库，请先创建" :image-size="60" />
      </div>
      <template #footer>
        <el-button type="primary" @click="confirm">确 定</el-button>
        <el-button @click="visible = false">取 消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { listDataset } from '@/api/ai/knowledge';

const props = defineProps<{ modelValue: Array<number | string> }>();
const emit = defineEmits<{ 'update:modelValue': [value: Array<number | string>] }>();

const visible = ref(false);
const loading = ref(false);
const datasetOptions = ref<Array<{ datasetId: number | string; datasetName: string; description?: string }>>([]);
const checkedIds = ref<Array<number | string>>([]);

const selectedKbs = computed(() =>
  datasetOptions.value.filter(kb => props.modelValue.includes(kb.datasetId))
);

const open = async () => {
  checkedIds.value = [...props.modelValue];
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
  emit('update:modelValue', [...checkedIds.value]);
  visible.value = false;
};

const unbind = (datasetId: number | string) => {
  emit('update:modelValue', props.modelValue.filter(id => id !== datasetId));
};

onMounted(async () => {
  // 初次进入也要拉一次库列表用于已选卡片展示
  const res = await listDataset({ pageNum: 1, pageSize: 100 });
  datasetOptions.value = res.data?.rows ?? [];
});
</script>

<style lang="scss" scoped>
.kb-config {
  width: 100%;

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
    max-height: 360px;
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
