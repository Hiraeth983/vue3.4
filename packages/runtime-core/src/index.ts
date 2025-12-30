// 跨平台，不关心 API 内部如何实现
export * from "@vue/reactivity";

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
  onActivated,
  onDeactivated,
} from "./apiLifecycle";
export { provide, inject } from "./apiInject";

export { getCurrentInstance, setupComponent } from "./component";

export { initSlots } from "./componentSlots";
export { renderSlot } from "./helpers/renderSlot";

export { Teleport } from "./components/Teleport";
export { KeepAlive } from "./components/KeepAlive";
