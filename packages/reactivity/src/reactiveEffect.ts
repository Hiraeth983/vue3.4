import { activeEffect, trackEffect, triggerEffects } from "./effect";
import type { ReactiveEffect } from "./effect";

export type Dep = Map<ReactiveEffect, number> & {
  cleanup: Function;
  name: string;
};

export function createDep(cleanup: Function, key: string) {
  const dep = new Map() as any;
  dep.cleanup = cleanup; // 清理函数
  dep.name = key; // 标识当前dep,方便debug
  return dep;
}

const targetMap = new WeakMap(); // 存储收集到的依赖关系

export function track(target: Object, key: any) {
  // activeEffect存在说明是在effect函数中进行访问的代理对象属性，才需要进行依赖收集
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      depsMap = new Map();
      targetMap.set(target, depsMap);
    }

    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = createDep(() => depsMap.delete(key), key)));
    }

    trackEffect(activeEffect, dep);
  }
}

export function trigger(target, key, newValue, oldValue) {
  const depsMap = targetMap.get(target);

  if (!depsMap) {
    return;
  }

  const dep = depsMap.get(key);
  if (dep) {
    triggerEffects(dep);
  }
}
