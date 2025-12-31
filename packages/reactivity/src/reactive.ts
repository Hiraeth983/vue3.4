import { isObject } from "@vue/shared";
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers,
} from "./baseHandler";
import { ReactiveFlags } from "./constants";

// 记录代理结果 复用
const reactiveMap = new WeakMap();
// 分类存储，防止同一个对象同时创建reactive和shallowReactive时命中缓存时返回错误的响应式对象
const shallowReactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
const shallowReadonlyMap = new WeakMap();

function createReactiveObject(target, isShallow = false, isReadonly = false) {
  if (!isObject(target)) {
    return target;
  }

  // markRaw标记，直接返回
  if (target[ReactiveFlags.SKIP]) {
    return target;
  }

  // 同类型代理直接返回
  if (!isReadonly && isReactive(target)) {
    return target;
  }
  if (isReadonly && isReadonly_(target)) {
    return target;
  }

  // 根据类型选择缓存和 handler
  let proxyMap;
  let handlers;
  if (isShallow) {
    proxyMap = isReadonly ? shallowReadonlyMap : shallowReactiveMap;
    handlers = isReadonly ? shallowReadonlyHandlers : shallowReactiveHandlers;
  } else {
    proxyMap = isReadonly ? readonlyMap : reactiveMap;
    handlers = isReadonly ? readonlyHandlers : mutableHandlers;
  }

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
  return createReactiveObject(target, false, false);
}

export function shallowReactive(target) {
  return createReactiveObject(target, true, false);
}

export function readonly(target) {
  return createReactiveObject(target, false, true);
}

export function shallowReadonly(target) {
  return createReactiveObject(target, true, true);
}

export function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}

/**
 * 获取响应式对象的原始对象（递归剥离）
 */
export function toRaw(observed) {
  const raw = observed && observed[ReactiveFlags.RAW];
  return raw ? toRaw(raw) : observed;
}

/**
 * 标记对象永不转为响应式
 */
export function markRaw(value) {
  Object.defineProperty(value, ReactiveFlags.SKIP, {
    configurable: true,
    enumerable: false,
    value: true,
  });
  return value;
}

export function isReactive(value) {
  return value ? value[ReactiveFlags.IS_REACTIVE] === true : false;
}

// 内部使用 避免与变量名冲突
function isReadonly_(value) {
  return value ? value[ReactiveFlags.IS_READONLY] === true : false;
}

export function isReadonly(value) {
  return isReadonly_(value);
}

export function isShallow(value) {
  return value ? value[ReactiveFlags.IS_SHALLOW] === true : false;
}

export function isProxy(value) {
  return isReactive(value) || isReadonly(value);
}
