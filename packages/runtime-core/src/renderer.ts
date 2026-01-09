import { invokeArrayFns, PatchFlags, ShapeFlags } from "@vue/shared";
import {
  isSameVnode,
  Text,
  Fragment,
  Comment,
  normalizeVnode,
  VNode,
} from "./vnode";
import { reactive, ReactiveEffect } from "@vue/reactivity";
import { queueJob, queuePostFlushCb } from "./scheduler";
import { getSequence } from "./utils/sequence";
import { createComponentProxy } from "./componentPublicInstance";
import { initProps, updateProps } from "./componentProps";
import { createComponentInstance, setupComponent } from "./component";
import { shouldUpdateComponent } from "./componentRenderUtils";
import { initSlots, updateSlots } from "./componentSlots";
import { TeleportImpl } from "./components/Teleport";
import { isKeepAlive } from "./components/KeepAlive";
import { SuspenseImpl } from "./components/Suspense";

export function createRenderer(renderOptions) {
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
    patchProp: hostPatchProp,
  } = renderOptions;

  const mountChildren = (
    children,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    for (let i = 0; i < children.length; i++) {
      // 此处children[i]可能是纯文本元素
      const child = (children[i] = normalizeVnode(children[i]));
      patch(null, child, container, anchor, parentComponent);
    }
  };

  const mountElement = (
    vnode,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    const { type, children, props, shapeFlag } = vnode;

    // 创建节点
    const el = (vnode.el = hostCreateElement(type));

    // 添加属性
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }

    // 子节点 虚拟节点存在 shapeFlag 属性,用于判断子节点组成
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, children);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(children, el, null, parentComponent);
    }

    hostInsert(el, container, anchor);
  };

  const mountComponent = (
    vnode,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    // 创建组件实例
    const instance = createComponentInstance(vnode, parentComponent);
    // 挂载到 vnode 上（patchComponent 需要）
    vnode.component = instance;

    // 如果父组件有 Suspense 边界，继承它
    if (parentComponent?.suspense) {
      instance.suspense = parentComponent.suspense;
    }

    // 如果是 KeepAlive，注入 renderer 方法
    if (isKeepAlive(vnode)) {
      instance.ctx = {
        move(vnode, container, anchor) {
          const subTree = vnode.component.subTree;

          // Fragment：需要移动所有子节点 + anchor
          if (subTree.type === Fragment) {
            subTree.children.forEach((child) => {
              hostInsert(child.el, container, anchor);
            });
            if (subTree.anchor) {
              hostInsert(subTree.anchor, container, anchor);
            }
          } else {
            hostInsert(subTree.el, container, anchor);
          }
        },
        createElement: hostCreateElement,
        unmount,
      };
    }

    // 初始化props
    initProps(instance, vnode.props);
    // 初始化插槽
    initSlots(instance, vnode.children);

    // 创建代理
    instance.proxy = createComponentProxy(instance);

    // 执行 setup
    setupComponent(instance);

    // 初始化 data
    const { data = () => {} } = vnode.type;
    instance.data = reactive(data.call(instance.proxy));

    // 检查异步依赖
    if (instance.asyncDep) {
      // 有异步依赖，注册到 Suspense
      if (instance.suspense) {
        // 注册依赖，拿到完成回调
        const onResolved = instance.suspense.registerDep(instance);

        // 不立即执行 setupRenderEffect
        // 等 async setup resolve 后再渲染
        instance.asyncDep.then(() => {
          // resolve 后才挂载
          if (!instance.isUnmounted) {
            // 1. 先渲染组件（此时 el 才有值）
            setupRenderEffect(instance, vnode, container, anchor);

            // 2. 渲染完成后，调用完成回调
            onResolved();
          }
        });
        return; // 提前返回
      } else {
        // 没有 Suspense 包裹，警告并等待
        console.warn("[Vue] async setup used without Suspense");
        instance.asyncDep.then(() => {
          if (!instance.isUnmounted) {
            setupRenderEffect(instance, vnode, container, anchor);
          }
        });
        return;
      }
    }

    // 正常同步挂载
    setupRenderEffect(instance, vnode, container, anchor);
  };

  const setupRenderEffect = (instance, vnode, container, anchor) => {
    const componentUpdateFn = () => {
      if (instance.isUnmounted) return;

      // render 可能来自 setup 返回值，也可能来自组件定义，前者优先级较高
      const render = instance.render || instance.type.render;

      if (!instance.isMounted) {
        // ========== 挂载 ==========

        // beforeMount
        if (instance.bm) {
          invokeArrayFns(instance.bm);
        }

        // render函数内部this指向state，同时传递参数proxy
        const subTree = render.call(instance.proxy, instance.proxy);
        patch(null, subTree, container, anchor, instance);

        instance.isMounted = true;
        instance.subTree = subTree;
        vnode.el = subTree.el; // 组件的 el 指向根元素

        // mounted (异步，DOM更新后执行)
        if (instance.m) {
          queuePostFlushCb(() => invokeArrayFns(instance.m));
        }
      } else {
        // ========== 更新 ==========

        // beforeUpdate
        if (instance.bu) {
          invokeArrayFns(instance.bu);
        }

        let { next, vnode } = instance;
        // 如果存在next，说明是父组件触发的更新，需要更新props
        if (next) {
          next.el = vnode.el;
          updateComponentPreRender(instance, next);
        }

        const subTree = render.call(instance.proxy, instance.proxy);
        patch(instance.subTree, subTree, container, anchor, instance);
        instance.subTree = subTree;

        // updated（异步）
        if (instance.u) {
          queuePostFlushCb(() => invokeArrayFns(instance.u));
        }
      }
    };

    const effect = new ReactiveEffect(componentUpdateFn, () =>
      queueJob(instance.update)
    );

    instance.update = () => effect.run();
    instance.update();
  };

  const updateComponentPreRender = (instance, nextVNode) => {
    instance.vnode = nextVNode;
    instance.next = null;

    updateProps(instance, nextVNode.props);
    updateSlots(instance, nextVNode.children);
  };

  const patchProps = (el, oldProps, newProps) => {
    // 新增或者修改的属性
    for (const key in newProps) {
      hostPatchProp(el, key, oldProps[key], newProps[key]);
    }
    // 移除旧属性
    for (const key in oldProps) {
      if (!(key in newProps)) {
        hostPatchProp(el, key, oldProps[key], null);
      }
    }
  };

  const patchKeyedChildren = (
    c1,
    c2,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    let i = 0;
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;

    // 1.从头对比
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = (c2[i] = normalizeVnode(c2[i]));
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, container, null, parentComponent); // 递归 patch
      } else {
        break;
      }
      i++;
    }

    // 2.从尾对比
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = (c2[e2] = normalizeVnode(c2[e2]));
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, container, null, parentComponent); // 递归 patch
      } else {
        break;
      }
      e1--;
      e2--;
    }

    // 3.新的多 挂载
    // (a b)
    // (a b) c d
    // i = 2, e1 = 1, e2 = 3
    if (i > e1 && i <= e2) {
      const nextPos = e2 + 1;
      const insertAnchor = nextPos < c2.length ? c2[nextPos].el : anchor;
      while (i <= e2) {
        patch(
          null,
          (c2[i] = normalizeVnode(c2[i])),
          container,
          insertAnchor,
          parentComponent
        );
        i++;
      }
    }

    // 4.旧的多 卸载
    // (a b) c d
    // (a b)
    // i = 2, e1 = 3, e2 = 1
    else if (i > e2 && i <= e1) {
      while (i <= e1) {
        unmount(c1[i]);
        i++;
      }
    }

    // 5.乱序
    else {
      const s1 = i;
      const s2 = i;

      // 5.1 建立 key -> index 映射
      const keyToNewIndexMap = new Map();
      for (let i = s2; i <= e2; i++) {
        const nextChild = (c2[i] = normalizeVnode(c2[i]));
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i);
        }
      }

      // 5.2 遍历旧节点，patch 可复用的，删除多余的
      const toBePatched = e2 - s2 + 1;
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0);

      for (let i = s1; i <= e1; i++) {
        const oldChild = c1[i];
        const newIndex = keyToNewIndexMap.get(oldChild.key);

        if (newIndex === undefined) {
          // 在新的数组中不存在 卸载
          unmount(oldChild);
        } else {
          // 记录 新索引 -> 旧索引 的映射（+1 是为了区分 0 和未匹配）
          newIndexToOldIndexMap[newIndex - s2] = i + 1;
          // 复用 比较节点差异，更新属性和儿子
          patch(oldChild, c2[newIndex], container, null, parentComponent);
        }
      }

      // 5.3 移动和新增（倒序 + LIS 优化）
      const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap);
      let j = increasingNewIndexSequence.length - 1;

      for (let i = toBePatched - 1; i >= 0; i--) {
        // 根据新数组，倒序插入
        const nextIndex = s2 + i;
        const nextChild = c2[nextIndex];
        const insertAnchor =
          nextIndex + 1 < c2.length ? c2[nextIndex + 1].el : anchor;

        if (newIndexToOldIndexMap[i] === 0) {
          // 新增节点
          patch(null, nextChild, container, anchor, parentComponent);
        } else if (j < 0 || i !== increasingNewIndexSequence[j]) {
          // 不在 LIS 中，需要移动
          const child = c2[nextIndex];

          if (child.shapeFlag & ShapeFlags.TELEPORT) {
            // Teleport 用专门的 move 方法
            TeleportImpl.move(child, container, insertAnchor, {
              hostInsert,
            });
          } else if (child.shapeFlag & ShapeFlags.SUSPENSE) {
            SuspenseImpl.move(child, container, insertAnchor, { hostInsert });
          } else {
            hostInsert(child.el, container, insertAnchor);
          }
        } else {
          // 在 LIS 中，无需移动
          j--;
        }
      }
    }
  };

  const patchUnkeyedChildren = (
    c1,
    c2,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    const oldLen = c1.length;
    const newLen = c2.length;
    const commonLen = Math.min(oldLen, newLen);

    // patch 公共部分
    for (let i = 0; i < commonLen; i++) {
      const nextChild = (c2[i] = normalizeVnode(c2[i]));
      patch(c1[i], nextChild, container, anchor, parentComponent);
    }

    if (oldLen > newLen) {
      // 旧的多，卸载
      for (let i = commonLen; i < oldLen; i++) {
        unmount(c1[i]);
      }
    } else {
      // 新的多，挂载
      for (let i = commonLen; i < newLen; i++) {
        const nextChild = (c2[i] = normalizeVnode(c2[i]));
        patch(null, nextChild, container, anchor, parentComponent);
      }
    }
  };

  const patchChildren = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    // children 有三种类型：TEXT、ARRAY、NULL，组合起来 3×3 = 9 种情况
    const c1 = n1.children;
    const c2 = n2.children;
    const prevShapeFlag = n1.shapeFlag;
    const shapeFlag = n2.shapeFlag;
    const { patchFlag } = n2;

    //  Fragment 的 patchFlag 优化
    if (patchFlag !== undefined && patchFlag > 0) {
      if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
        // 带 key 的 fragment，用 keyed diff
        patchKeyedChildren(c1, c2, container, anchor, parentComponent);
        return;
      } else if (patchFlag & PatchFlags.UNKEYED_FRAGMENT) {
        // 不带 key 的 fragment，用 unkeyed diff（简单遍历）
        patchUnkeyedChildren(c1, c2, container, anchor, parentComponent);
        return;
      }
    }

    // 新 children 是文本
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 旧的是数组 先卸载
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1);
      }
      // 文本不同才更新
      if (c1 !== c2) {
        hostSetElementText(container, c2);
      }
    } else {
      // 新 children 是数组或空
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 数组 -> 数组：diff算法
          patchKeyedChildren(c1, c2, container, anchor, parentComponent);
        } else {
          // 数组 -> 空：卸载
          unmountChildren(c1);
        }
      } else {
        // 旧的是文本或空
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 旧的是文本则先把子元素清空
          hostSetElementText(container, "");
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, container, anchor, parentComponent);
        }
      }
    }
  };

  const patchElement = (n1, n2, parentComponent = null) => {
    // 复用 DOM 节点
    const el = (n2.el = n1.el);

    const oldProps = n1.props || {};
    const newProps = n2.props || {};
    const { patchFlag, dynamicChildren } = n2;

    // 根据 patchFlag 靶向更新 props
    if (patchFlag > 0) {
      // 存在优化标记
      if (patchFlag & PatchFlags.FULL_PROPS) {
        // FULL_PROPS: 需要完整 diff（v-bind="obj" 场景）
        patchProps(el, oldProps, newProps);
      } else {
        // 靶向更新

        // 动态 class
        if (patchFlag & PatchFlags.CLASS) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, "class", null, newProps.class);
          }
        }

        // 动态 style
        if (patchFlag & PatchFlags.STYLE) {
          hostPatchProp(el, "style", oldProps.style, newProps.style);
        }

        // 动态 props（非 class/style）
        if (patchFlag & PatchFlags.PROPS) {
          // 只更新 dynamicProps 中列出的属性
          const propsToUpdate = n2.dynamicProps;
          for (let i = 0; i < propsToUpdate.length; i++) {
            const key = propsToUpdate[i];
            const prev = oldProps[key];
            const next = newProps[key];
            if (prev !== next) {
              hostPatchProp(el, key, prev, next);
            }
          }
        }
      }
    } else if (
      patchFlag == null ||
      patchFlag === 0 ||
      patchFlag === PatchFlags.BAIL
    ) {
      // 无优化标记（手写 render）、0、BAIL → 完整 diff
      patchProps(el, oldProps, newProps);
    }
    // patchFlag < 0 且不是 BAIL 说明是 HOISTED
    // HOISTED 节点已经在 patch 入口被短路，正常不会走到这里

    // 更新 children
    if (patchFlag & PatchFlags.TEXT) {
      // 动态文本
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children);
      }
    } else if (dynamicChildren) {
      // 优先使用 dynamicChildren（Block 优化）
      patchBlockChildren(
        n1.dynamicChildren,
        dynamicChildren,
        el,
        parentComponent
      );
    } else {
      // 没有 dynamicChildren，走完整 diff
      patchChildren(n1, n2, el, null, parentComponent);
    }
  };

  /**
   * 直接 patch dynamicChildren，跳过静态节点
   * 前提：Block 结构稳定，新旧 dynamicChildren 数量一致
   */
  const patchBlockChildren = (
    oldChildren: VNode[],
    newChildren: VNode[],
    container: any,
    parentComponent: any
  ) => {
    // 检查结构是否稳定
    if (oldChildren.length !== newChildren.length) {
      console.warn(
        "[Vue] Block children length mismatch. This may indicate unstable " +
          "block structure. Falling back may cause issues.",
        { old: oldChildren.length, new: newChildren.length }
      );
    }

    for (let i = 0; i < newChildren.length; i++) {
      const oldVNode = oldChildren[i];
      const newVNode = newChildren[i];

      // 防护：如果旧节点不存在，跳过（理论上不应该发生）
      if (!oldVNode) {
        console.warn(`[Vue] Missing old vnode at index ${i} in block children`);

        continue;
      }

      // 确定 patch 的容器
      // 动态子节点可能在不同层级，需要找到其实际父元素
      const parentEl = oldVNode.el && hostParentNode(oldVNode.el);
      const patchContainer = parentEl || container;

      patch(oldVNode, newVNode, patchContainer, null, parentComponent);
    }
  };

  const patchComponent = (n1, n2) => {
    // 复用实例
    const instance = (n2.component = n1.component);

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
      // 挂载：创建注释节点
      const el = (n2.el = hostCreateComment(n2.children || ""));
      hostInsert(el, container);
    } else {
      // 注释节点不需要更新内容，只复用 DOM
      n2.el = n1.el;
    }
  };

  const processText = (n1, n2, container) => {
    if (n1 == null) {
      // 挂载：创建文本节点
      const el = (n2.el = hostCreateText(n2.children));
      hostInsert(el, container);
    } else {
      const el = (n2.el = n1.el);
      if (n1.children !== n2.children) {
        hostSetText(el, n2.children);
      }
    }
  };

  const processFragment = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    if (n1 == null) {
      // 创建结束锚点
      const fragmentEndAnchor = hostCreateComment("fragment end");

      // 挂载：直接挂载 children（在锚点之前）
      hostInsert(fragmentEndAnchor, container, anchor);
      mountChildren(n2.children, container, fragmentEndAnchor, parentComponent);

      // 设置 el 和 anchor
      n2.el = n2.children.length > 0 ? n2.children[0].el : fragmentEndAnchor;
      n2.anchor = fragmentEndAnchor;
    } else {
      // 继承锚点
      n2.el = n1.el;
      n2.anchor = n1.anchor;

      // 优先使用 dynamicChildren
      if (n2.dynamicChildren) {
        patchBlockChildren(
          n1.dynamicChildren!,
          n2.dynamicChildren,
          container,
          parentComponent
        );
      } else {
        // 更新：diff children
        patchChildren(n1, n2, container, n2.anchor, parentComponent);
      }
    }
  };

  const processElement = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    if (n1 == null) {
      // 初始挂载操作
      mountElement(n2, container, anchor, parentComponent);
    } else {
      // 更新 同类型元素
      patchElement(n1, n2, parentComponent);
    }
  };

  const processComponent = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    if (n1 == null) {
      // 检查是否从 KeepAlive 中激活
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        // 从缓存激活，不需要重新挂载
        const parent = parentComponent;
        // 找到 KeepAlive 实例
        parent.ctx.activate(n2, container, anchor);
      } else {
        mountComponent(n2, container, anchor, parentComponent);
      }
    } else {
      patchComponent(n1, n2);
    }
  };

  // 渲染和更新
  // | 参数      | 含义                 | 类型         |
  // |-----------|----------------------|--------------|
  // | n1        | 旧的 vnode（更新前） | VNode | null |
  // | n2        | 新的 vnode（更新后） | VNode        |
  // | container | 父级 DOM 容器        | HTMLElement  |
  const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
    // HOISTED 节点：更新时直接复用，跳过 diff
    if (n1 && n2.patchFlag === PatchFlags.HOISTED) {
      n2.el = n1.el;
      return;
    }

    // 1.相同虚拟节点不需要更新
    if (n1 === n2) {
      return;
    }

    // 2.不同虚拟节点，直接卸载旧节点，并走后续的挂在流程
    if (n1 && !isSameVnode(n1, n2)) {
      unmount(n1);
      n1 = null;
    }

    // 3.根据节点类型分发处理 n1、n2类型相同
    const { type, shapeFlag } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container);
        break;
      case Comment:
        processComment(n1, n2, container);
        break;
      case Fragment:
        // h(Fragment, null, [h('p', 'A'), h('p', 'B')]) -> <p>A</p><p>B</p> ← 没有外层包裹
        processFragment(n1, n2, container, anchor, parentComponent);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理元素
          processElement(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 处理组件 函数式组件（兼容Vue2）和状态组件
          processComponent(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          // 处理 Teleport
          TeleportImpl.process(n1, n2, container, anchor, parentComponent, {
            mountChildren,
            patchChildren,
            unmountChildren,
            move: hostInsert,
            hostInsert,
            hostCreateComment,
            querySelector,
          });
        } else if (shapeFlag & ShapeFlags.SUSPENSE) {
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
    }
  };

  // 卸载
  const unmount = (vnode) => {
    if (!vnode || !vnode.el) return;

    const { type, children, shapeFlag } = vnode;

    // 处理 Suspense
    if (shapeFlag & ShapeFlags.SUSPENSE) {
      SuspenseImpl.remove(vnode, { unmount, unmountChildren, hostRemove });
      return;
    }

    // 处理 Teleport
    if (shapeFlag & ShapeFlags.TELEPORT) {
      TeleportImpl.remove(vnode, { unmountChildren, hostRemove });
      return;
    }

    // 处理组件
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 检查是否应该缓存
      if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
        // 停用而不是卸载，找到父级 KeepAlive
        const parent = vnode.component.parent;
        parent.ctx.deactivate(vnode);
        return;
      }
      unmountComponent(vnode.component);
      return;
    }

    // Fragment 需要卸载所有 children
    if (type === Fragment) {
      unmountChildren(children);
      if (vnode.anchor) {
        hostRemove(vnode.anchor);
      }
      return;
    }

    // 普通元素直接移除
    hostRemove(vnode.el);
  };

  // 组件卸载函数
  const unmountComponent = (instance) => {
    instance.isUnmounted = true;

    // beforeUnmount
    if (instance.bum) {
      invokeArrayFns(instance.bum);
    }

    // 卸载子树
    unmount(instance.subTree);

    // unmounted（异步）
    if (instance.um) {
      queuePostFlushCb(() => invokeArrayFns(instance.um));
    }
  };

  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
    }
  };

  const render = (vnode, container) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode);
      }
      container._vnode = null;
      return;
    }
    // 将虚拟节点变成真实节点进行渲染
    patch(container._vnode || null, vnode, container);
    container._vnode = vnode;
  };

  return {
    render,
  };
}
