import { isObject } from "@vue/shared";
import { ReactiveEffect } from "./effect";

export function watch(source, cb, options = {} as any) {
  return doWatch(source, cb, options);
}

function doWatch(source, cb, { deep }) {
  // 递归访问source
  const reactiveGetter = (source) =>
    traverse(source, deep === false ? 1 : undefined);

  const getter = () => reactiveGetter(source);
  let oldValue;

  const scheduler = () => {
    const newValue = effect.run();
    cb(newValue, oldValue);
    oldValue = newValue;
  };

  const effect = new ReactiveEffect(getter, scheduler);
  oldValue = effect.run();
}

function traverse(source, depth, currentDepth = 0, seen = new Set()) {
  // 非对象属性直接返回
  if (!isObject(source)) {
    return source;
  }

  // 是否深度监听
  if (depth && depth <= currentDepth) {
    return source;
  }

  // 避免循环引用
  if (seen.has(source)) {
    return source;
  }
  seen.add(source);

  for (const key in source) {
    traverse(source[key], depth, currentDepth + 1, seen);
  }
  return source;
}
