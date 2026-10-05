# 知库 ZhiKu UI

> 知库（企业 AI 知识库平台）前端，配套后端 [zhiku](https://github.com/MoMingMq/zhiku)。

![Vue](https://img.shields.io/badge/Vue-3.5-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue) ![Element Plus](https://img.shields.io/badge/Element%20Plus-2.14-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

**本项目基于 [plus-ui](https://github.com/dromara/plus-ui)（RuoYi-Vue-Plus 官方前端，MIT 协议）二次开发**，衍生关系与第三方组件清单见 [NOTICE.md](./NOTICE.md)。

## 技术栈

Vue 3.5 · TypeScript · Element Plus 2.14 · Vite 8 · Pinia · UnoCSS · oxlint/oxfmt

## 开发

环境要求：Node ≥ 20.19、pnpm ≥ 10

```bash
pnpm i
pnpm dev        # 开发（默认代理到 http://localhost:8080）
pnpm build:prod # 生产构建
pnpm lint       # oxlint 检查
pnpm fmt        # oxfmt 格式化
```

环境变量（`.env.development`）：`VITE_APP_BASE_API`（接口前缀）、`VITE_APP_CLIENT_ID`、加密开关与 RSA 密钥（与后端 `api-decrypt` 配对）、监控/调度/AI 控制台地址。

## 目录速览

```
src/
├─ api/         # 按模块分目录：index.ts 函数 + types.ts 类型（Query/VO/Form）
├─ components/  # 公共组件（自动注册）：pagination / dict-tag / tree-panel / 上传系列...
├─ hooks/       # useLoading / useDialogState / useTableSelection / useSearchReset...
├─ store/       # Pinia：user / permission / dict / tagsView / notice...
├─ views/       # 页面（system / monitor / tool / workflow / demo）
└─ gen/         # 代码生成 FreeMarker 模板（与后端 ruoyi-gen 配套）
```

## 开源协议

MIT License（继承自上游），见 [LICENSE](./LICENSE) 与 [NOTICE.md](./NOTICE.md)。
