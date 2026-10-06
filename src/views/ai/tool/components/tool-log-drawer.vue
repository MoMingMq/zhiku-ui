<template>
  <el-drawer v-model="visible" :title="`调用记录：${toolName || '全部工具'}`" size="55%" append-to-body>
    <el-table v-loading="loading" :data="logList" row-key="logId">
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="snapshot">
            <div class="snapshot-title">请求快照（鉴权已脱敏）</div>
            <pre class="snapshot-body">{{ prettyJson(row.requestSnapshot) }}</pre>
            <div class="snapshot-title">响应快照（截断后）</div>
            <pre class="snapshot-body">{{ prettyJson(row.responseSnapshot) || '（空）' }}</pre>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ parseTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="场景" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.scene === '0' ? 'info' : 'primary'" size="small" effect="plain">
            {{ row.scene === '0' ? '试运行' : '对话调用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="工具名" prop="toolName" min-width="140" show-overflow-tooltip />
      <el-table-column label="HTTP" width="80" align="center">
        <template #default="{ row }">
          <span v-if="row.httpStatus">{{ row.httpStatus }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="结果" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.success === '1' ? 'success' : 'danger'" size="small">{{ row.success === '1' ? '成功' : '失败' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="错误信息" prop="errorMsg" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.errorMsg || '-' }}</template>
      </el-table-column>
      <el-table-column label="耗时" width="90" align="right">
        <template #default="{ row }">{{ row.durationMs }} ms</template>
      </el-table-column>
    </el-table>
    <pagination
      v-show="total > 0"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      :total="total"
      layout="total, prev, pager, next"
      @pagination="getList"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import api from '@/api/ai/tool';
import type { AiToolCallLogVO, AiToolVO } from '@/api/ai/tool/types';
import { useLoading } from '@/hooks/async/useLoading';
import { parseTime } from '@/utils/zhiku';

const visible = ref(false);
const toolName = ref('');
const logList = ref<AiToolCallLogVO[]>([]);
const total = ref(0);
const { loading, withLoading } = useLoading(false);
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  toolId: undefined as number | string | undefined
});

const getList = async () => {
  await withLoading(async () => {
    const res = await api.listToolLog(queryParams);
    logList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  });
};

const open = (row?: AiToolVO) => {
  toolName.value = row?.toolName ?? '';
  queryParams.pageNum = 1;
  queryParams.toolId = row?.toolId;
  visible.value = true;
  getList();
};

const prettyJson = (text: string | null): string => {
  if (!text) return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

defineExpose({ open });
</script>

<style lang="scss" scoped>
.snapshot {
  padding: 8px 16px;

  .snapshot-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    margin: 8px 0 4px;
  }

  .snapshot-body {
    max-height: 220px;
    overflow: auto;
    margin: 0;
    padding: 10px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
