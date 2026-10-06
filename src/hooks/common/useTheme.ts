import { useDark } from '@vueuse/core';

/**
 * 暗黑主题全局单例。
 *
 * vueuse 的 useDark 多实例在同一页面内互不同步（storage 事件仅跨 tab 触发），
 * 各组件独立调用会出现"设置面板已切换、业务组件 isDark 仍是旧值"的割裂
 * （如 md-editor 的 theme prop 不跟随）。所有需要感知暗黑态的地方统一从本模块取值。
 */
export const themeDark = useDark({
  storageKey: 'useDarkKey',
  valueDark: 'dark',
  valueLight: 'light'
});

/** 是否暗黑模式（响应式，读写均走本单例） */
export const useThemeDark = () => themeDark;
