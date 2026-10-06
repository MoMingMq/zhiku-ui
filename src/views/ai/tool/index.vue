<template>
  <div class="p-2 app-container ai-tool-page">
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Tools</span>
            <h3>工具管理</h3>
            <p>共 {{ total }} 个 HTTP 模板工具。应用挂载后由模型在对话中自主调用。</p>
          </div>
          <div class="toolbar-actions">
            <el-input
              v-model="queryParams.toolName"
              placeholder="搜索工具名"
              clearable
              style="width: 200px"
              @keyup.enter="handleQuery"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-select v-model="queryParams.status" placeholder="状态" clearable style="width: 110px" @change="handleQuery">
              <el-option label="启用" value="0" />
              <el-option label="停用" value="1" />
            </el-select>
            <el-button v-hasPermi="['ai:tool:add']" type="primary" icon="Plus" @click="handleAdd">创建工具</el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading" class="tool-card-grid">
        <el-empty v-if="!loading && toolList.length === 0" description="还没有工具，点击右上角创建第一个工具" />
        <div v-for="row in toolList" :key="row.toolId" class="tool-card">
          <div class="tool-card-title">
            <span class="tool-card-icon">
              <el-icon v-if="isElementIcon(row.icon)" :size="20"><component :is="row.icon" /></el-icon>
              <template v-else>{{ row.icon || '🔧' }}</template>
            </span>
            <div class="tool-card-name-wrap">
              <span class="tool-card-name" :title="row.toolName">{{ row.toolName }}</span>
              <el-switch
                v-model="row.status"
                active-value="0"
                inactive-value="1"
                inline-prompt
                active-text="启用"
                inactive-text="停用"
                :disabled="!checkPermi(['ai:tool:edit'])"
                @change="handleStatusChange(row)"
              />
            </div>
            <!-- 阻断冒泡：菜单点击不得触发卡片默认行为 -->
            <span class="tool-card-more-wrap" @click.stop>
              <el-dropdown trigger="click" @command="(cmd: string) => handleCardCommand(cmd, row)">
                <el-icon class="tool-card-more"><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="test" v-hasPermi="['ai:tool:test']">试运行</el-dropdown-item>
                    <el-dropdown-item command="log" v-hasPermi="['ai:tool:log']">调用记录</el-dropdown-item>
                    <el-dropdown-item command="edit" divided v-hasPermi="['ai:tool:edit']">编辑</el-dropdown-item>
                    <el-dropdown-item command="delete" v-hasPermi="['ai:tool:remove']">
                      <span style="color: var(--el-color-danger)">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </span>
          </div>
          <div class="tool-card-desc" :title="row.description">{{ row.description }}</div>
          <div class="tool-card-url">
            <el-tag size="small" effect="plain">{{ row.method }}</el-tag>
            <span class="tool-card-url-text" :title="row.urlTemplate">{{ row.urlTemplate }}</span>
          </div>
          <div class="tool-card-footer">
            <span v-if="row.allowIntranet === '1'" class="tool-card-intranet">内网白名单</span>
            <span v-else />
            <span>{{ parseTime(row.createTime) }}</span>
          </div>
        </div>
      </div>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </el-card>

    <tool-edit-dialog ref="editDialogRef" @reload="getList" />
    <tool-test-dialog ref="testDialogRef" />
    <tool-log-drawer ref="logDrawerRef" />
  </div>
</template>

<script setup name="Tool" lang="ts">
import api from '@/api/ai/tool';
import type { AiToolQuery, AiToolVO } from '@/api/ai/tool/types';
import { useLoading } from '@/hooks/async/useLoading';
import { checkPermi } from '@/utils/permission';
import modal from '@/plugins/modal';
import { parseTime } from '@/utils/zhiku';
import ToolEditDialog from './components/tool-edit-dialog.vue';
import ToolLogDrawer from './components/tool-log-drawer.vue';
import ToolTestDialog from './components/tool-test-dialog.vue';

const toolList = ref<AiToolVO[]>([]);
const { loading, withLoading } = useLoading(true);
const total = ref(0);

const queryParams = reactive<AiToolQuery>({
  pageNum: 1,
  pageSize: 12,
  toolName: undefined,
  status: undefined
});

const editDialogRef = ref<InstanceType<typeof ToolEditDialog>>();
const testDialogRef = ref<InstanceType<typeof ToolTestDialog>>();
const logDrawerRef = ref<InstanceType<typeof ToolLogDrawer>>();

const getList = async () => {
  await withLoading(async () => {
    const res = await api.listAiTool(queryParams);
    toolList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  });
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

/** Element 图标名为大写驼峰（全局已注册组件）；其余按 emoji 文本渲染（兼容旧数据） */
const isElementIcon = (icon: string | null | undefined): boolean => /^[A-Z][A-Za-z0-9]*$/.test(icon ?? '');

const handleAdd = () => {
  editDialogRef.value?.open();
};

const handleCardCommand = async (cmd: string, row: AiToolVO) => {
  if (cmd === 'edit') {
    editDialogRef.value?.open(row);
  } else if (cmd === 'test') {
    testDialogRef.value?.open(row);
  } else if (cmd === 'log') {
    logDrawerRef.value?.open(row);
  } else if (cmd === 'delete') {
    await modal.confirm(`删除工具"${row.toolName}"？（应用挂载关系将一并解除，调用记录保留）`);
    await api.delAiTool(row.toolId);
    modal.msgSuccess('删除成功');
    await getList();
  }
};

/** 状态开关：仅提交 status，其余留空避免覆盖 */
const handleStatusChange = async (row: AiToolVO) => {
  const res = await api.getAiTool(row.toolId);
  const detail = res.data;
  await api.updateAiTool({
    toolId: detail.toolId,
    toolName: detail.toolName,
    description: detail.description,
    icon: detail.icon ?? undefined,
    method: detail.method,
    urlTemplate: detail.urlTemplate,
    headers: detail.headers ?? undefined,
    queryParams: detail.queryParams ?? undefined,
    bodyTemplate: detail.bodyTemplate ?? undefined,
    paramSchema: detail.paramSchema ?? undefined,
    authType: detail.authType,
    authKey: detail.authKey ?? undefined,
    authValue: '',
    allowIntranet: detail.allowIntranet,
    timeoutSeconds: detail.timeoutSeconds,
    status: row.status
  });
  modal.msgSuccess(row.status === '0' ? '已启用' : '已停用');
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;

.tool-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  min-height: 200px;

  /* 空态占满整行并在网格内水平垂直居中 */
  .el-empty {
    grid-column: 1 / -1;
    place-self: center;
    padding: 48px 0;
  }
}

.tool-card {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  transition: all 0.25s;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--el-bg-color);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-5));
    opacity: 0;
    transition: opacity 0.25s;
  }

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: var(--el-box-shadow);
    transform: translateY(-2px);

    &::before {
      opacity: 1;
    }
  }

  .tool-card-title {
    display: flex;
    align-items: center;
    gap: 10px;

    .tool-card-icon {
      width: 38px;
      height: 38px;
      border-radius: 9px;
      background: linear-gradient(135deg, var(--el-color-primary-light-8), var(--el-color-primary-light-9));
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .tool-card-name-wrap {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;

      .tool-card-name {
        flex: 1;
        min-width: 0;
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .tool-card-more {
      color: var(--el-text-color-placeholder);
      cursor: pointer;
      font-size: 16px;

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }

  .tool-card-desc {
    min-height: 42px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .tool-card-url {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    .tool-card-url-text {
      flex: 1;
      min-width: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .tool-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--el-border-color-extra-light);
    padding-top: 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    .tool-card-intranet {
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--el-color-warning-light-9);
      color: var(--el-color-warning);
    }
  }
}
</style>
