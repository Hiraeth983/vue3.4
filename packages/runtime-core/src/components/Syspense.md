# Suspense 组件实现指南

## 一、核心概念

Suspense 是一个**异步边界管理器**，用于优雅地处理异步组件加载状态。

```
┌─────────────────────────────────────────┐
│ <Suspense>                              │
│   <template #default>                   │
│     <AsyncComponent />  ← 异步组件      │
│   </template>                           │
│   <template #fallback>                  │
│     <Loading />         ← 加载中显示    │
│   </template>                           │
│ </Suspense>                             │
└─────────────────────────────────────────┘
```

### 关键数据流

```
1. async setup() 返回 Promise → 存到 instance.asyncDep
2. Suspense 发现子组件有 asyncDep → 计数器 deps++
3. 显示 fallback，等待所有 Promise
4. 所有 Promise resolve → deps === 0 → 切换到 default
```

---

## 二、实现步骤概览

| 步骤 | 文件 | 操作 | 说明 |
|------|------|------|------|
| Step 1 | `shared/index.ts` | 修改 | 添加 isPromise |
| Step 2 | `component.ts` | 修改 | 支持 async setup |
| Step 3 | `components/Suspense.ts` | 新建 | Suspense 核心实现 |
| Step 4 | `vnode.ts` | 修改 | 检测 Suspense 类型 |
| Step 5 | `renderer.ts` | 修改 | 添加 Suspense 处理逻辑 |
| Step 6 | `index.ts` | 修改 | 导出 Suspense |

---

## 三、Step 1: shared/index.ts 添加 isPromise

```typescript
// packages/shared/src/index.ts

export const isPromise = (val) =>
  val !== null &&
  typeof val === 'object' &&
  typeof val.then === 'function';
```

---

## 四、Step 2: 修改 component.ts

### 4.1 修改组件实例结构

```typescript
// packages/runtime-core/src/component.ts

export function createComponentInstance(vnode, parent) {
  const instance = {
    // ==================== 现有属性保持不变 ====================
    type: vnode.type,
    vnode,
    provides: parent ? parent.provides : Object.create(null),
    parent,
    props: null,
    attrs: null,
    data: null,
    setupState: null,
    render: null,
    proxy: null,
    subTree: null,
    isMounted: false,
    isUnmounted: false,
    update: null,
    next: null,
    slots: {},
    emit: null,
    emitted: null,
    ctx: {},
    bm: null,
    m: null,
    bu: null,
    u: null,
    bum: null,
    um: null,
    a: null,
    da: null,

    // ==================== 新增属性 ====================
    asyncDep: null,        // setup 返回的 Promise
    asyncResolved: false,  // 异步是否已 resolve
    suspense: null,        // 关联的 Suspense 边界
  };

  instance.emit = createEmit(instance);
  return instance;
}
```

### 4.2 修改 setupComponent 函数

```typescript
// packages/runtime-core/src/component.ts

import { isFunction, isObject, isPromise } from "@vue/shared";

export function setupComponent(instance) {
  const { type, props } = instance;
  const { setup } = type;

  if (setup) {
    const setupContext = createSetupContext(instance);

    setCurrentInstance(instance);
    const setupResult = setup(props, setupContext);
    unsetCurrentInstance();

    // ==================== 关键改动：检测 Promise ====================
    if (isPromise(setupResult)) {
      // async setup，存储 Promise
      instance.asyncDep = setupResult
        .then((result) => {
          instance.asyncResolved = true;
          handleSetupResult(instance, result);
          return result;
        })
        .catch((err) => {
          console.error('[Vue] async setup error:', err);
        });
    } else {
      handleSetupResult(instance, setupResult);
    }
  }
}
```

---

## 五、Step 3: 创建 Suspense.ts

```typescript
// packages/runtime-core/src/components/Suspense.ts

import { ShapeFlags } from "@vue/shared";
import { Fragment } from "../vnode";

// ==================== 类型判断 ====================
export const isSuspense = (type) => type?.__isSuspense;

// ==================== Suspense 边界对象 ====================
export function createSuspenseBoundary(
  vnode,
  parentSuspense,
  parentComponent,
  container,
  anchor,
  internals
) {
  const suspense = {
    vnode,
    parent: parentSuspense,
    parentComponent,
    container,
    anchor,
    deps: 0,
    isResolved: false,
    pendingBranch: null,
    activeBranch: null,
    effects: [],
    timeoutId: null,
    resolve: null,
    registerDep: null,
  };

  suspense.resolve = () => resolveSuspense(suspense, internals);
  suspense.registerDep = (instance) => registerAsyncDep(suspense, instance, internals);

  return suspense;
}

// ==================== 异步依赖注册 ====================
function registerAsyncDep(suspense, instance, internals) {
  suspense.deps++;

  const { suspensible } = suspense.vnode.props || {};
  if (suspensible !== false && suspense.parent) {
    suspense.parent.deps++;
  }

  instance.asyncDep
    .then(() => {
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
    })
    .catch((err) => {
      console.error('[Suspense] async dep rejected:', err);
    });
}

// ==================== Resolve 处理 ====================
function resolveSuspense(suspense, internals) {
  const { vnode, activeBranch, pendingBranch, container, anchor, effects } = suspense;
  const { unmount, move } = internals;

  if (suspense.timeoutId) {
    clearTimeout(suspense.timeoutId);
    suspense.timeoutId = null;
  }

  if (activeBranch) {
    unmount(activeBranch);
  }

  if (pendingBranch && pendingBranch.el) {
    move(pendingBranch.el, container, anchor);
    suspense.activeBranch = pendingBranch;
    vnode.el = pendingBranch.el;
  }

  suspense.isResolved = true;
  suspense.pendingBranch = null;

  const { onResolve } = vnode.props || {};
  if (onResolve) onResolve();

  effects.forEach((fn) => fn());
  suspense.effects = [];
}

// ==================== 挂载 Suspense ====================
function mountSuspense(vnode, container, anchor, parentComponent, internals) {
  const { patch, hostCreateElement, hostInsert } = internals;

  // 查找父级 Suspense
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
    vnode, parentSuspense, parentComponent, container, anchor, internals
  );
  vnode.suspense = suspense;

  const { default: defaultSlot, fallback: fallbackSlot } = vnode.children || {};

  const { onPending, timeout } = vnode.props || {};
  if (onPending) onPending();

  // 隐藏容器
  const hiddenContainer = hostCreateElement("div");

  const pendingBranch = defaultSlot ? normalizeSlot(defaultSlot()) : null;
  if (pendingBranch) {
    suspense.pendingBranch = pendingBranch;
    const suspenseContext = { ...parentComponent, suspense };
    patch(null, pendingBranch, hiddenContainer, null, suspenseContext);
  }

  if (suspense.deps > 0) {
    const { onFallback } = vnode.props || {};
    if (onFallback) onFallback();

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
          if (onTimeout) onTimeout();
        }
      }, timeout);
    }
  } else {
    if (pendingBranch && pendingBranch.el) {
      hostInsert(pendingBranch.el, container, anchor);
      suspense.activeBranch = pendingBranch;
      vnode.el = pendingBranch.el;
    }
    suspense.isResolved = true;

    const { onResolve } = vnode.props || {};
    if (onResolve) onResolve();
  }
}

// ==================== 更新 Suspense ====================
function patchSuspense(n1, n2, container, anchor, parentComponent, internals) {
  const { patch } = internals;
  const suspense = (n2.suspense = n1.suspense);
  suspense.vnode = n2;

  const { default: defaultSlot, fallback: fallbackSlot } = n2.children || {};

  if (suspense.isResolved) {
    const newDefault = defaultSlot ? normalizeSlot(defaultSlot()) : null;
    if (newDefault && suspense.activeBranch) {
      patch(suspense.activeBranch, newDefault, container, anchor, parentComponent);
      suspense.activeBranch = newDefault;
      n2.el = newDefault.el;
    }
  } else {
    const newFallback = fallbackSlot ? normalizeSlot(fallbackSlot()) : null;
    if (newFallback && suspense.activeBranch) {
      patch(suspense.activeBranch, newFallback, container, anchor, parentComponent);
      suspense.activeBranch = newFallback;
      n2.el = newFallback.el;
    }
  }
}

// ==================== 辅助函数 ====================
function normalizeSlot(slot) {
  if (Array.isArray(slot)) {
    return { type: Fragment, children: slot, shapeFlag: ShapeFlags.ARRAY_CHILDREN };
  }
  return slot;
}

// ==================== Suspense 组件定义 ====================
export const SuspenseImpl = {
  name: "Suspense",
  __isSuspense: true,

  process(n1, n2, container, anchor, parentComponent, internals) {
    if (n1 == null) {
      mountSuspense(n2, container, anchor, parentComponent, internals);
    } else {
      patchSuspense(n1, n2, container, anchor, parentComponent, internals);
    }
  },

  remove(vnode, internals) {
    const { unmount } = internals;
    const suspense = vnode.suspense;
    if (!suspense) return;

    if (suspense.timeoutId) clearTimeout(suspense.timeoutId);
    if (suspense.activeBranch) unmount(suspense.activeBranch);
    if (suspense.pendingBranch) unmount(suspense.pendingBranch);
  },

  move(vnode, container, anchor, internals) {
    const { hostInsert } = internals;
    const suspense = vnode.suspense;
    if (suspense?.activeBranch?.el) {
      hostInsert(suspense.activeBranch.el, container, anchor);
    }
  },
};

export const Suspense = SuspenseImpl;
```

---

## 六、Step 4: 修改 vnode.ts

```typescript
// packages/runtime-core/src/vnode.ts

import { isSuspense } from "./components/Suspense";
import { isTeleport } from "./components/Teleport";

export function createVnode(type, props, children?) {
  // 修改 shapeFlag 计算
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isSuspense(type)              // 新增
    ? ShapeFlags.SUSPENSE
    : isTeleport(type)
    ? ShapeFlags.TELEPORT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : isFunction(type)
    ? ShapeFlags.FUNCTIONAL_COMPONENT
    : 0;

  const vnode = {
    __v_isVnode: true,
    type,
    props,
    children,
    key: props?.key,
    el: null,
    component: null,
    target: null,
    targetAnchor: null,
    shapeFlag,
    anchor: null,
    suspense: null,    // 新增
  };

  // children 规范化逻辑保持不变...
  return vnode;
}
```

---

## 七、Step 5: 修改 renderer.ts

### 7.1 导入

```typescript
import { SuspenseImpl } from "./components/Suspense";
```

### 7.2 patch 添加 SUSPENSE 分支

```typescript
const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
  // ...
  default:
    if (shapeFlag & ShapeFlags.ELEMENT) {
      processElement(n1, n2, container, anchor, parentComponent);
    } else if (shapeFlag & ShapeFlags.COMPONENT) {
      processComponent(n1, n2, container, anchor, parentComponent);
    } else if (shapeFlag & ShapeFlags.TELEPORT) {
      TeleportImpl.process(...);
    }
    // ========== 新增 ==========
    else if (shapeFlag & ShapeFlags.SUSPENSE) {
      SuspenseImpl.process(n1, n2, container, anchor, parentComponent, {
        patch,
        mountChildren,
        patchChildren,
        unmount,
        unmountChildren,
        move: (el, container, anchor) => hostInsert(el, container, anchor),
        hostInsert,
        hostRemove,
        hostCreateElement,
        hostCreateComment,
        querySelector,
      });
    }
};
```

### 7.3 修改 mountComponent

```typescript
const mountComponent = (vnode, container, anchor = null, parentComponent = null) => {
  const instance = createComponentInstance(vnode, parentComponent);
  vnode.component = instance;

  // ========== 新增：关联 Suspense ==========
  if (parentComponent?.suspense) {
    instance.suspense = parentComponent.suspense;
  }

  // ... KeepAlive 逻辑保持不变

  initProps(instance, vnode.props);
  initSlots(instance, vnode.children);
  instance.proxy = createComponentProxy(instance);
  setupComponent(instance);

  const { data = () => ({}) } = vnode.type;
  instance.data = reactive(data.call(instance.proxy));

  // ========== 新增：检查异步依赖 ==========
  if (instance.asyncDep) {
    if (instance.suspense) {
      instance.suspense.registerDep(instance);
      instance.asyncDep.then(() => {
        if (!instance.isUnmounted) {
          setupRenderEffect(instance, vnode, container, anchor);
        }
      });
      return;
    } else {
      console.warn('[Vue] Async component without Suspense');
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
```

### 7.4 unmount 添加 Suspense 处理

```typescript
const unmount = (vnode) => {
  if (!vnode || !vnode.el) return;
  const { type, children, shapeFlag } = vnode;

  // ========== 新增 ==========
  if (shapeFlag & ShapeFlags.SUSPENSE) {
    SuspenseImpl.remove(vnode, { unmount, unmountChildren, hostRemove });
    return;
  }

  // ... 其他逻辑保持不变
};
```

### 7.5 patchKeyedChildren 添加移动处理

```typescript
// 乱序部分
if (child.shapeFlag & ShapeFlags.TELEPORT) {
  TeleportImpl.move(child, container, insertAnchor, { hostInsert });
}
// ========== 新增 ==========
else if (child.shapeFlag & ShapeFlags.SUSPENSE) {
  SuspenseImpl.move(child, container, insertAnchor, { hostInsert });
}
else {
  hostInsert(child.el, container, insertAnchor);
}
```

---

## 八、Step 6: 更新导出

```typescript
// packages/runtime-core/src/index.ts

export { Suspense } from "./components/Suspense";
```

---

## 九、完整流程图

```
h(Suspense, props, slots)
    │
    ▼
createVnode() → shapeFlag = SUSPENSE
    │
    ▼
patch() → SuspenseImpl.process()
    │
    ▼
mountSuspense()
├── 创建 SuspenseBoundary
├── 触发 onPending
├── 创建隐藏容器
├── patch(default) 到隐藏容器
│   └── mountComponent(AsyncComp)
│       └── setup() 返回 Promise
│           └── suspense.registerDep() → deps++
│
├── if (deps > 0)
│   ├── 触发 onFallback
│   ├── patch(fallback) 到真实容器
│   └── 设置 timeout
│
└── 等待 Promise...
    │
    ▼
Promise.resolve() → deps-- → deps === 0
    │
    ▼
suspense.resolve()
├── unmount(fallback)
├── move(default) 到真实容器
├── 触发 onResolve
└── 执行 effects
```

---

## 十、Props 说明

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `timeout` | `Number` | `0` | 超时时间（ms） |
| `suspensible` | `Boolean` | `true` | 是否向父级冒泡 |
| `onPending` | `Function` | - | 进入 pending 时 |
| `onResolve` | `Function` | - | resolve 后 |
| `onFallback` | `Function` | - | 显示 fallback 时 |
| `onTimeout` | `Function` | - | 超时时 |

---

## 十一、使用示例

```typescript
import { h, Suspense, render } from '@vue/runtime-dom';

// 异步组件
const AsyncComp = {
  async setup() {
    await new Promise(r => setTimeout(r, 2000));
    return () => h('div', '加载完成！');
  }
};

// 使用
const App = {
  setup() {
    return () => h(Suspense, {
      timeout: 5000,
      onPending: () => console.log('开始加载'),
      onResolve: () => console.log('加载完成'),
      onFallback: () => console.log('显示 loading'),
      onTimeout: () => console.log('超时了'),
    }, {
      default: () => h(AsyncComp),
      fallback: () => h('div', 'Loading...')
    });
  }
};

render(h(App), document.getElementById('app'));
```

---

## 十二、注意事项

1. 确认 `ShapeFlags.SUSPENSE = 1 << 7` 已定义
2. 先实现基础版本，再添加 timeout、事件、嵌套
3. 调试时在 `registerDep` 和 `resolve` 加 log 追踪
