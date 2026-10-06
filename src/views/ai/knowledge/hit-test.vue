<template>
  <div class="kb-hit-test-page">
    <el-card shadow="hover" class="query-panel">
      <el-form :model="hitForm" inline>
        <el-form-item label="查询语句">
          <el-input
            v-model="hitForm.query"
            placeholder="输入问题，测试分段检索命中率"
            style="width: 380px"
            clearable
            @keyup.enter="handleHitTest"
          />
        </el-form-item>
        <el-form-item label="返回条数">
          <el-input-number v-model="hitForm.topK" :min="1" :max="20" controls-position="right" />
        </el-form-item>
        <el-form-item label="重排">
          <el-switch v-model="hitForm.rerank" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" :loading="testing" @click="handleHitTest">测试</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-loading="testing" class="hit-results">
      <el-empty v-if="!testing && !tested" description="输入问题开始命中测试" :image-size="90" />
      <el-empty v-else-if="!testing && tested && hitResults.length === 0" description="无命中结果" :image-size="90" />
      <div v-for="(hit, i) in hitResults" :key="hit.chunkId" class="hit-item">
        <div class="hit-rank">{{ i + 1 }}</div>
        <div class="hit-body">
          <div class="hit-head">
            <el-progress type="dashboard" :percentage="Math.round(hit.score * 100)" :width="48" :stroke-width="5" />
            <div class="hit-meta">
              <span class="hit-doc">{{ hit.documentName }} · 第 {{ hit.seq }} 段</span>
              <span v-if="hit.headingPath" class="hit-path">
                <el-icon><Guide /></el-icon>{{ hit.headingPath }}
              </span>
            </div>
          </div>
          <div class="hit-content">{{ hit.content }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { hitTest } from '@/api/ai/knowledge';
import { RetrievalHit } from '@/api/ai/knowledge/types';
import modal from '@/plugins/modal';

const props = defineProps<{ datasetId: number | string }>();
void props;

const testing = ref(false);
const tested = ref(false);
const hitResults = ref<RetrievalHit[]>([]);
const hitForm = reactive({ query: '', topK: 5, rerank: false });

const handleHitTest = async () => {
  if (!hitForm.query.trim()) {
    modal.msgWarning('请输入查询语句');
    return;
  }
  testing.value = true;
  tested.value = true;
  try {
    const res = await hitTest(props.datasetId, { ...hitForm });
    hitResults.value = res.data ?? [];
  } finally {
    testing.value = false;
  }
};
</script>

<style lang="scss" scoped>
.kb-hit-test-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.query-panel {
  :deep(.el-card__body) {
    padding-bottom: 2px;
  }
}

.hit-results {
  min-height: 300px;
}

.hit-item {
  display: flex;
  gap: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
  background: var(--el-bg-color);
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  .hit-rank {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .hit-body {
    flex: 1;
    min-width: 0;

    .hit-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      .hit-meta {
        display: flex;
        flex-direction: column;

        .hit-doc {
          font-size: 13px;
          font-weight: 600;
        }

        .hit-path {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    .hit-content {
      font-size: 13px;
      line-height: 1.7;
      color: var(--el-text-color-regular);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 180px;
      overflow-y: auto;
    }
  }
}
</style>
