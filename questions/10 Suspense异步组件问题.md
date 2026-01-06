# Suspense 异步组件问题

## 问题一：async setup 中生命周期钩子调用失败

### 现象
```
onMounted 钩子只能在 setup() 中调用
```

### 复现代码
```js
const AsyncComponent = {
  async setup() {
    await delay(2000);  // await 之后

    onMounted(() => {   // 报错！
      console.log('mounted');
    });

    return () => h('div', 'loaded');
  }
}
```

### 原因分析

执行时序：
1. `setCurrentInstance(instance)` - currentInstance = asyncInstance
2. 执行 setup 直到 `await delay(2000)`
3. async setup 返回 Promise，`unsetCurrentInstance()` 被调用
4. **此时 currentInstance = null**
5. 2秒后 await 恢复执行
6. `onMounted()` 调用时 currentInstance = null → 报错

**根本原因**：`unsetCurrentInstance()` 在 setup 返回后立即调用，但 async setup 中 await 之后的代码还需要访问 currentInstance。

### 解决方案

#### 方案一：延迟清除 currentInstance

对于 async setup，在 Promise 完成后才清除：

```js
if (isPromise(setupResult)) {
  instance.asyncDep = setupResult
    .then((result) => {
      instance.asyncResolved = true;
      handleSetupResult(instance, result);
      return result;
    })
    .finally(() => {
      unsetCurrentInstance(); // async 完成后才清除
    });
} else {
  unsetCurrentInstance(); // sync setup 立即清除
  handleSetupResult(instance, setupResult);
}
```

#### 方案二：实例栈（解决嵌套组件渲染覆盖问题）

问题：async setup 等待期间，其他组件（如 Suspense 的 fallback）渲染会覆盖 currentInstance。

```
1. 渲染 AsyncComponent → setCurrentInstance(asyncInstance)
2. await 暂停
3. 渲染 Loading 组件 → setCurrentInstance(loadingInstance) → unsetCurrentInstance()
4. currentInstance = null ← 被 Loading 组件清除了！
5. AsyncComponent await 恢复，onMounted 调用失败
```

解决方案：使用实例栈而非单一变量：

```js
const instanceStack = [];

export const setCurrentInstance = (instance) => {
  instanceStack.push(instance);
  currentInstance = instance;
};

export const unsetCurrentInstance = () => {
  instanceStack.pop();
  // 恢复到上一个实例
  currentInstance = instanceStack[instanceStack.length - 1] || null;
};
```

---

## 问题二：多个异步组件/嵌套 Suspense 报错

### 现象
```
Uncaught TypeError: Failed to execute 'insertBefore' on 'Node':
parameter 1 is not of type 'Node'.
```

### 复现场景
```js
// 多个异步组件
h(Suspense, {}, {
  default: () => [
    h(FastAsyncComponent),
    h(AsyncComponent),
  ],
  fallback: () => h(Loading)
})
```

### 原因分析

当 default slot 返回数组时，会被 `normalizeSlot` 包装成 Fragment：

```js
function normalizeSlot(slot) {
  if (isArray(slot)) {
    return createVNode(Fragment, null, slot);
  }
  return slot;
}
```

**Fragment 的 el 是 patch 时的快照**：

```js
// processFragment 中
n2.el = n2.children[0].el;  // ← patch 时设置
```

执行时序：
1. `patch(pendingBranch)` - pendingBranch 是 Fragment
2. `processFragment` 中 `n2.el = children[0].el`
3. 但子组件是异步组件，此时 `children[0].el = undefined`（还没调用 setupRenderEffect）
4. Fragment.el = undefined
5. 异步完成后，`setupRenderEffect` 设置 `vnode.el = subTree.el`
6. 此时 `children[0].el` 有值了
7. **但 Fragment.el 还是旧的 undefined！**
8. `resolveSuspense` 中 `move(pendingBranch.el, ...)` → 移动 undefined → 报错

### 解决方案

创建 `moveBranch` 函数，直接遍历 children 获取最新的 el：

```js
function moveBranch(branch, container, anchor, hostInsert) {
  if (branch.type === Fragment) {
    // 直接使用 child.el，因为异步完成后它会更新
    // 而 branch.el 是 patch 时的快照，不会同步更新
    branch.children.forEach((child) => {
      hostInsert(child.el, container, anchor);
    });
    if (branch.anchor) {
      hostInsert(branch.anchor, container, anchor);
    }
    // 同步更新 Fragment 的 el 引用
    branch.el = branch.children.length > 0
      ? branch.children[0].el
      : branch.anchor;
  } else {
    hostInsert(branch.el, container, anchor);
  }
}
```

需要在以下位置使用 `moveBranch`：
- `resolveSuspense` 中移动 pendingBranch
- `mountSuspense` 中直接显示 default（无异步依赖时）
- `SuspenseImpl.move` 方法

---

## 总结

| 问题 | 根因 | 解决方案 |
|------|------|----------|
| async setup 中 onMounted 失败 | currentInstance 在 await 前被清除 | 延迟清除 + 实例栈 |
| Fragment 移动报错 | el 是 patch 时快照，异步更新后不同步 | moveBranch 遍历 children 获取最新 el |

**核心教训**：异步场景下，状态的"快照"和"引用"要区分清楚。
