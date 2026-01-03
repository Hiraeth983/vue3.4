// packages/runtime-dom/src/nodeOps.ts
var nodeOps = {
  // anchor 是锚点/参考节点，用于指定新节点插入的位置，插入到 anchor 前
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null);
  },
  remove: (child) => {
    const parent = child.parentNode;
    if (parent) {
      parent.removeChild(child);
    }
  },
  createElement: (type) => {
    return document.createElement(type);
  },
  createText: (text) => document.createTextNode(text),
  createComment: (text) => document.createComment(text),
  // 仅对文本节点生效，createText
  setText: (node, text) => {
    node.nodeValue = text;
  },
  // 清空所有子节点，设为纯文本
  setElementText: (el, text) => {
    el.textContent = text;
  },
  parentNode: (node) => node.parentNode,
  nextSibling: (node) => node.nextSibling,
  querySelector: (selector) => document.querySelector(selector)
};

// packages/runtime-dom/src/modules/patchAttr.ts
function patchAttr(el, key, value) {
  if (value === null) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
}

// packages/runtime-dom/src/modules/patchClass.ts
function patchClass(el, value) {
  if (value === null) {
    el.removeAttribute("class");
  } else {
    el.className = value;
  }
}

// packages/runtime-dom/src/modules/patchEvent.ts
function patchEvent(el, name, handler) {
  const invokers = el._vei || (el._vei = {});
  const eventName = name.slice(2).toLowerCase();
  const existingInvoker = invokers[name];
  if (existingInvoker && handler) {
    return existingInvoker.handler = handler;
  }
  if (handler) {
    const invoker = invokers[name] = createInvoker(handler);
    return el.addEventListener(eventName, invoker);
  }
  if (existingInvoker) {
    el.removeEventListener(eventName, existingInvoker);
    invokers[name] = void 0;
  }
}
function createInvoker(handler) {
  const invoker = (e) => invoker.handler(e);
  invoker.handler = handler;
  return invoker;
}

// packages/runtime-dom/src/modules/patchStyle.ts
function patchStyle(el, prevValue, nextValue) {
  const style = el.style;
  if (typeof nextValue === "string") {
    style.cssText = nextValue;
    return;
  }
  for (const key in nextValue) {
    style[key] = nextValue[key];
  }
  if (prevValue) {
    for (const key in prevValue) {
      if (nextValue && nextValue[key] === null) {
        style[key] = null;
      }
    }
  }
}

// packages/runtime-dom/src/patchProp.ts
function patchProp(el, key, prevValue, nextValue) {
  if (key === "class") {
    return patchClass(el, nextValue);
  } else if (key === "style") {
    return patchStyle(el, prevValue, nextValue);
  } else if (/^on[^a-z]/.test(key)) {
    return patchEvent(el, key, nextValue);
  } else {
    patchAttr(el, key, nextValue);
  }
}

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
var isString = (val) => typeof val === "string";
var isNumber = (val) => typeof val === "number";
var isObject = (val) => val !== null && typeof val === "object";
var isFunction = (val) => typeof val === "function";
var isArray = Array.isArray;
var isMap = (val) => toTypeString(val) === "[object Map]";
var isSet = (val) => toTypeString(val) === "[object Set]";
var objectToString = Object.prototype.toString;
var toTypeString = (value) => objectToString.call(value);
var isPlainObject = (val) => toTypeString(val) === "[object Object]";
var hasOwnProperty = Object.prototype.hasOwnProperty;
var hasOwn = (val, key) => hasOwnProperty.call(val, key);
var invokeArrayFns = (fns, ...arg) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](...arg);
  }
};
var isPromise = (val) => val && typeof val.then === "function";

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
function createGetter(isShallow2 = false, isReadonly2 = false) {
  return function get(target, key, receiver) {
    if (key === "__v_isReactive" /* IS_REACTIVE */) {
      return !isReadonly2;
    }
    if (key === "__v_isReadonly" /* IS_READONLY */) {
      return isReadonly2;
    }
    if (key === "__v_isShallow" /* IS_SHALLOW */) {
      return isShallow2;
    }
    if (key === "__v_raw" /* RAW */) {
      return target;
    }
    if (!isReadonly2 && Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }
    if (!isReadonly2) {
      track(target, key);
    }
    const result = Reflect.get(target, key, receiver);
    if (!isShallow2 && isObject(result)) {
      return isReadonly2 ? readonly(result) : reactive(result);
    }
    return result;
  };
}
function createSetter(isReadonly2 = false) {
  return function set(target, key, value, receiver) {
    if (isReadonly2) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
      return true;
    }
    const oldValue = target[key];
    const result = Reflect.set(target, key, value, receiver);
    if (oldValue !== value) {
      trigger(target, key, value, oldValue);
    }
    return result;
  };
}
function createDeleteProperty(isReadonly2 = false) {
  return function deleteProperty(target, key) {
    if (isReadonly2) {
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
      trigger(target, key, void 0, oldValue);
    }
    return result;
  };
}
var mutableHandlers = {
  get: createGetter(false, false),
  set: createSetter(false),
  deleteProperty: createDeleteProperty(false)
};
var shallowReactiveHandlers = {
  get: createGetter(true, false),
  set: createSetter(false),
  deleteProperty: createDeleteProperty(false)
};
var readonlyHandlers = {
  get: createGetter(false, true),
  set: createSetter(true),
  deleteProperty: createDeleteProperty(true)
};
var shallowReadonlyHandlers = {
  get: createGetter(true, true),
  set: createSetter(true),
  deleteProperty: createDeleteProperty(true)
};

// packages/reactivity/src/reactive.ts
var reactiveMap = /* @__PURE__ */ new WeakMap();
var shallowReactiveMap = /* @__PURE__ */ new WeakMap();
var readonlyMap = /* @__PURE__ */ new WeakMap();
var shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
function createReactiveObject(target, isShallow2 = false, isReadonly2 = false) {
  if (!isObject(target)) {
    return target;
  }
  if (target["__v_skip" /* SKIP */]) {
    return target;
  }
  if (!isReadonly2 && isReactive(target)) {
    return target;
  }
  if (isReadonly2 && isReadonly_(target)) {
    return target;
  }
  let proxyMap;
  let handlers;
  if (isShallow2) {
    proxyMap = isReadonly2 ? shallowReadonlyMap : shallowReactiveMap;
    handlers = isReadonly2 ? shallowReadonlyHandlers : shallowReactiveHandlers;
  } else {
    proxyMap = isReadonly2 ? readonlyMap : reactiveMap;
    handlers = isReadonly2 ? readonlyHandlers : mutableHandlers;
  }
  const existProxy = proxyMap.get(target);
  if (existProxy) {
    return existProxy;
  }
  const proxy = new Proxy(target, handlers);
  proxyMap.set(target, proxy);
  return proxy;
}
function reactive(target) {
  return createReactiveObject(target, false, false);
}
function shallowReactive(target) {
  return createReactiveObject(target, true, false);
}
function readonly(target) {
  return createReactiveObject(target, false, true);
}
function shallowReadonly(target) {
  return createReactiveObject(target, true, true);
}
function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}
function toRaw(observed) {
  const raw = observed && observed["__v_raw" /* RAW */];
  return raw ? toRaw(raw) : observed;
}
function markRaw(value) {
  Object.defineProperty(value, "__v_skip" /* SKIP */, {
    configurable: true,
    enumerable: false,
    value: true
  });
  return value;
}
function isReactive(value) {
  return value ? value["__v_isReactive" /* IS_REACTIVE */] === true : false;
}
function isReadonly_(value) {
  return value ? value["__v_isReadonly" /* IS_READONLY */] === true : false;
}
function isReadonly(value) {
  return isReadonly_(value);
}
function isShallow(value) {
  return value ? value["__v_isShallow" /* IS_SHALLOW */] === true : false;
}
function isProxy(value) {
  return isReactive(value) || isReadonly(value);
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

// packages/runtime-core/src/components/Teleport.ts
var isTeleport = (type) => type.__isTeleport;
var TeleportImpl = {
  name: "Teleport",
  __isTeleport: true,
  /**
   * 处理 Teleport 的挂载和更新
   */
  process(n1, n2, container, anchor, parentComponent, internals) {
    const {
      mountChildren,
      patchChildren,
      move: move2,
      querySelector,
      hostCreateComment,
      hostInsert
    } = internals;
    const disabled = n2.props?.disabled;
    const to = n2.props?.to;
    const target = typeof to === "string" ? querySelector(to) : to;
    if (n1 == null) {
      if (!disabled && !target) {
        console.warn(`[Vue warn]: Invalid Teleport target: "${to}"`);
      }
      const mainAnchor = hostCreateComment("teleport end");
      const targetAnchor = hostCreateComment("teleport start");
      hostInsert(mainAnchor, container, anchor);
      if (target) {
        hostInsert(targetAnchor, target);
      }
      n2.el = mainAnchor;
      n2.targetAnchor = targetAnchor;
      n2.target = target;
      const mountContainer = disabled || !target ? container : target;
      const mountAnchor = disabled || !target ? mainAnchor : targetAnchor;
      if (n2.shapeFlag & 16 /* ARRAY_CHILDREN */) {
        mountChildren(
          n2.children,
          mountContainer,
          mountAnchor,
          parentComponent
        );
      }
    } else {
      if (to !== n1.props?.to && !disabled && !target) {
        console.warn(`[Vue warn]: Invalid Teleport target: "${to}"`);
      }
      n2.el = n1.el;
      n2.targetAnchor = n1.targetAnchor;
      n2.target = n1.target;
      const wasDisabled = n1.props?.disabled;
      const currentContainer = disabled ? container : n2.target;
      const currentAnchor = disabled ? n2.el : n2.targetAnchor;
      patchChildren(n1, n2, currentContainer, currentAnchor, parentComponent);
      if (disabled !== wasDisabled) {
        if (disabled) {
          moveChildren(n2, container, n2.el, internals);
        } else {
          moveChildren(n2, n2.target, n2.targetAnchor, internals);
        }
      }
      if (to !== n1.props?.to && !disabled) {
        const newTarget = typeof to === "string" ? querySelector(to) : to;
        hostInsert(n2.targetAnchor, newTarget);
        moveChildren(n2, newTarget, n2.targetAnchor, internals);
        n2.target = newTarget;
      }
    }
  },
  /**
   * 移除 Teleport
   */
  remove(vnode, internals) {
    const { unmountChildren, hostRemove } = internals;
    if (vnode.shapeFlag & 16 /* ARRAY_CHILDREN */) {
      unmountChildren(vnode.children);
    }
    if (vnode.el) {
      hostRemove(vnode.el);
    }
    if (vnode.targetAnchor) {
      hostRemove(vnode.targetAnchor);
    }
  },
  /**
   * 移动 Teleport
   *  当 Teleport 本身作为子节点被父组件移动时（比如列表重排），需要这个方法。
      <div v-for="item in list" :key="item.id">
        <Teleport to="#modal">
          {{ item.content }}
        </Teleport>
      </div>
      当 list 顺序变化，diff 算法会调用 hostInsert 移动节点。但 Teleport 的结构比较特殊：
      - 原始位置只有一个 el 即 mainAnchor（注释节点）
      - 子节点实际在 target 里
      直接 hostInsert(vnode.el) 只会移动那个注释节点，子节点不会跟着动。
   */
  move(vnode, container, anchor, internals) {
    const { hostInsert } = internals;
    hostInsert(vnode.el, container, anchor);
    if (vnode.props?.disabled) {
      moveChildren(vnode, container, vnode.el, internals);
    }
  }
};
function moveChildren(vnode, container, anchor, internals) {
  const children = vnode.children;
  if (isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      move(children[i], container, anchor, internals);
    }
  }
}
function move(vnode, container, anchor, { hostInsert }) {
  const { el, type, shapeFlag, children } = vnode;
  if (shapeFlag & 6 /* COMPONENT */) {
    move(vnode.component.subTree, container, anchor, { hostInsert });
    return;
  }
  if (type === Fragment) {
    if (isArray(children)) {
      for (let i = 0; i < children.length; i++) {
        move(children[i], container, anchor, { hostInsert });
      }
    }
    if (vnode.anchor) {
      hostInsert(vnode.anchor, container, anchor);
    }
    return;
  }
  if (el) {
    hostInsert(el, container, anchor);
  }
}
var Teleport = TeleportImpl;

// packages/runtime-core/src/components/Suspense.ts
var isSuspense = (type) => type?.__isSuspense;
function createSuspenseBoundary(vnode, parentSuspense, parentComponent, container, anchor, internals) {
  const suspense = {
    vnode,
    parent: parentSuspense,
    parentComponent,
    container,
    anchor,
    // 状态管理
    deps: 0,
    // 待 resolve 的异步依赖数量
    isResolved: false,
    // 是否已全部 resolve
    isHydrating: false,
    // SSR 相关，暂不实现
    // 分支管理
    pendingBranch: null,
    // 待显示的 default 内容（异步加载中）
    activeBranch: null,
    // 当前显示的内容
    // 副作用收集（mounted 等钩子需要等 resolve 后执行）
    effects: [],
    // 超时定时器
    timeoutId: null,
    // 方法
    resolve: () => resolveSuspense(suspense, internals),
    registerDep: (instance) => registerAsyncDep(suspense, instance, internals)
  };
  return suspense;
}
function registerAsyncDep(suspense, instance, internals) {
  suspense.deps++;
  const { suspensible } = suspense.vnode.props || {};
  if (suspensible !== false && suspense.parent) {
    suspense.parent.deps++;
  }
  return function onResolve() {
    suspense.deps--;
    if (suspensible !== false && suspense.parent) {
      suspense.parent.deps--;
      if (suspense.parent.deps === 0 && !suspense.parent.isResolved) {
        suspense.parent.resolve();
      }
    }
    if (suspense.deps === 0 && !suspense.isResolved) {
      suspense.resolve();
    }
  };
}
function resolveSuspense(suspense, internals) {
  const { vnode, activeBranch, pendingBranch, container, anchor, effects } = suspense;
  const { patch, unmount, move: move2, hostInsert } = internals;
  if (suspense.timeoutId) {
    clearTimeout(suspense.timeoutId);
    suspense.timeoutId = null;
  }
  if (activeBranch) {
    unmount(activeBranch);
  }
  if (pendingBranch) {
    moveBranch(pendingBranch, container, anchor, hostInsert);
    suspense.activeBranch = pendingBranch;
    vnode.el = pendingBranch.el;
  }
  suspense.isResolved = true;
  suspense.pendingBranch = null;
  const { onResolve } = vnode.props || {};
  if (onResolve) {
    onResolve();
  }
  effects.forEach((fn) => fn());
  suspense.effects.length = 0;
}
function moveBranch(branch, container, anchor, hostInsert) {
  if (branch.type === Fragment) {
    branch.children.forEach((child) => {
      hostInsert(child.el, container, anchor);
    });
    if (branch.anchor) {
      hostInsert(branch.anchor, container, anchor);
    }
    branch.el = branch.children.length > 0 ? branch.children[0].el : branch.anchor;
  } else {
    hostInsert(branch.el, container, anchor);
  }
}
var SuspenseImpl = {
  name: "Suspense",
  __isSuspense: true,
  /**
   * 核心处理方法
   * 类似 Teleport，由 renderer 直接调用
   */
  process(n1, n2, container, anchor, parentComponent, internals) {
    if (n1 == null) {
      mountSuspense(n2, container, anchor, parentComponent, internals);
    } else {
      patchSuspense(n1, n2, container, anchor, parentComponent, internals);
    }
  },
  /**
   * 卸载
   */
  remove(vnode, internals) {
    const { unmount } = internals;
    const suspense = vnode.suspense;
    if (suspense.timeoutId) {
      clearTimeout(suspense.timeoutId);
      suspense.timeoutId = null;
    }
    if (suspense.activeBranch) {
      unmount(suspense.activeBranch);
    }
    if (suspense.pendingBranch) {
      unmount(suspense.pendingBranch);
    }
  },
  /**
   * 移动（diff 重排时用）
   */
  move(vnode, container, anchor, internals) {
    const { hostInsert } = internals;
    const suspense = vnode.suspense;
    if (suspense.activeBranch) {
      moveBranch(suspense.activeBranch, container, anchor, hostInsert);
    }
  }
};
function mountSuspense(vnode, container, anchor, parentComponent, internals) {
  const { patch, hostCreateElement, hostCreateComment, hostInsert } = internals;
  let parentSuspense = null;
  let p = parentComponent;
  while (p) {
    if (p.suspense && !p.suspense.isResolved) {
      parentSuspense = p.suspense;
      break;
    }
    p = p.parent;
  }
  const suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    container,
    anchor,
    internals
  );
  vnode.suspense = suspense;
  const { default: defaultSlot, fallback: fallbackSlot } = vnode.children || {};
  const { onPending, timeout } = vnode.props || {};
  if (onPending) {
    onPending();
  }
  const hiddenContainer = hostCreateElement("div");
  const pendingBranch = defaultSlot ? normalizeSlot(defaultSlot()) : null;
  if (pendingBranch) {
    suspense.pendingBranch = pendingBranch;
    patch(null, pendingBranch, hiddenContainer, null, {
      ...parentComponent,
      suspense
      // 注入 Suspense 边界
    });
  }
  if (suspense.deps > 0) {
    const { onFallback } = vnode.props || {};
    if (onFallback) {
      onFallback();
    }
    const fallback = fallbackSlot ? normalizeSlot(fallbackSlot()) : null;
    if (fallback) {
      patch(null, fallback, container, anchor, parentComponent);
      suspense.activeBranch = fallback;
      vnode.el = fallback.el;
    }
    if (timeout && timeout > 0) {
      suspense.timeoutId = setTimeout(() => {
        if (!suspense.isResolved) {
          const { onTimeout } = vnode.props || {};
          if (onTimeout) {
            onTimeout();
          }
        }
      }, timeout);
    }
  } else {
    if (pendingBranch) {
      moveBranch(pendingBranch, container, anchor, hostInsert);
      suspense.activeBranch = pendingBranch;
      vnode.el = pendingBranch.el;
    }
    suspense.isResolved = true;
  }
}
function patchSuspense(n1, n2, container, anchor, parentComponent, internals) {
  const { patch, patchChildren } = internals;
  const suspense = n2.suspense = n1.suspense;
  suspense.vnode = n2;
  const { default: defaultSlot, fallback: fallbackSlot } = n2.children || {};
  if (suspense.isResolved) {
    const newDefault = defaultSlot ? normalizeSlot(defaultSlot()) : null;
    if (newDefault && suspense.activeBranch) {
      patch(
        suspense.activeBranch,
        newDefault,
        container,
        anchor,
        parentComponent
      );
      suspense.activeBranch = newDefault;
      n2.el = newDefault.el;
    }
  } else {
    const newFallback = fallbackSlot ? normalizeSlot(fallbackSlot()) : null;
    if (newFallback && suspense.activeBranch) {
      patch(
        suspense.activeBranch,
        newFallback,
        container,
        anchor,
        parentComponent
      );
      suspense.activeBranch = newFallback;
      n2.el = newFallback.el;
    }
  }
}
function normalizeSlot(slot) {
  if (isArray(slot)) {
    return createVnode(Fragment, null, slot);
  }
  return slot;
}
var Suspense = SuspenseImpl;

// packages/runtime-core/src/vnode.ts
var Text = /* @__PURE__ */ Symbol.for("v-txt");
var Fragment = /* @__PURE__ */ Symbol.for("v-fgt");
var Comment = /* @__PURE__ */ Symbol.for("v-cmt");
function createVnode(type, props, children) {
  const shapeFlag = isString(type) ? 1 /* ELEMENT */ : isSuspense(type) ? 128 /* SUSPENSE */ : isTeleport(type) ? 64 /* TELEPORT */ : isObject(type) ? 4 /* STATEFUL_COMPONENT */ : 0;
  const vnode = {
    __v_isVnode: true,
    type,
    props,
    children,
    key: props?.key,
    el: null,
    // 虚拟节点对应的真实节点
    component: null,
    target: null,
    // Teleport的目标容器 真实节点
    targetAnchor: null,
    // Teleport的目标容器的挂载锚点 真实节点
    shapeFlag,
    anchor: null,
    // Fragment 的结束锚点
    suspense: null
    // Suspense 边界引用
  };
  if (children !== null) {
    let type2 = 0;
    if (isArray(children)) {
      type2 = 16 /* ARRAY_CHILDREN */;
    } else if (isObject(children)) {
      type2 = 32 /* SLOTS_CHILDREN */;
    } else if (isFunction(children)) {
      children = { default: children };
      type2 = 32 /* SLOTS_CHILDREN */;
    } else {
      children = String(children);
      type2 = 8 /* TEXT_CHILDREN */;
    }
    vnode.children = children;
    vnode.shapeFlag |= type2;
  }
  return vnode;
}
function isVnode(value) {
  return value?.__v_isVnode;
}
function isSameVnode(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}
function normalizeVnode(child) {
  if (child == null || typeof child === "boolean") {
    return createVnode(Comment, null, "");
  }
  if (isString(child) || isNumber(child)) {
    return createVnode(Text, null, String(child));
  }
  if (isArray(child)) {
    return createVnode(Fragment, null, child);
  }
  return child;
}

// packages/runtime-core/src/h.ts
function h(type, propsOrChildren, children) {
  const argsLen = arguments.length;
  if (argsLen === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      if (isVnode(propsOrChildren)) {
        return createVnode(type, null, [propsOrChildren]);
      }
      return createVnode(type, propsOrChildren);
    } else {
      return createVnode(type, null, propsOrChildren);
    }
  } else {
    if (argsLen > 3) {
      children = Array.from(arguments).slice(2);
    } else if (argsLen === 3 && isVnode(children)) {
      children = [children];
    }
    return createVnode(type, propsOrChildren, children);
  }
}

// packages/runtime-core/src/scheduler.ts
var queue = [];
var pendingPostFlushCbs = [];
var isFlushing = false;
var resolvePromise = Promise.resolve();
function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job);
  }
  queueFlush();
}
function queuePostFlushCb(cb) {
  if (!pendingPostFlushCbs.includes(cb)) {
    pendingPostFlushCbs.push(cb);
  }
  queueFlush();
}
function queueFlush() {
  if (!isFlushing) {
    isFlushing = true;
    resolvePromise.then(flushJobs);
  }
}
function flushJobs() {
  const currentQueue = queue.slice(0);
  queue.length = 0;
  currentQueue.forEach((job) => job());
  flushPostFlushCbs();
  if (queue.length || pendingPostFlushCbs.length) {
    flushJobs();
    return;
  }
  isFlushing = false;
}
function flushPostFlushCbs() {
  if (pendingPostFlushCbs.length) {
    const cbs = [...new Set(pendingPostFlushCbs)];
    pendingPostFlushCbs.length = 0;
    cbs.forEach((cb) => cb());
  }
}

// packages/runtime-core/src/utils/sequence.ts
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = u + v >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}

// packages/runtime-core/src/componentPublicInstance.ts
var publicPropertiesMap = {
  $attrs: (i) => i.attrs,
  $slots: (i) => i.slots,
  $props: (i) => i.props,
  $el: (i) => i.vnode.el
  // $emit 需要单独处理，后面再加
};
var PublicInstanceProxyHandlers = {
  get(target, key) {
    const { data, props, setupState } = target;
    if (setupState && hasOwn(setupState, key)) {
      return setupState[key];
    }
    if (data && hasOwn(data, key)) {
      return data[key];
    }
    if (props && hasOwn(props, key)) {
      return props[key];
    }
    const publicGetter = publicPropertiesMap[key];
    if (publicGetter) {
      return publicGetter(target);
    }
  },
  set(target, key, value) {
    const { data, props, setupState } = target;
    if (setupState && hasOwn(setupState, key)) {
      setupState[key] = value;
      return true;
    }
    if (data && hasOwn(data, key)) {
      data[key] = value;
      return true;
    }
    if (props && hasOwn(props, key)) {
      console.warn(`Props "${String(key)}" \u662F\u53EA\u8BFB\u7684\uFF0C\u4E0D\u80FD\u4FEE\u6539`);
      return false;
    }
    return true;
  },
  // 支持 'xxx' in this 语法
  has(target, key) {
    const { data, props, setupState } = target;
    return setupState && hasOwn(setupState, key) || data && hasOwn(data, key) || props && hasOwn(props, key) || hasOwn(publicPropertiesMap, key);
  }
};
function createComponentProxy(instance) {
  return new Proxy(instance, PublicInstanceProxyHandlers);
}

// packages/runtime-core/src/componentProps.ts
var initProps = (instance, rawProps) => {
  const props = {};
  const attrs = {};
  const options = instance.type.props || {};
  if (rawProps) {
    for (const key in rawProps) {
      const value = rawProps[key];
      if (key in options) {
        props[key] = value;
      } else {
        attrs[key] = value;
      }
    }
  }
  instance.props = shallowReactive(props);
  instance.attrs = attrs;
};
function updateProps(instance, nextRawProps) {
  const { props, attrs } = instance;
  const options = instance.type.props || {};
  if (nextRawProps) {
    for (const key in nextRawProps) {
      const value = nextRawProps[key];
      if (key in options) {
        if (props[key] !== value) {
          props[key] = value;
        }
      } else {
        if (attrs[key] !== value) {
          attrs[key] = value;
        }
      }
    }
  }
  for (const key in props) {
    if (!nextRawProps || !(key in nextRawProps)) {
      delete props[key];
    }
  }
  for (const key in attrs) {
    if (!nextRawProps || !(key in nextRawProps)) {
      delete attrs[key];
    }
  }
}

// packages/runtime-core/src/componentEmits.ts
function createEmit(instance) {
  return (event, ...args) => {
    if (instance.isUnmounted) return;
    const props = instance.vnode.props || {};
    let handlerName;
    let handler = props[handlerName = toHandlerKey(event)] || props[handlerName = toHandlerKey(camelize(event))];
    if (!handler && event.startsWith("update:")) {
      handler = props[handlerName = toHandlerKey(hyphenate(event))];
    }
    if (handler && isFunction(handler)) {
      handler(...args);
    }
    const onceHandler = props[handlerName + "Once"];
    if (onceHandler && isFunction(onceHandler)) {
      if (instance.emitted) {
        instance.emitted = {};
      } else if (instance.emitted[handlerName]) {
        return;
      }
      instance.emitted[handlerName] = true;
      onceHandler(...args);
    }
  };
}
function toHandlerKey(str) {
  if (!str) return "";
  return `on${str[0].toUpperCase()}${str.slice(1)}`;
}
function camelize(str) {
  return str.replace(/-(\w)/g, (_, c) => c.toUpperCase());
}
function hyphenate(str) {
  return str.replace(/\B([A-Z])/g, "-$1").toLowerCase();
}

// packages/runtime-core/src/component.ts
var currentInstance = null;
var instanceStack = [];
var setCurrentInstance = (instance) => {
  instanceStack.push(instance);
  currentInstance = instance;
};
var unsetCurrentInstance = () => {
  instanceStack.pop();
  currentInstance = instanceStack[instanceStack.length - 1] || null;
};
var getCurrentInstance = () => currentInstance;
function createComponentInstance(vnode, parent) {
  const instance = {
    type: vnode.type,
    // 组件定义对象（包含 props 选项、render 等）
    vnode,
    // 组件的 vnode
    provides: parent ? parent.provides : /* @__PURE__ */ Object.create(null),
    // provides 继承父组件（原型链）
    parent,
    props: null,
    // 响应式 props
    attrs: null,
    // 透传属性
    data: null,
    // data() 返回的响应式状态
    setupState: null,
    // setup 返回的状态对象（经过 proxyRefs 处理）
    render: null,
    // setup 返回的渲染函数
    proxy: null,
    subTree: null,
    isMounted: false,
    // 组件是否已挂载
    isUnmounted: false,
    // 组件是否已卸载
    update: null,
    next: null,
    // 待更新的 vnode（patchComponent 用）
    slots: {},
    // 插槽
    emit: null,
    // emit 函数
    emitted: null,
    // 已经触发过的 emitted 函数名称
    ctx: {},
    // 内部上下文，用于 KeepAlive 等内置组件
    // 生命周期钩子
    bm: null,
    // beforeMount
    m: null,
    // mounted
    bu: null,
    // beforeUpdate
    u: null,
    // updated
    bum: null,
    // beforeUnmount
    um: null,
    // unmounted
    a: null,
    // activated
    da: null,
    // deactivated
    // Suspense
    asyncDep: null,
    // setup 返回的 Promise
    asyncResolved: false,
    // 异步是否已 resolve
    suspense: null
    // 关联的 Suspense 边界
  };
  instance.emit = createEmit(instance);
  return instance;
}
function setupComponent(instance) {
  const { type, props } = instance;
  const { setup } = type;
  if (setup) {
    const setupContext = createSetupContext(instance);
    setCurrentInstance(instance);
    const setupResult = setup(props, setupContext);
    if (isPromise(setupResult)) {
      instance.asyncDep = setupResult.then(
        (result) => {
          instance.asyncResolved = true;
          handleSetupResult(instance, result);
          return result;
        },
        (err) => {
          console.error("[Vue] async setup error:", err);
        }
      ).finally(() => {
        unsetCurrentInstance();
      });
    } else {
      unsetCurrentInstance();
      handleSetupResult(instance, setupResult);
    }
  }
}
function createSetupContext(instance) {
  return {
    attrs: instance.attrs,
    slots: instance.slots,
    emit: instance.emit,
    expose: () => {
    }
    // TODO 后续实现
  };
}
function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    instance.render = setupResult;
  } else if (isObject(setupResult)) {
    instance.setupState = proxyRefs(setupResult);
  }
}

// packages/runtime-core/src/componentRenderUtils.ts
function shouldUpdateComponent(n1, n2) {
  const prevProps = n1.props;
  const nextProps = n2.props;
  if (prevProps === nextProps) return false;
  if (!prevProps) return !!nextProps;
  if (!nextProps) return true;
  return hasPropsChanged(prevProps, nextProps);
}
function hasPropsChanged(prevProps, nextProps) {
  const nextKeys = Object.keys(nextProps);
  if (Object.keys(prevProps).length !== nextKeys.length) return true;
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    if (prevProps[key] !== nextProps[key]) {
      return true;
    }
  }
  return false;
}

// packages/runtime-core/src/componentSlots.ts
function initSlots(instance, children) {
  const { shapeFlag } = instance.vnode;
  if (shapeFlag & 32 /* SLOTS_CHILDREN */) {
    normalizeObjectSlots(children, instance.slots);
  }
}
function normalizeObjectSlots(children, slots) {
  for (const key in children) {
    const value = children[key];
    slots[key] = isFunction(value) ? value : () => value;
  }
}
function updateSlots(instance, children) {
  const { slots } = instance;
  if (instance.vnode.shapeFlag & 32 /* SLOTS_CHILDREN */) {
    normalizeObjectSlots(children, slots);
  }
}

// packages/runtime-core/src/components/KeepAlive.ts
var isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
var KeepAliveImpl = {
  name: "KeepAlive",
  __isKeepAlive: true,
  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [Number, String]
  },
  setup(props, { slots }) {
    const cache = /* @__PURE__ */ new Map();
    const keys = /* @__PURE__ */ new Set();
    const instance = getCurrentInstance();
    const { move: move2, createElement, unmount: _unmount } = instance.ctx;
    const hiddenContainer = createElement("div");
    instance.ctx.activate = (vnode, container, anchor) => {
      move2(vnode, container, anchor);
      const instance2 = vnode.component;
      if (instance2.a) {
        queuePostFlushCb(() => instance2.a.forEach((fn) => fn()));
      }
    };
    instance.ctx.deactivate = (vnode) => {
      move2(vnode, hiddenContainer, null);
      const instance2 = vnode.component;
      if (instance2.da) {
        queuePostFlushCb(() => instance2.da.forEach((fn) => fn()));
      }
    };
    const pruneCacheEntry = (key) => {
      const cached = cache.get(key);
      if (cached) {
        cached.shapeFlag &= ~256 /* COMPONENT_SHOULD_KEEP_ALIVE */;
        _unmount(cached);
        cache.delete(key);
        keys.delete(key);
      }
    };
    if (!instance.um) instance.um = [];
    instance.um.push(() => {
      cache.forEach((_, key) => pruneCacheEntry(key));
    });
    const getCacheKey = (vnode) => {
      return vnode.key != null ? vnode.key : vnode.type;
    };
    const matches = (pattern, name) => {
      if (!name) return false;
      if (isString(pattern)) {
        return pattern.split(",").includes(name);
      }
      if (pattern instanceof RegExp) {
        return pattern.test(name);
      }
      if (isArray(pattern)) {
        return pattern.includes(name);
      }
      return false;
    };
    return () => {
      const children = slots.default?.();
      const rawVNode = isArray(children) ? children[0] : children;
      if (isArray(children) && children.length > 1) {
        console.warn("[KeepAlive] should have exactly one child component");
      }
      if (!isVnode(rawVNode) || !(rawVNode.shapeFlag & 4 /* STATEFUL_COMPONENT */)) {
        return rawVNode;
      }
      const component = rawVNode.type;
      const name = component.name || component.__name;
      const { include, exclude, max } = props;
      if (include && (!name || !matches(include, name)) || exclude && name && matches(exclude, name)) {
        return rawVNode;
      }
      const key = getCacheKey(rawVNode);
      const cachedVNode = cache.get(key);
      if (cachedVNode) {
        rawVNode.el = cachedVNode.el;
        rawVNode.component = cachedVNode.component;
        rawVNode.shapeFlag |= 512 /* COMPONENT_KEPT_ALIVE */;
        cache.set(key, rawVNode);
        keys.delete(key);
        keys.add(key);
      } else {
        cache.set(key, rawVNode);
        keys.add(key);
        if (max && keys.size > parseInt(max, 10)) {
          const oldestKey = keys.values().next().value;
          pruneCacheEntry(oldestKey);
        }
      }
      rawVNode.shapeFlag |= 256 /* COMPONENT_SHOULD_KEEP_ALIVE */;
      return rawVNode;
    };
  }
};
var KeepAlive = KeepAliveImpl;

// packages/runtime-core/src/renderer.ts
function createRenderer(renderOptions2) {
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    querySelector,
    patchProp: hostPatchProp
  } = renderOptions2;
  const mountChildren = (children, container, anchor = null, parentComponent = null) => {
    for (let i = 0; i < children.length; i++) {
      const child = children[i] = normalizeVnode(children[i]);
      patch(null, child, container, anchor, parentComponent);
    }
  };
  const mountElement = (vnode, container, anchor = null, parentComponent = null) => {
    const { type, children, props, shapeFlag } = vnode;
    const el = vnode.el = hostCreateElement(type);
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
      hostSetElementText(el, children);
    } else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
      mountChildren(children, el, null, parentComponent);
    }
    hostInsert(el, container, anchor);
  };
  const mountComponent = (vnode, container, anchor = null, parentComponent = null) => {
    const instance = createComponentInstance(vnode, parentComponent);
    vnode.component = instance;
    if (parentComponent?.suspense) {
      instance.suspense = parentComponent.suspense;
    }
    if (isKeepAlive(vnode)) {
      instance.ctx = {
        move(vnode2, container2, anchor2) {
          const subTree = vnode2.component.subTree;
          if (subTree.type === Fragment) {
            subTree.children.forEach((child) => {
              hostInsert(child.el, container2, anchor2);
            });
            if (subTree.anchor) {
              hostInsert(subTree.anchor, container2, anchor2);
            }
          } else {
            hostInsert(subTree.el, container2, anchor2);
          }
        },
        createElement: hostCreateElement,
        unmount
      };
    }
    initProps(instance, vnode.props);
    initSlots(instance, vnode.children);
    instance.proxy = createComponentProxy(instance);
    setupComponent(instance);
    const { data = () => {
    } } = vnode.type;
    instance.data = reactive(data.call(instance.proxy));
    if (instance.asyncDep) {
      if (instance.suspense) {
        const onResolved = instance.suspense.registerDep(instance);
        instance.asyncDep.then(() => {
          if (!instance.isUnmounted) {
            setupRenderEffect(instance, vnode, container, anchor);
            onResolved();
          }
        });
        return;
      } else {
        console.warn("[Vue] async setup used without Suspense");
        instance.asyncDep.then(() => {
          if (!instance.isUnmounted) {
            setupRenderEffect(instance, vnode, container, anchor);
          }
        });
        return;
      }
    }
    setupRenderEffect(instance, vnode, container, anchor);
  };
  const setupRenderEffect = (instance, vnode, container, anchor) => {
    const componentUpdateFn = () => {
      if (instance.isUnmounted) return;
      const render3 = instance.render || instance.type.render;
      if (!instance.isMounted) {
        if (instance.bm) {
          invokeArrayFns(instance.bm);
        }
        const subTree = render3.call(instance.proxy, instance.proxy);
        patch(null, subTree, container, anchor, instance);
        instance.isMounted = true;
        instance.subTree = subTree;
        vnode.el = subTree.el;
        if (instance.m) {
          queuePostFlushCb(() => invokeArrayFns(instance.m));
        }
      } else {
        if (instance.bu) {
          invokeArrayFns(instance.bu);
        }
        let { next, vnode: vnode2 } = instance;
        if (next) {
          next.el = vnode2.el;
          updateComponentPreRender(instance, next);
        }
        const subTree = render3.call(instance.proxy, instance.proxy);
        patch(instance.subTree, subTree, container, anchor, instance);
        instance.subTree = subTree;
        if (instance.u) {
          queuePostFlushCb(() => invokeArrayFns(instance.u));
        }
      }
    };
    const effect2 = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(instance.update)
    );
    instance.update = () => effect2.run();
    instance.update();
  };
  const updateComponentPreRender = (instance, nextVNode) => {
    instance.vnode = nextVNode;
    instance.next = null;
    updateProps(instance, nextVNode.props);
    updateSlots(instance, nextVNode.children);
  };
  const patchProps = (el, oldProps, newProps) => {
    for (const key in newProps) {
      hostPatchProp(el, key, oldProps[key], newProps[key]);
    }
    for (const key in oldProps) {
      if (!(key in newProps)) {
        hostPatchProp(el, key, oldProps[key], null);
      }
    }
  };
  const patchKeyedChildren = (c1, c2, container, anchor = null, parentComponent = null) => {
    let i = 0;
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i] = normalizeVnode(c2[i]);
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, container, null, parentComponent);
      } else {
        break;
      }
      i++;
    }
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2] = normalizeVnode(c2[e2]);
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, container, null, parentComponent);
      } else {
        break;
      }
      e1--;
      e2--;
    }
    if (i > e1 && i <= e2) {
      const nextPos = e2 + 1;
      const insertAnchor = nextPos < c2.length ? c2[nextPos].el : anchor;
      while (i <= e2) {
        patch(
          null,
          c2[i] = normalizeVnode(c2[i]),
          container,
          insertAnchor,
          parentComponent
        );
        i++;
      }
    } else if (i > e2 && i <= e1) {
      while (i <= e1) {
        unmount(c1[i]);
        i++;
      }
    } else {
      const s1 = i;
      const s2 = i;
      const keyToNewIndexMap = /* @__PURE__ */ new Map();
      for (let i2 = s2; i2 <= e2; i2++) {
        const nextChild = c2[i2] = normalizeVnode(c2[i2]);
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i2);
        }
      }
      const toBePatched = e2 - s2 + 1;
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0);
      for (let i2 = s1; i2 <= e1; i2++) {
        const oldChild = c1[i2];
        const newIndex = keyToNewIndexMap.get(oldChild.key);
        if (newIndex === void 0) {
          unmount(oldChild);
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i2 + 1;
          patch(oldChild, c2[newIndex], container, null, parentComponent);
        }
      }
      const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap);
      let j = increasingNewIndexSequence.length - 1;
      for (let i2 = toBePatched - 1; i2 >= 0; i2--) {
        const nextIndex = s2 + i2;
        const nextChild = c2[nextIndex];
        const insertAnchor = nextIndex + 1 < c2.length ? c2[nextIndex + 1].el : anchor;
        if (newIndexToOldIndexMap[i2] === 0) {
          patch(null, nextChild, container, anchor, parentComponent);
        } else if (j < 0 || i2 !== increasingNewIndexSequence[j]) {
          const child = c2[nextIndex];
          if (child.shapeFlag & 64 /* TELEPORT */) {
            TeleportImpl.move(child, container, insertAnchor, {
              hostInsert
            });
          } else if (child.shapeFlag & 128 /* SUSPENSE */) {
            SuspenseImpl.move(child, container, insertAnchor, { hostInsert });
          } else {
            hostInsert(child.el, container, insertAnchor);
          }
        } else {
          j--;
        }
      }
    }
  };
  const patchChildren = (n1, n2, container, anchor = null, parentComponent = null) => {
    const c1 = n1.children;
    const c2 = n2.children;
    const prevShapeFlag = n1.shapeFlag;
    const shapeFlag = n2.shapeFlag;
    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
      if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
        unmountChildren(c1);
      }
      if (c1 !== c2) {
        hostSetElementText(container, c2);
      }
    } else {
      if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
        if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
          patchKeyedChildren(c1, c2, container, anchor, parentComponent);
        } else {
          unmountChildren(c1);
        }
      } else {
        if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
          hostSetElementText(container, "");
        }
        if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
          mountChildren(c2, container, anchor, parentComponent);
        }
      }
    }
  };
  const patchElement = (n1, n2, parentComponent = null) => {
    const el = n2.el = n1.el;
    const oldProps = n1.props || {};
    const newProps = n2.props || {};
    patchProps(el, oldProps, newProps);
    patchChildren(n1, n2, el, null, parentComponent);
  };
  const patchComponent = (n1, n2) => {
    const instance = n2.component = n1.component;
    if (shouldUpdateComponent(n1, n2)) {
      instance.next = n2;
      instance.update();
    } else {
      n2.el = n1.el;
      instance.vnode = n2;
    }
  };
  const processComment = (n1, n2, container) => {
    if (n1 == null) {
      const el = n2.el = hostCreateComment(n2.children || "");
      hostInsert(el, container);
    } else {
      n2.el = n1.el;
    }
  };
  const processText = (n1, n2, container) => {
    if (n1 == null) {
      const el = n2.el = hostCreateText(n2.children);
      hostInsert(el, container);
    } else {
      const el = n2.el = n1.el;
      if (n1.children !== n2.children) {
        hostSetText(el, n2.children);
      }
    }
  };
  const processFragment = (n1, n2, container, anchor = null, parentComponent = null) => {
    if (n1 == null) {
      const fragmentEndAnchor = hostCreateComment("fragment end");
      hostInsert(fragmentEndAnchor, container, anchor);
      mountChildren(n2.children, container, fragmentEndAnchor, parentComponent);
      n2.el = n2.children.length > 0 ? n2.children[0].el : fragmentEndAnchor;
      n2.anchor = fragmentEndAnchor;
    } else {
      n2.el = n1.el;
      n2.anchor = n1.anchor;
      patchChildren(n1, n2, container, n2.anchor, parentComponent);
    }
  };
  const processElement = (n1, n2, container, anchor = null, parentComponent = null) => {
    if (n1 == null) {
      mountElement(n2, container, anchor, parentComponent);
    } else {
      patchElement(n1, n2, parentComponent);
    }
  };
  const processComponent = (n1, n2, container, anchor = null, parentComponent = null) => {
    if (n1 == null) {
      if (n2.shapeFlag & 512 /* COMPONENT_KEPT_ALIVE */) {
        const parent = parentComponent;
        parent.ctx.activate(n2, container, anchor);
      } else {
        mountComponent(n2, container, anchor, parentComponent);
      }
    } else {
      patchComponent(n1, n2);
    }
  };
  const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
    if (n1 === n2) {
      return;
    }
    if (n1 && !isSameVnode(n1, n2)) {
      unmount(n1);
      n1 = null;
    }
    const { type, shapeFlag } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container);
        break;
      case Comment:
        processComment(n1, n2, container);
        break;
      case Fragment:
        processFragment(n1, n2, container, anchor, parentComponent);
        break;
      default:
        if (shapeFlag & 1 /* ELEMENT */) {
          processElement(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & 6 /* COMPONENT */) {
          processComponent(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & 64 /* TELEPORT */) {
          TeleportImpl.process(n1, n2, container, anchor, parentComponent, {
            mountChildren,
            patchChildren,
            unmountChildren,
            move: hostInsert,
            hostInsert,
            hostCreateComment,
            querySelector
          });
        } else if (shapeFlag & 128 /* SUSPENSE */) {
          SuspenseImpl.process(n1, n2, container, anchor, parentComponent, {
            patch,
            mountChildren,
            patchChildren,
            unmount,
            unmountChildren,
            move: (el, container2, anchor2) => hostInsert(el, container2, anchor2),
            hostInsert,
            hostRemove,
            hostCreateElement,
            hostCreateComment,
            querySelector
          });
        }
    }
  };
  const unmount = (vnode) => {
    if (!vnode || !vnode.el) return;
    const { type, children, shapeFlag } = vnode;
    if (shapeFlag & 128 /* SUSPENSE */) {
      SuspenseImpl.remove(vnode, { unmount, unmountChildren, hostRemove });
      return;
    }
    if (shapeFlag & 64 /* TELEPORT */) {
      TeleportImpl.remove(vnode, { unmountChildren, hostRemove });
      return;
    }
    if (shapeFlag & 6 /* COMPONENT */) {
      if (shapeFlag & 256 /* COMPONENT_SHOULD_KEEP_ALIVE */) {
        const parent = vnode.component.parent;
        parent.ctx.deactivate(vnode);
        return;
      }
      unmountComponent(vnode.component);
      return;
    }
    if (type === Fragment) {
      unmountChildren(children);
      if (vnode.anchor) {
        hostRemove(vnode.anchor);
      }
      return;
    }
    hostRemove(vnode.el);
  };
  const unmountComponent = (instance) => {
    instance.isUnmounted = true;
    if (instance.bum) {
      invokeArrayFns(instance.bum);
    }
    unmount(instance.subTree);
    if (instance.um) {
      queuePostFlushCb(() => invokeArrayFns(instance.um));
    }
  };
  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
    }
  };
  const render2 = (vnode, container) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode);
      }
      container._vnode = null;
      return;
    }
    patch(container._vnode || null, vnode, container);
    container._vnode = vnode;
  };
  return {
    render: render2
  };
}

// packages/runtime-core/src/apiLifecycle.ts
function createHook(lifecycle) {
  return (hook, target = currentInstance) => {
    if (target) {
      const hooks = target[lifecycle] || (target[lifecycle] = []);
      const wrappedHook = () => {
        setCurrentInstance(target);
        try {
          hook.call(target.proxy);
        } finally {
          unsetCurrentInstance();
        }
      };
      hooks.push(wrappedHook);
    } else {
      console.warn(`${lifecycle} \u94A9\u5B50\u53EA\u80FD\u5728 setup() \u4E2D\u8C03\u7528`);
    }
  };
}
var onBeforeMount = createHook("bm" /* BEFORE_MOUNT */);
var onMounted = createHook("m" /* MOUNTED */);
var onBeforeUpdate = createHook("bu" /* BEFORE_UPDATE */);
var onUpdated = createHook("u" /* UPDATED */);
var onBeforeUnmount = createHook("bum" /* BEFORE_UNMOUNT */);
var onUnmounted = createHook("um" /* UNMOUNTED */);
var onActivated = createHook("a" /* ACTIVATED */);
var onDeactivated = createHook("da" /* DEACTIVATED */);

// packages/runtime-core/src/apiInject.ts
function provide(key, value) {
  if (!currentInstance) {
    console.warn("provide() \u53EA\u80FD\u5728 setup() \u4E2D\u8C03\u7528");
    return;
  }
  let provides = currentInstance.provides;
  const parentProvides = currentInstance.parent?.provides;
  if (provides === parentProvides) {
    provides = currentInstance.provides = Object.create(parentProvides);
  }
  provides[key] = value;
}
function inject(key, defaultValue, treatDefaultAsFactory = false) {
  const instance = currentInstance;
  if (!instance) {
    console.warn("inject() \u53EA\u80FD\u5728 setup() \u4E2D\u8C03\u7528");
    return;
  }
  const provides = instance.parent?.provides;
  if (provides && key in provides) {
    return provides[key];
  }
  if (arguments.length > 1) {
    return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
  }
  console.warn(`inject "${String(key)}" \u672A\u627E\u5230`);
}

// packages/runtime-core/src/helpers/renderSlot.ts
function renderSlot(slots, name, props = {}, fallback) {
  const slot = slots[name];
  let children;
  if (slot) {
    if (isFunction(slot)) {
      children = slot(props);
    } else {
      children = slot;
    }
  } else if (fallback) {
    children = fallback();
  }
  return createVnode(Fragment, { key: props.key }, children);
}

// packages/runtime-dom/src/index.ts
var renderOptions = Object.assign({ patchProp }, nodeOps);
var render = (vnode, container) => {
  return createRenderer(renderOptions).render(vnode, container);
};
export {
  Comment,
  ComputedRefImpl,
  Fragment,
  KeepAlive,
  ReactiveEffect,
  Suspense,
  Teleport,
  Text,
  activeEffect,
  computed,
  createRenderer,
  createVnode,
  effect,
  getCurrentInstance,
  h,
  initSlots,
  inject,
  isProxy,
  isReactive,
  isReadonly,
  isRef,
  isSameVnode,
  isShallow,
  isVnode,
  markRaw,
  normalizeVnode,
  onActivated,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onMounted,
  onUnmounted,
  onUpdated,
  pauseTracking,
  provide,
  proxyRefs,
  queueJob,
  queuePostFlushCb,
  reactive,
  readonly,
  ref,
  render,
  renderOptions,
  renderSlot,
  resetTracking,
  setupComponent,
  shallowReactive,
  shallowReadonly,
  toRaw,
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
//# sourceMappingURL=runtime-dom.esm.js.map
