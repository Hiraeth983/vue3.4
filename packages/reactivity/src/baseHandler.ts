import { isObject } from "@vue/shared";
import { track, trigger } from "./reactiveEffect";
import { reactive } from "./reactive";
import { ReactiveFlags } from "./constants";

export const mutableHandlers: ProxyHandler<any> = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true;
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
