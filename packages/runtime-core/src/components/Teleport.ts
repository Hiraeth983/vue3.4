import { Fragment } from "./../vnode";
import { isArray, ShapeFlags } from "@vue/shared";

export const TeleportEndKey = Symbol("_vte");

// 判断是否是 Teleport
export const isTeleport = (type) => type.__isTeleport;

export const TeleportImpl = {
  name: "Teleport",
  __isTeleport: true,
  /**
   * 处理 Teleport 的挂载和更新
   */
  process(n1, n2, container, anchor, parentComponent, internals) {
    // 外部传入的统一的元素处理方法
    const {
      mountChildren,
      patchChildren,
      move,
      querySelector,
      hostCreateComment,
      hostInsert,
    } = internals;

    // Teleport props
    const disabled = n2.props?.disabled;
    const to = n2.props?.to;

    // 解析目标容器
    const target = typeof to === "string" ? querySelector(to) : to;

    if (n1 == null) {
      // ========== 挂载 ==========

      // target 不存在警告
      if (!disabled && !target) {
        console.warn(`[Vue warn]: Invalid Teleport target: "${to}"`);
      }

      // 创建锚点注释节点：1.目标容器可能存在其他内容，锚点确保子节点 插入到正确位置；2.disabled切换时，需要知道原始位置；3.卸载时需要明确哪些节点属于Teleport
      const mainAnchor = hostCreateComment("teleport end");
      const targetAnchor = hostCreateComment("teleport start");

      // 在原始位置插入结束锚点（用于 disabled 回退定位）
      hostInsert(mainAnchor, container, anchor);

      // 在目标容器插入开始锚点
      if (target) {
        hostInsert(targetAnchor, target);
      }

      // 相关锚点信息保存到 vnode 上
      n2.el = mainAnchor; // vnode.el 指向原始位置的锚点
      n2.targetAnchor = targetAnchor;
      n2.target = target;

      // 决定挂载位置 // target 不存在时，降级挂载到原始位置
      const mountContainer = disabled || !target ? container : target;
      const mountAnchor = disabled || !target ? mainAnchor : targetAnchor;

      // 模版编译后 Teleport 的 children 一定是数组
      if (n2.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        mountChildren(
          n2.children,
          mountContainer,
          mountAnchor,
          parentComponent
        );
      }
    } else {
      // ========== 更新 ==========

      // 只有 to 变化时才检查新 target
      if (to !== n1.props?.to && !disabled && !target) {
        console.warn(`[Vue warn]: Invalid Teleport target: "${to}"`);
      }

      // 继承锚点引用
      n2.el = n1.el;
      n2.targetAnchor = n1.targetAnchor;
      n2.target = n1.target;

      const wasDisabled = n1.props?.disabled;
      const currentContainer = disabled ? container : n2.target;
      const currentAnchor = disabled ? n2.el : n2.targetAnchor;

      // 先更新子节点，再移动节点位置
      // patch children
      patchChildren(n1, n2, currentContainer, currentAnchor, parentComponent);

      // disabled 变化 → 移动子节点
      if (disabled !== wasDisabled) {
        if (disabled) {
          // 从 target 移回原始位置
          moveChildren(n2, container, n2.el, internals);
        } else {
          // 从原始位置移到 target
          moveChildren(n2, n2.target, n2.targetAnchor, internals);
        }
      }

      // to 变化 → 移动子节点到新目标
      if (to !== n1.props?.to && !disabled) {
        const newTarget = typeof to === "string" ? querySelector(to) : to;
        // 移动锚点和子节点到新目标
        hostInsert(n2.targetAnchor, newTarget); // 移动锚点
        moveChildren(n2, newTarget, n2.targetAnchor, internals); // 根据锚点将子节点移动过去
        n2.target = newTarget;
      }
    }
  },

  /**
   * 移除 Teleport
   */
  remove(vnode, internals) {
    const { unmountChildren, hostRemove } = internals;

    // 卸载子节点
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(vnode.children);
    }

    // 移除原始位置的锚点
    if (vnode.el) {
      hostRemove(vnode.el);
    }

    // 移除目标容器的锚点
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

    // 移动原始位置的锚点
    hostInsert(vnode.el, container, anchor);

    // 如果 disabled，子节点在原始位置，也要移动
    if (vnode.props?.disabled) {
      moveChildren(vnode, container, vnode.el, internals);
    }
  },
};

// 移动子节点到新容器
function moveChildren(vnode, container, anchor, internals) {
  const children = vnode.children;
  if (isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      // 子节点可能是 Fragment 或 组件，它们不是单个 DOM 节点
      // Fragment 或 组件 可能有多个根节点，el 只指向第一个根节点
      move(children[i], container, anchor, internals);
    }
  }
}

// 移动单个 vnode
function move(vnode, container, anchor, { hostInsert }) {
  const { el, type, shapeFlag, children } = vnode;

  // 组件：移动其渲染结果
  // 组件的subTree是render函数渲染出来的单vnode节点，如果组件存在多个根节点，则是Fragment类型包裹的单vnode节点
  if (shapeFlag & ShapeFlags.COMPONENT) {
    move(vnode.component.subTree, container, anchor, { hostInsert });
    return;
  }

  // Fragment：移动所有子节点 + anchor
  // children 是多个 vnode 的数组
  if (type === Fragment) {
    // 移动所有子节点
    if (isArray(children)) {
      for (let i = 0; i < children.length; i++) {
        move(children[i], container, anchor, { hostInsert });
      }
    }
    // 移动 fragment 的结束锚点
    if (vnode.anchor) {
      hostInsert(vnode.anchor, container, anchor);
    }
    return;
  }

  // 普通元素/文本/注释
  if (el) {
    hostInsert(el, container, anchor);
  }
}

export const Teleport = TeleportImpl;
