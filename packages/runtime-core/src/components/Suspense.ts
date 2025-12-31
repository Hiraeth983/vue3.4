import { isArray } from "@vue/shared";
import { createVnode, Fragment } from "../vnode";

export const isSuspense = (type) => type?.__isSuspense;

/**
 * 每个 <Suspense> 对应一个边界对象
 * 负责追踪异步依赖、管理 pending/resolved 状态
 */
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
    // 状态管理
    deps: 0, // 待 resolve 的异步依赖数量
    isResolved: false, // 是否已全部 resolve
    isHydrating: false, // SSR 相关，暂不实现
    // 分支管理
    pendingBranch: null, // 待显示的 default 内容（异步加载中）
    activeBranch: null, // 当前显示的内容
    // 副作用收集（mounted 等钩子需要等 resolve 后执行）
    effects: [],
    // 超时定时器
    timeoutId: null,
    // 方法
    resolve: () => resolveSuspense(suspense, internals),
    registerDep: (instance) => registerAsyncDep(suspense, instance, internals),
  };

  return suspense;
}

// 异步依赖注册
function registerAsyncDep(suspense, instance, internals) {
  // 计数器 +1
  suspense.deps++;

  // 向父级 Suspense 冒泡（如果 suspensible 为 true）
  const { suspensible } = suspense.vnode.props || {};
  if (suspensible !== false && suspense.parent) {
    suspense.parent.deps++;
  }

  // 返回完成回调，让 renderer 在组件渲染完成后调用
  return function onResolve() {
    suspense.deps--;

    // 父级计数器也要减
    if (suspensible !== false && suspense.parent) {
      suspense.parent.deps--;
      if (suspense.parent.deps === 0 && !suspense.parent.isResolved) {
        suspense.parent.resolve();
      }
    }

    // 当前 Suspense
    if (suspense.deps === 0 && !suspense.isResolved) {
      suspense.resolve();
    }
  };
}

// Resolve 处理
function resolveSuspense(suspense, internals) {
  const { vnode, activeBranch, pendingBranch, container, anchor, effects } =
    suspense;
  const { patch, unmount, move } = internals;

  // 清除超时定时器
  if (suspense.timeoutId) {
    clearTimeout(suspense.timeoutId);
    suspense.timeoutId = null;
  }

  // 卸载 fallback
  if (activeBranch) {
    unmount(activeBranch);
  }

  // 将 pending 内容移到真实容器
  if (pendingBranch) {
    // pendingBranch 可能在隐藏容器中，需要移动
    move(pendingBranch.el, container, anchor);
    suspense.activeBranch = pendingBranch;
    vnode.el = pendingBranch.el;
  }

  // 清除脏数据
  suspense.isResolved = true;
  suspense.pendingBranch = null;

  // 触发 onResolve 事件
  const { onResolve } = vnode.props || {};
  if (onResolve) {
    onResolve();
  }

  // 执行收集的副作用（mounted 钩子等）
  effects.forEach((fn) => fn());
  suspense.effects.length = 0;
}

// Suspense 组件定义
export const SuspenseImpl = {
  name: "Suspense",
  __isSuspense: true,

  /**
   * 核心处理方法
   * 类似 Teleport，由 renderer 直接调用
   */
  process(n1, n2, container, anchor, parentComponent, internals) {
    if (n1 == null) {
      // 挂载
      mountSuspense(n2, container, anchor, parentComponent, internals);
    } else {
      // 更新
      patchSuspense(n1, n2, container, anchor, parentComponent, internals);
    }
  },

  /**
   * 卸载
   */
  remove(vnode, internals) {
    const { unmount } = internals;
    const suspense = vnode.suspense;

    // 清除定时器
    if (suspense.timeoutId) {
      clearTimeout(suspense.timeoutId);
      suspense.timeoutId = null;
    }

    // 卸载当前显示的分支
    if (suspense.activeBranch) {
      unmount(suspense.activeBranch);
    }
    // 卸载 pending 分支（如果有）
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
      hostInsert(suspense.activeBranch.el, container, anchor);
    }
  },
};

// 挂载 Suspense
function mountSuspense(vnode, container, anchor, parentComponent, internals) {
  const { patch, hostCreateElement, hostCreateComment, hostInsert } = internals;

  // 查找父级 Suspense（用于嵌套）
  let parentSuspense = null;
  let p = parentComponent;
  while (p) {
    // 找到父级未 resolve 的 suspense
    // 此处的数据结构不是很清楚 p.suspense 是怎么赋值的
    if (p.suspense && !p.suspense.isResolved) {
      parentSuspense = p.suspense;
      break;
    }
    p = p.parent;
  }

  // 创建 Suspense 边界
  const suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    container,
    anchor,
    internals
  );
  vnode.suspense = suspense;

  // 获取插槽
  const { default: defaultSlot, fallback: fallbackSlot } = vnode.children || {};

  // 触发 onPending 事件
  const { onPending, timeout } = vnode.props || {};
  if (onPending) {
    onPending();
  }

  // 创建隐藏容器（用于渲染 default 内容）
  const hiddenContainer = hostCreateElement("div");

  // 渲染 default 内容到隐藏容器
  const pendingBranch = defaultSlot ? normalizeSlot(defaultSlot()) : null;
  if (pendingBranch) {
    suspense.pendingBranch = pendingBranch;

    // patch 到隐藏容器，这个过程中会收集异步依赖
    // 关键：patch 时传入 suspense，让子组件知道自己在 Suspense 内
    patch(null, pendingBranch, hiddenContainer, null, {
      ...parentComponent,
      suspense, // 注入 Suspense 边界
    });
  }

  // 检查是否有异步依赖
  if (suspense.deps > 0) {
    // 有异步依赖，显示 fallback

    // 触发 onFallback 事件
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

    // 设置超时
    if (timeout && timeout > 0) {
      suspense.timeoutId = setTimeout(() => {
        if (!suspense.isResolved) {
          // 触发 onTimeout 事件
          const { onTimeout } = vnode.props || {};
          if (onTimeout) {
            onTimeout();
          }
        }
      }, timeout);
    }
  } else {
    // 没有异步依赖，直接显示 default
    if (pendingBranch) {
      // 从隐藏容器移到真实容器
      hostInsert(pendingBranch.el, container, anchor);
      suspense.activeBranch = pendingBranch;
      vnode.el = pendingBranch.el;
    }
    suspense.isResolved = true;
  }
}

// 更新 Suspense
function patchSuspense(n1, n2, container, anchor, parentComponent, internals) {
  const { patch, patchChildren } = internals;
  const suspense = (n2.suspense = n1.suspense);
  suspense.vnode = n2;

  // 获取新的插槽
  const { default: defaultSlot, fallback: fallbackSlot } = n2.children || {};

  if (suspense.isResolved) {
    // 已经 resolve，更新 default 内容
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
    // 还在 pending，更新 fallback
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
  // 插槽可能返回数组，需要包装成 Fragment
  if (isArray(slot)) {
    return createVnode(Fragment, null, slot);
  }
  return slot;
}

export const Suspense = SuspenseImpl;
