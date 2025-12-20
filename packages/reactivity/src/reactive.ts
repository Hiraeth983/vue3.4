import { isObject } from "@vue/shared";
import { mutableHandlers } from "./baseHandler";
import { ReactiveFlags } from "./constants";

// 记录代理结果 复用
const reactiveMap = new WeakMap();

function createReactiveObject(target) {
  if (!isObject(target)) {
    return target;
  }

  // 若已经是响应式对象则直接返回
  if (isReactive(target)) {
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

export function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}

export function isReactive(obj) {
  return obj ? obj[ReactiveFlags.IS_REACTIVE] === true : false;
}
