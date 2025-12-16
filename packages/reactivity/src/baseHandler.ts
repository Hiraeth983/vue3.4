import { isObject } from "@vue/shared";
import { track, trigger } from "./reactiveEffect";
import { reactive } from "./reactive";
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

export const mutableHandlers: ProxyHandler<any> = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true;
    }

    // 获取原始对象
    if (key === ReactiveFlags.RAW) {
      return target;
    }

    // 数组方法重写
    if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }

    // 依赖收集 收集所访问属性对应的effect
    track(target, key);

    const result = Reflect.get(target, key, receiver); // 见 question_01.js
    if (isObject(result)) {
      return reactive(result);
    }

    return result;
  },
  set(target, key, value, receiver) {
    // 副作用注册的函数重新触发
    // 收集的依赖重新执行
    const oldValue = target[key];
    const result = Reflect.set(target, key, value, receiver);

    if (oldValue !== value) {
      // 新旧值不一样 需要触发更新
      trigger(target, key, value, oldValue);
    }

    return result;
  },
};
