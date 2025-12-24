import { isObject } from "@vue/shared";
import { mutableHandlers, shallowReactiveHandlers } from "./baseHandler";
import { ReactiveFlags } from "./constants";

// 记录代理结果 复用
const reactiveMap = new WeakMap();
// 分类存储，防止同一个对象同时创建reactive和shallowReactive时命中缓存时返回错误的响应式对象
const shallowReactiveMap = new WeakMap();

function createReactiveObject(target, isShallow = false) {
  if (!isObject(target)) {
    return target;
  }

  // 若已经是响应式对象则直接返回
  if (isReactive(target)) {
    return target;
  }

  // 根据类型选择缓存和 handler
  const proxyMap = isShallow ? shallowReactiveMap : reactiveMap;
  const handlers = isShallow ? shallowReactiveHandlers : mutableHandlers;

  // 如果存在则复用
  const existProxy = proxyMap.get(target);
  if (existProxy) {
    return existProxy;
  }

  const proxy = new Proxy(target, handlers);
  // 根据对象去缓存代理后的结果
  proxyMap.set(target, proxy);
  return proxy;
}

export function reactive(target) {
  return createReactiveObject(target);
}

export function shallowReactive(target) {
  return createReactiveObject(target, true);
}

export function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}

export function isReactive(obj) {
  return obj ? obj[ReactiveFlags.IS_REACTIVE] === true : false;
}
