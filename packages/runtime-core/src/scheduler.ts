const queue = []; // 待执行的任务队列（组件更新函数）
const pendingPostFlushCbs = []; // post 阶段回调（mounted/updated 等）
let isFlushing = false; // 是否正在刷新队列
const resolvePromise = Promise.resolve(); // 用于创建微任务

// 添加组件更新任务
export function queueJob(job) {
  // 去重：同一个组件的 update 函数只入队一次
  if (!queue.includes(job)) {
    queue.push(job);
  }

  queueFlush(); // 触发刷新
}

// 添加 post 阶段回调（mounted/updated/unmounted 用）
export function queuePostFlushCb(cb) {
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

function flushPostFlushCbs() {
  if (pendingPostFlushCbs.length) {
    // 去重并复制
    const cbs = [...new Set(pendingPostFlushCbs)];
    pendingPostFlushCbs.length = 0;
    cbs.forEach((cb) => cb());
  }
}
