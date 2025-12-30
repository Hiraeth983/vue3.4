# KeepAlive 生命周期钩子延迟 Bug 分析

## 问题现象

在使用 KeepAlive 组件时，`onActivated` 和 `onDeactivated` 钩子中调用的 `addLog` 函数更新日志面板时，**日志总是"慢一步"**：

- 刷新页面初始化为 TabA，日志面板没有显示 "TabA mounted"
- 点击 TabC 后，日志面板才显示 "TabA mounted"
- 从 TabC 切换到 TabD，日志面板显示的是上一次操作的结果

## 问题定位过程

### 1. 初步排查

首先怀疑是 KeepAlive 的 `activate/deactivate` 实现问题，通过添加 console.log 发现：
- `DEACTIVATE` 和 `ACTIVATE` 的组件名都是正确的
- 钩子确实被调用了（有 console.log 输出）
- 但日志面板的更新有延迟

### 2. 发现关键线索

不管是否使用 `queuePostFlushCb`，日志面板的更新都会延迟一步。这说明问题不在 KeepAlive 本身，而在调度器。

## 根本原因

问题出在 `scheduler.ts` 的 `flushJobs` 函数：

```javascript
// 有问题的代码
function flushJobs() {
  // 1. 执行组件更新任务
  const currentQueue = queue.slice(0);
  queue.length = 0;
  currentQueue.forEach((job) => job());

  // 2. 执行 post 回调（生命周期钩子）
  flushPostFlushCbs();

  // 问题：直接结束，没有检查是否有新任务
  isFlushing = false;
}
```

### 执行流程分析

当用户从 TabC 切换到 TabD 时：

```
1. 响应式数据变化 → 触发 KeepAlive 更新
2. queueJob(KeepAlive.update) → queue = [KeepAlive.update]
3. queueFlush() → isFlushing = true，调度 flushJobs
4. 微任务执行 flushJobs：
   │
   ├─ 步骤1：执行 queue 中的任务
   │   └─ KeepAlive.update() 执行
   │       └─ patch 比较新旧子组件
   │           ├─ unmount(TabC) → deactivate(TabC)
   │           │   └─ queuePostFlushCb(执行 TabC.da 钩子)
   │           └─ processComponent(TabD) → activate(TabD)
   │               └─ queuePostFlushCb(执行 TabD.a 钩子)
   │
   ├─ 步骤2：执行 post 回调
   │   └─ flushPostFlushCbs()
   │       ├─ 执行 TabC.da 钩子 → addLog("TabC deactivated")
   │       │   └─ logs.value 变化 → 触发 LogPanel 更新
   │       │       └─ queueJob(LogPanel.update)  ← 新任务入队！
   │       │           └─ queue = [LogPanel.update]
   │       │               └─ queueFlush() → isFlushing 仍为 true，不调度
   │       └─ 执行 TabD.a 钩子 → addLog("TabD activated")
   │           └─ 同上，又有新任务入队
   │
   └─ 步骤3：isFlushing = false，flushJobs 结束
       └─ 此时 queue = [LogPanel.update, ...]，但没人执行！
```

**问题关键**：当 `flushPostFlushCbs` 中的钩子修改响应式数据时，会触发新的组件更新（LogPanel），新任务被添加到 queue。但由于 `isFlushing` 仍为 true，`queueFlush` 不会再次调度执行。等 `flushJobs` 结束后，queue 中的任务被遗留，要等到下一次用户交互才会执行。

## 解决方案

在 `flushPostFlushCbs` 执行后，检查是否有新任务产生，如果有就递归继续执行：

```javascript
// 修复后的代码
function flushJobs() {
  // 1. 执行组件更新任务
  const currentQueue = queue.slice(0);
  queue.length = 0;
  currentQueue.forEach((job) => job());

  // 2. 执行 post 回调（生命周期钩子）
  flushPostFlushCbs();

  // 3. 如果 post 回调中触发了新的更新或回调，继续执行
  // 这是关键：生命周期钩子可能修改响应式数据，触发新的组件更新
  if (queue.length || pendingPostFlushCbs.length) {
    flushJobs();
    return;
  }

  isFlushing = false;
}
```

## 修复后的执行流程

```
flushJobs 执行：
  ├─ 执行组件更新任务
  ├─ 执行 post 回调
  │   └─ 钩子修改响应式数据 → 新任务入队
  ├─ 检查：queue.length > 0 ? → 是
  └─ 递归调用 flushJobs()
      ├─ 执行 queue 中的新任务（LogPanel.update）
      ├─ 执行 post 回调（如果有）
      ├─ 检查：queue.length > 0 ? → 否
      └─ isFlushing = false，结束
```

## 经验总结

1. **调度器设计要考虑副作用链**：生命周期钩子可能触发新的响应式更新，调度器需要处理这种"级联更新"场景

2. **Vue 官方实现的参考**：Vue 3 源码中的 `flushJobs` 使用 while 循环持续刷新，直到队列为空：
   ```javascript
   function flushJobs() {
     isFlushPending = false
     isFlushing = true
     // 持续刷新直到队列为空
     while (queue.length) {
       // ...
     }
     // 执行 post 回调后再次检查
     flushPostFlushCbs()
     if (queue.length || pendingPostFlushCbs.length) {
       flushJobs()
     }
     isFlushing = false
   }
   ```

3. **调试技巧**：当 UI 更新延迟时，优先检查调度器的任务队列处理逻辑，特别是 `isFlushing` 标志位的管理

## 相关文件

- `packages/runtime-core/src/scheduler.ts` - 调度器实现
- `packages/runtime-core/src/components/KeepAlive.ts` - KeepAlive 组件
- `packages/runtime-core/src/apiLifecycle.ts` - 生命周期钩子注册
