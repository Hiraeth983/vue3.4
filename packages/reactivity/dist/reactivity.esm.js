// packages/reactivity/src/effect.ts
var shouldTrack = true;
function pauseTracking() {
  shouldTrack = false;
}
function resetTracking() {
  shouldTrack = true;
}
function effect(fn, options) {
  const _effect = new ReactiveEffect(fn, () => {
    _effect.run();
  });
  _effect.run();
  if (options) {
    Object.assign(_effect, options);
  }
  const runner = _effect.run.bind(_effect);
  runner.effect = _effect;
  return runner;
}
var activeEffect = void 0;
function preCleanEffect(effect2) {
  effect2._depsLength = 0;
  effect2._trackId++;
}
function postCleanEffect(effect2) {
  if (effect2.deps.length <= effect2._depsLength) return;
  for (let i = effect2._depsLength; i < effect2.deps.length; i++) {
    cleanDepEffect(effect2.deps[i], effect2);
  }
  effect2.deps.length = effect2._depsLength;
}
var ReactiveEffect = class {
  // 是否需要响应式
  constructor(fn, scheduler) {
    this.fn = fn;
    this.scheduler = scheduler;
    this._running = 0;
    this._trackId = 0;
    // 记录当前effect执行次数
    this.deps = [];
    // 记录当前effect关联的依赖
    this._depsLength = 0;
    this._dirtyLevel = 4 /* DIRTY */;
    this.active = true;
  }
  get dirty() {
    return this._dirtyLevel === 4 /* DIRTY */;
  }
  set dirty(v) {
    this._dirtyLevel = v ? 4 /* DIRTY */ : 0 /* NO_DIRTY */;
  }
  run() {
    this.dirty = false;
    if (!this.active) {
      return this.fn();
    }
    let lastEffect = activeEffect;
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
};
function cleanDepEffect(dep, effect2) {
  dep.delete(effect2);
  if (dep.size === 0) {
    dep.cleanup();
  }
}
function trackEffect(effect2, dep) {
  if (!shouldTrack) return;
  if (dep.get(effect2) === effect2._trackId) return;
  dep.set(effect2, effect2._trackId);
  const oldDep = effect2.deps[effect2._depsLength];
  if (oldDep !== dep) {
    if (oldDep) {
      cleanDepEffect(oldDep, effect2);
    }
    effect2.deps[effect2._depsLength++] = dep;
  } else {
    effect2._depsLength++;
  }
}
function triggerEffects(dep) {
  for (const effect2 of dep.keys()) {
    if (!effect2.dirty) {
      effect2.dirty = true;
    }
    if (!effect2._running) {
      if (effect2.scheduler) {
        effect2.scheduler();
      }
    }
  }
}

// packages/shared/src/index.ts
var isObject = (val) => val !== null && typeof val === "object";
var isFunction = (val) => typeof val === "function";
var isArray = Array.isArray;
var isMap = (val) => toTypeString(val) === "[object Map]";
var isSet = (val) => toTypeString(val) === "[object Set]";
var objectToString = Object.prototype.toString;
var toTypeString = (value) => objectToString.call(value);
var isPlainObject = (val) => toTypeString(val) === "[object Object]";

// packages/reactivity/src/reactiveEffect.ts
function createDep(cleanup, key) {
  const dep = /* @__PURE__ */ new Map();
  dep.cleanup = cleanup;
  dep.name = key;
  return dep;
}
var targetMap = /* @__PURE__ */ new WeakMap();
function track(target, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      depsMap = /* @__PURE__ */ new Map();
      targetMap.set(target, depsMap);
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, dep = createDep(() => depsMap.delete(key), key));
    }
    trackEffect(activeEffect, dep);
  }
}
function trigger(target, key, newValue, oldValue) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const dep = depsMap.get(key);
  if (dep) {
    triggerEffects(dep);
  }
}

// packages/reactivity/src/baseHandler.ts
var arrayInstrumentations = createArrayInstrumentations();
function createArrayInstrumentations() {
  const instrumentations = {};
  ["push", "pop", "shift", "unshift", "splice"].forEach((key) => {
    instrumentations[key] = function(...args) {
      pauseTracking();
      const res = Array.prototype[key].apply(this, args);
      resetTracking();
      const raw = this["__v_raw" /* RAW */] || this;
      trigger(raw, "length", this.length, void 0);
      return res;
    };
  });
  return instrumentations;
}
var mutableHandlers = {
  get(target, key, receiver) {
    if (key === "__v_isReactive" /* IS_REACTIVE */) {
      return true;
    }
    if (key === "__v_raw" /* RAW */) {
      return target;
    }
    if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }
    track(target, key);
    const result = Reflect.get(target, key, receiver);
    if (isObject(result)) {
      return reactive(result);
    }
    return result;
  },
  set(target, key, value, receiver) {
    const oldValue = target[key];
    const result = Reflect.set(target, key, value, receiver);
    if (oldValue !== value) {
      trigger(target, key, value, oldValue);
    }
    return result;
  }
};

// packages/reactivity/src/reactive.ts
var reactiveMap = /* @__PURE__ */ new WeakMap();
function createReactiveObject(target) {
  if (!isObject(target)) {
    return target;
  }
  if (isReactive(target)) {
    return target;
  }
  const existProxy = reactiveMap.get(target);
  if (existProxy) {
    return existProxy;
  }
  const proxy = new Proxy(target, mutableHandlers);
  reactiveMap.set(target, proxy);
  return proxy;
}
function reactive(target) {
  return createReactiveObject(target);
}
function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}
function isReactive(obj) {
  return obj ? obj["__v_isReactive" /* IS_REACTIVE */] === true : false;
}

// packages/reactivity/src/ref.ts
function ref(value) {
  return createRef(value);
}
function createRef(value) {
  return new RefImpl(value);
}
var RefImpl = class {
  // 收集对应的effect
  constructor(rawValue) {
    this.rawValue = rawValue;
    this.__v_isRef = true;
    this._value = toReactive(rawValue);
  }
  // 类的访问器属性
  get value() {
    trackRefValue(this);
    return this._value;
  }
  set value(newValue) {
    if (newValue !== this.rawValue) {
      this.rawValue = newValue;
      this._value = toReactive(newValue);
      triggerRefValue(this);
    }
  }
};
function trackRefValue(ref2) {
  if (activeEffect) {
    if (!ref2.dep) {
      ref2.dep = createDep(() => ref2.dep = void 0, "ref");
    }
    trackEffect(activeEffect, ref2.dep);
  }
}
function triggerRefValue(ref2) {
  const dep = ref2.dep;
  if (dep) {
    triggerEffects(dep);
  }
}
function toRef(obj, key) {
  return new ObjectRefImpl(obj, key);
}
function toRefs(obj) {
  const result = {};
  for (const key in obj) {
    result[key] = toRef(obj, key);
  }
  return result;
}
var ObjectRefImpl = class {
  constructor(_object, _key) {
    this._object = _object;
    this._key = _key;
    this.__v_isRef = true;
  }
  get value() {
    return this._object[this._key];
  }
  set value(newValue) {
    this._object[this._key] = newValue;
  }
};
function isRef(obj) {
  return obj ? obj["__v_isRef" /* IS_REF */] === true : false;
}
function proxyRefs(objectWithRefs) {
  return new Proxy(objectWithRefs, {
    get(target, key, receiver) {
      const r = Reflect.get(target, key, receiver);
      return isRef(r) ? r.value : r;
    },
    set(target, key, newValue, receiver) {
      const oldValue = target[key];
      if (isRef(oldValue)) {
        oldValue.value = newValue;
        return true;
      } else {
        return Reflect.set(target, key, newValue, receiver);
      }
    }
  });
}

// packages/reactivity/src/computed.ts
function computed(getterOrOption) {
  let onlyGetter = isFunction(getterOrOption);
  let getter;
  let setter;
  if (onlyGetter) {
    getter = getterOrOption;
    setter = () => {
    };
  } else {
    getter = getterOrOption.get;
    setter = getterOrOption.set;
  }
  return new ComputedRefImpl(getter, setter);
}
var ComputedRefImpl = class {
  constructor(getter, setter) {
    this.getter = getter;
    this.setter = setter;
    this.effect = new ReactiveEffect(
      () => getter(this._value),
      () => {
        triggerRefValue(this);
      }
    );
  }
  get value() {
    if (this.effect.dirty) {
      this._value = this.effect.run();
    }
    trackRefValue(this);
    return this._value;
  }
  set value(newValue) {
    this.setter(newValue);
  }
};

// packages/reactivity/src/watch.ts
var INITIAL_WATCHER_VALUE = {};
function watch(source, cb, options = {}) {
  return doWatch(source, cb, options);
}
function watchEffect(source, options = {}) {
  return doWatch(source, null, options);
}
function doWatch(source, cb, { deep, immediate }) {
  const reactiveGetter = (source2) => deep === true ? source2 : traverse(source2, deep === false ? 1 : void 0);
  let getter;
  let isMultiSource = false;
  if (isRef(source)) {
    getter = () => source.value;
  } else if (isReactive(source)) {
    getter = () => reactiveGetter(source);
  } else if (isArray(source)) {
    isMultiSource = true;
    getter = () => source.map((s) => {
      if (isRef(s)) return s.value;
      if (isFunction(s)) return s();
      if (isReactive(s)) return reactiveGetter(s);
      return s;
    });
  } else if (isFunction(source)) {
    if (cb) {
      getter = source;
    } else {
      getter = () => source(onCleanup);
    }
  }
  if (cb && deep) {
    const baseGetter = getter;
    getter = () => traverse(baseGetter());
  }
  let cleanup;
  let onCleanup = (fn) => {
    cleanup = fn;
  };
  const callCleanup = () => {
    if (cleanup) {
      cleanup();
      cleanup = void 0;
    }
  };
  let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
  const scheduler = () => {
    callCleanup();
    if (cb) {
      const newValue = effect2.run();
      cb(
        newValue,
        oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
        onCleanup
      );
      oldValue = newValue;
    } else {
      effect2.run();
    }
  };
  const effect2 = new ReactiveEffect(getter, scheduler);
  if (cb) {
    if (immediate) {
      scheduler();
    } else {
      oldValue = effect2.run();
    }
  } else {
    effect2.run();
  }
  const unwatch = () => {
    callCleanup();
    effect2.stop();
  };
  return unwatch;
}
function traverse(value, depth = Infinity, seen = /* @__PURE__ */ new Set()) {
  if (depth <= 0 || !isObject(value)) {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  depth--;
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
        traverse(value[key], depth, seen);
      }
    }
  }
  return value;
}
export {
  ComputedRefImpl,
  ReactiveEffect,
  activeEffect,
  computed,
  effect,
  isReactive,
  isRef,
  pauseTracking,
  proxyRefs,
  reactive,
  ref,
  resetTracking,
  toReactive,
  toRef,
  toRefs,
  trackEffect,
  trackRefValue,
  triggerEffects,
  triggerRefValue,
  watch,
  watchEffect
};
//# sourceMappingURL=reactivity.esm.js.map
