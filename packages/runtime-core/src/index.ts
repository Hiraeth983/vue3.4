// 跨平台，不关心 API 内部如何实现
export * from "./h";
export * from "./vnode";
export * from "./renderer";
export * from "./scheduler";

export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
} from "./apiLifecycle";

export { getCurrentInstance } from "./component";
