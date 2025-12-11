import { isObject } from "@vue/shared";
import { mutableHandlers, ReactiveFlags } from "./baseHandler";

// 记录代理结果 复用
const reactiveMap = new WeakMap();

function createReactiveObject(target) {
  if (!isObject(target)) {
    return target;
  }

  // 若已经是响应式对象则直接返回
  if (target[ReactiveFlags.IS_REACTIVE]) {
    return target;
  }

  // 如果存在则复用
  const existProxy = reactiveMap.get(target);
  if (existProxy) {
    return existProxy;
  }

  const proxy = new Proxy(target, mutableHandlers);
  // 根据对象去缓存代理后的结果
  reactiveMap.set(target, proxy);
  return proxy;
}

export function reactive(target) {
  return createReactiveObject(target);
}
