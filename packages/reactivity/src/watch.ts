import {
  isArray,
  isFunction,
  isMap,
  isObject,
  isPlainObject,
  isSet,
} from "@vue/shared";
import { ReactiveEffect } from "./effect";
import { isRef } from "./ref";
import { isReactive } from "./reactive";

const INITIAL_WATCHER_VALUE = {};

export function watch(source, cb, options = {} as any) {
  return doWatch(source, cb, options);
}

function doWatch(source, cb, { deep }) {
  // 递归访问source
  const reactiveGetter = (source) =>
    deep === true
      ? source // 后面会统一 traverse
      : traverse(source, deep === false ? 1 : undefined);

  let getter;
  let isMultiSource = false;

  // 支持多种source类型
  if (isRef(source)) {
    getter = () => source.value;
  } else if (isReactive(source)) {
    getter = () => reactiveGetter(source);
  } else if (isArray(source)) {
    isMultiSource = true;
    getter = () =>
      source.map((s) => {
        if (isRef(s)) return s.value;
        if (isFunction(s)) return s();
        if (isReactive(s)) return reactiveGetter(s);
        return s;
      });
  } else if (isFunction(source)) {
    getter = source;
  }

  // 统一处理 deep
  if (cb && deep) {
    const baseGetter = getter;
    getter = () => traverse(baseGetter());
  }

  let oldValue = isMultiSource
    ? new Array(source.length).fill(INITIAL_WATCHER_VALUE)
    : INITIAL_WATCHER_VALUE;

  const scheduler = () => {
    const newValue = effect.run();
    cb(newValue, oldValue);
    oldValue = newValue;
  };

  const effect = new ReactiveEffect(getter, scheduler);
  oldValue = effect.run();

  // 停止监听函数
  const unwatch = () => {
    effect.stop();
  };

  return unwatch;
}

function traverse(value, depth = Infinity, seen = new Set()) {
  // 遍历到目标层级 || 非对象属性 直接返回
  if (depth <= 0 || !isObject(value)) {
    return value;
  }

  // 避免循环引用
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  depth--;

  // value分类型处理
  if (isRef(value)) {
    traverse(value.value, depth, seen);
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, seen);
    }
  } else if (isMap(value) || isSet(value)) {
    value.forEach((v) => {
      traverse(v, depth, seen);
    });
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], depth, seen);
    }
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        traverse(value[key as any], depth, seen);
      }
    }
  }

  return value;
}
