import { hasOwn, isObject } from "@vue/shared";
import { track, trigger } from "./reactiveEffect";
import { reactive, readonly } from "./reactive";
import { ReactiveFlags } from "./constants";
import { pauseTracking, resetTracking } from "./effect";

const arrayInstrumentations = createArrayInstrumentations();

function createArrayInstrumentations() {
  const instrumentations = {};

  ["push", "pop", "shift", "unshift", "splice"].forEach((key) => {
    instrumentations[key] = function (...args) {
      // 暂停依赖收集，避免 push 时访问 length 导致死循环
      pauseTracking();
      const res = Array.prototype[key].apply(this, args);
      resetTracking();

      // 获取原始对象
      const raw = this[ReactiveFlags.RAW] || this;
      // 触发 length 依赖
      trigger(raw, "length", this.length, undefined);
      return res;
    };
  });

  return instrumentations;
}

function createGetter(isShallow = false, isReadonly = false) {
  return function get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      // 只读对象不是 reactive
      return !isReadonly;
    }

    if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    }

    if (key === ReactiveFlags.IS_SHALLOW) {
      return isShallow;
    }

    // 获取原始对象
    if (key === ReactiveFlags.RAW) {
      return target;
    }

    // 数组方法重写 且只读不需要拦截数组
    if (
      !isReadonly &&
      Array.isArray(target) &&
      arrayInstrumentations.hasOwnProperty(key)
    ) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }

    // 依赖收集 收集所访问属性对应的effect 非只读状态下才进行依赖收集
    if (!isReadonly) {
      track(target, key);
    }

    const result = Reflect.get(target, key, receiver); // 见 question_01.js
    if (!isShallow && isObject(result)) {
      // 只读用 readonly 包装，响应式用 reactive 包装
      return isReadonly ? readonly(result) : reactive(result);
    }

    return result;
  };
}

function createSetter(isReadonly = false) {
  return function set(target, key, value, receiver) {
    if (isReadonly) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
      return true;
    }

    // 副作用注册的函数重新触发
    // 收集的依赖重新执行
    const oldValue = target[key];
    const result = Reflect.set(target, key, value, receiver);

    if (oldValue !== value) {
      // 新旧值不一样 需要触发更新
      trigger(target, key, value, oldValue);
    }

    return result;
  };
}

function createDeleteProperty(isReadonly = false) {
  return function deleteProperty(target, key) {
    if (isReadonly) {
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
      return true;
    }

    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
      trigger(target, key, undefined, oldValue);
    }
    return result;
  };
}

export const mutableHandlers: ProxyHandler<any> = {
  get: createGetter(false, false),
  set: createSetter(false),
  deleteProperty: createDeleteProperty(false),
};

export const shallowReactiveHandlers: ProxyHandler<any> = {
  get: createGetter(true, false),
  set: createSetter(false),
  deleteProperty: createDeleteProperty(false),
};

export const readonlyHandlers: ProxyHandler<any> = {
  get: createGetter(false, true),
  set: createSetter(true),
  deleteProperty: createDeleteProperty(true),
};

export const shallowReadonlyHandlers: ProxyHandler<any> = {
  get: createGetter(true, true),
  set: createSetter(true),
  deleteProperty: createDeleteProperty(true),
};
