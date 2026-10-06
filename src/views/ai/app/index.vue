<template>
  <div class="p-2 app-container">
    <!-- 应用配置界面（同页切换，对齐知识库 detail 先例） -->
    <app-detail-layout v-if="viewingAppId" :app-id="viewingAppId" @back="exitDetail" />
    <el-card v-else shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Applications</span>
            <h3>应用管理</h3>
            <p>共 {{ total }} 个应用。应用 = 模型 + 提示词 + 知识库 + 工具的编排容器。</p>
          </div>
          <div class="toolbar-actions">
            <el-input v-model="queryParams.appName" placeholder="搜索应用名称" clearable style="width: 200px" @keyup.enter="handleQuery">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button v-hasPermi="['ai:app:add']" type="primary" icon="Plus" @click="dialog.visible = true">创建应用</el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading" class="app-card-grid">
        <el-empty v-if="!loading && appList.length === 0" description="还没有应用，点击右上角创建" />
        <div v-for="row in appList" :key="row.appId" class="app-card">
          <div class="app-card-title">
            <span class="app-card-icon">
              <el-icon v-if="isElementIcon(row.icon)" :size="20"><component :is="row.icon" /></el-icon>
              <template v-else>{{ row.icon || '🤖' }}</template>
            </span>
            <span class="app-card-name" :title="row.appName">{{ row.appName }}</span>
            <span class="app-card-more-wrap" @click.stop>
              <el-dropdown trigger="click" @command="(cmd: string) => handleCardCommand(cmd, row)">
                <el-icon class="app-card-more"><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="config" v-hasPermi="['ai:app:edit']">配置</el-dropdown-item>
                    <el-dropdown-item command="chat" divided v-hasPermi="['ai:app:chat']">对话</el-dropdown-item>
                    <el-dropdown-item command="delete" v-hasPermi="['ai:app:remove']">
                      <span style="color: var(--el-color-danger)">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </span>
          </div>
          <div class="app-card-desc">{{ row.description || '暂无描述' }}</div>
          <div class="app-card-meta">
            <el-tag size="small" effect="plain">{{ row.modelName || '未选模型' }}</el-tag>
            <el-tag size="small" type="success" effect="plain">知识库 {{ row.kbIds?.length ?? 0 }}</el-tag>
            <el-tag size="small" type="warning" effect="plain">工具 {{ row.toolIds?.length ?? 0 }}</el-tag>
          </div>
          <div class="app-card-footer">
            <el-tag v-if="row.shareEnabled === '1'" size="small" type="info" effect="plain">已公开</el-tag>
            <span v-else />
            <span>{{ parseTime(row.createTime) }}</span>
          </div>
        </div>
      </div>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <!-- 新建对话框：名称/描述/应用类型（高级编排禁用） -->
    <el-dialog v-model="dialog.visible" title="创建应用" width="520px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="应用名称" prop="appName">
          <el-input v-model="form.appName" placeholder="如：智能客服助手" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="应用用途说明（可选）" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="应用类型" prop="appType">
          <el-select v-model="form.appType" style="width: 100%">
            <el-option label="简易应用" value="simple" />
            <el-option label="高级编排（敬请期待）" value="workflow" disabled />
          </el-select>
        </el-form-item>
        <el-form-item label="对话模型" prop="modelId">
          <el-select v-model="form.modelId" placeholder="选择对话模型" style="width: 100%">
            <el-option v-for="m in llmModels" :key="m.modelId" :label="`${m.modelName}（${m.modelCode}）`" :value="m.modelId" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitting" @click="submitForm">创 建</el-button>
          <el-button @click="dialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="App" lang="ts">
import api from '@/api/ai/app';
import AppDetailLayout from './detail-layout.vue';
import type { AiAppForm, AiAppQuery, AiAppVO } from '@/api/ai/app/types';
import { listAiModel } from '@/api/ai/model';
import { useLoading } from '@/hooks/async/useLoading';
import modal from '@/plugins/modal';
import { parseTime } from '@/utils/zhiku';

const appList = ref<AiAppVO[]>([]);
const viewingAppId = ref<number | string | undefined>(undefined);
const { loading, withLoading } = useLoading(true);
const total = ref(0);
const formRef = ref<ElFormInstance>();
const dialog = reactive({ visible: false });

const dialogClose = () => {
  dialog.visible = false;
  formRef.value?.resetFields();
};
const submitting = ref(false);

const queryParams = reactive<AiAppQuery>({ pageNum: 1, pageSize: 12, appName: undefined, status: undefined });

const initFormData: AiAppForm = { appId: undefined, appName: '', description: '', appType: 'simple', modelId: '' };
const form = reactive<AiAppForm>({ ...initFormData });
const rules: FormRules = {
  appName: [{ required: true, message: '应用名称不能为空', trigger: 'blur' }],
  appType: [{ required: true, message: '必须选择应用类型', trigger: 'change' }],
  modelId: [{ required: true, message: '必须选择对话模型', trigger: 'change' }]
};

const llmModels = ref<Array<{ modelId: number | string; modelName: string; modelCode: string }>>([]);

const isElementIcon = (icon: string | null | undefined): boolean => /^[A-Z][A-Za-z0-9]*$/.test(icon ?? '');

const getList = async () => {
  await withLoading(async () => {
    const res = await api.listAiApp(queryParams);
    appList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  });
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const submitForm = () => {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    submitting.value = true;
    try {
      // 新建后直接进配置页继续编排（模型在设置页选择）
      const res = await api.addAiApp(form);
      const appId = (res.data ?? '') as number | string;
      if (appId) {
        dialogClose();
        modal.msgSuccess('创建成功');
        routerPush(appId);
      }
    } finally {
      submitting.value = false;
    }
  });
};

const routerPush = (appId: number | string) => {
  viewingAppId.value = appId;
};

const exitDetail = () => {
  viewingAppId.value = undefined;
  getList();
};

const handleCardCommand = async (cmd: string, row: AiAppVO) => {
  if (cmd === 'config') {
    routerPush(row.appId);
  } else if (cmd === 'chat') {
    useRouter().push({ path: '/ai/chat', query: { appId: row.appId } });
  } else if (cmd === 'delete') {
    await modal.confirm(`删除应用"${row.appName}"？（知识库/工具挂载与会话将一并删除）`);
    await api.delAiApp(row.appId);
    modal.msgSuccess('删除成功');
    await getList();
  }
};

onMounted(async () => {
  getList();
  const res = await listAiModel({ pageNum: 1, pageSize: 100, modelType: '1' });
  llmModels.value = res.data?.rows ?? [];
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;

.app-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  min-height: 200px;

  .el-empty {
    grid-column: 1 / -1;
    place-self: center;
    padding: 48px 0;
  }
}

.app-card {
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

  .app-card-title {
    display: flex;
    align-items: center;
    gap: 10px;

    .app-card-icon {
      width: 38px;
      height: 38px;
      border-radius: 9px;
      background: linear-gradient(135deg, var(--el-color-primary-light-8), var(--el-color-primary-light-9));
      color: var(--el-color-primary);
      font-size: 19px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .app-card-name {
      flex: 1;
      font-size: 15px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .app-card-more {
      color: var(--el-text-color-placeholder);
      cursor: pointer;

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }

  .app-card-desc {
    min-height: 42px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .app-card-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .app-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--el-border-color-extra-light);
    padding-top: 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
