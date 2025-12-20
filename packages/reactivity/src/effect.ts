import { DirtyLevels } from "./constants";
import type { Dep } from "./reactiveEffect";

let shouldTrack = true;

export function pauseTracking() {
  shouldTrack = false;
}

export function resetTracking() {
  shouldTrack = true;
}

export function effect(fn: Function, options?) {
  const _effect = new ReactiveEffect(fn, () => {
    _effect.run();
  });
  _effect.run();

  // 调度执行
  if (options) {
    Object.assign(_effect, options);
  }

  const runner = _effect.run.bind(_effect);
  runner.effect = _effect;

  return runner;
}

export let activeEffect = undefined;

function preCleanEffect(effect: ReactiveEffect) {
  effect._depsLength = 0;
  effect._trackId++;
}

function postCleanEffect(effect: ReactiveEffect) {
  // [flag, name, age, xxx, yyy]
  // [flag]
  if (effect.deps.length <= effect._depsLength) return;

  for (let i = effect._depsLength; i < effect.deps.length; i++) {
    cleanDepEffect(effect.deps[i], effect); // 删除映射表中对应的effect
  }
  effect.deps.length = effect._depsLength; // 更新长度，相当于删除deps中多余的dep
}

export class ReactiveEffect {
  _running = 0;
  _trackId = 0; // 记录当前effect执行次数
  deps = []; // 记录当前effect关联的依赖
  _depsLength = 0;
  _dirtyLevel = DirtyLevels.DIRTY;
  active = true; // 是否需要响应式

  constructor(public fn: Function, public scheduler: Function) {}

  public get dirty() {
    return this._dirtyLevel === DirtyLevels.DIRTY;
  }

  public set dirty(v) {
    this._dirtyLevel = v ? DirtyLevels.DIRTY : DirtyLevels.NO_DIRTY;
  }

  run() {
    this.dirty = false;

    if (!this.active) {
      return this.fn();
    }

    // 需要响应式处理的逻辑
    let lastEffect = activeEffect; // 见 question_02.js
    try {
      activeEffect = this;
      preCleanEffect(this);
      this._running++;

      return this.fn();
    } finally {
      this._running--;
      postCleanEffect(this);
      activeEffect = lastEffect;
    }
  }

  stop() {
    if (this.active) {
      preCleanEffect(this);
      postCleanEffect(this);
      this.active = false;
    }
  }
}

function cleanDepEffect(dep: Dep, effect: ReactiveEffect) {
  dep.delete(effect);
  // 如果属性对应的dep为空，则删除这个属性
  if (dep.size === 0) {
    dep.cleanup();
  }
}

// 双向记忆
export function trackEffect(effect: ReactiveEffect, dep: Dep) {
  if (!shouldTrack) return;

  // 同一个effect和变量不触发重复收集
  if (dep.get(effect) === effect._trackId) return;
  // 更新_trackId，确保记录effect的最新执行次数
  dep.set(effect, effect._trackId);

  // 开始进行新旧dep比较，两者相同跳过不做处理，不相同则进行覆盖
  const oldDep = effect.deps[effect._depsLength];
  if (oldDep !== dep) {
    if (oldDep) {
      cleanDepEffect(oldDep, effect);
    }
    effect.deps[effect._depsLength++] = dep;
  } else {
    effect._depsLength++;
  }
}

export function triggerEffects(dep: Dep) {
  for (const effect of dep.keys()) {
    if (!effect.dirty) {
      effect.dirty = true;
    }

    if (!effect._running) {
      if (effect.scheduler) {
        effect.scheduler();
      }
    }
  }
}
