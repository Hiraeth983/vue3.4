import { invokeArrayFns, ShapeFlags } from "@vue/shared";
import { isSameVnode, Text, Fragment, Comment, normalizeVnode } from "./vnode";
import { reactive, ReactiveEffect } from "@vue/reactivity";
import { queueJob, queuePostFlushCb } from "./scheduler";
import { getSequence } from "./utils/sequence";
import { createComponentProxy } from "./componentPublicInstance";
import { initProps, updateProps } from "./componentProps";
import { createComponentInstance, setupComponent } from "./component";
import { shouldUpdateComponent } from "./componentRenderUtils";
import { initSlots, updateSlots } from "./componentSlots";

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
      const child = normalizeVnode(children[i]);
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

    // 设置渲染 effect
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

  const patchKeyedChildren = (c1, c2, container, parentComponent = null) => {
    let i = 0;
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;

    // 1.从头对比
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i];
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
      const n2 = c2[e2];
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
      const anchor = c2[e2 + 1]?.el || null;
      while (i <= e2) {
        patch(null, c2[i], container, anchor, parentComponent);
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
        keyToNewIndexMap.set(c2[i].key, i);
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
        const anchor = c2[nextIndex + 1]?.el || null;

        if (newIndexToOldIndexMap[i] === 0) {
          // 新增节点
          patch(null, nextChild, container, anchor, parentComponent);
        } else if (j < 0 || i !== increasingNewIndexSequence[j]) {
          // 不在 LIS 中，需要移动
          hostInsert(nextChild.el, container, anchor);
        } else {
          // 在 LIS 中，无需移动
          j--;
        }
      }
    }
  };

  const patchChildren = (n1, n2, container, parentComponent = null) => {
    // children 有三种类型：TEXT、ARRAY、NULL，组合起来 3×3 = 9 种情况
    const c1 = n1.children;
    const c2 = n2.children;
    const prevShapeFlag = n1.shapeFlag;
    const shapeFlag = n2.shapeFlag;

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
          patchKeyedChildren(c1, c2, container, parentComponent);
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
          mountChildren(c2, container, null, parentComponent);
        }
      }
    }
  };

  const patchElement = (n1, n2, parentComponent = null) => {
    // 复用 DOM 节点
    const el = (n2.el = n1.el);

    const oldProps = n1.props || {};
    const newProps = n2.props || {};

    // 更新 props
    patchProps(el, oldProps, newProps);

    // 更新 children
    patchChildren(n1, n2, el, parentComponent);
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
    if (n1 === null) {
      // 挂载：创建注释节点
      const el = (n2.el = hostCreateComment(n2.children || ""));
      hostInsert(el, container);
    } else {
      // 注释节点不需要更新内容，只复用 DOM
      n2.el = n1.el;
    }
  };

  const processText = (n1, n2, container) => {
    if (n1 === null) {
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

  const processFragment = (n1, n2, container, parentComponent = null) => {
    if (n1 === null) {
      // 挂载：直接挂载 children
      mountChildren(n2.children, container, null, parentComponent);
    } else {
      // 更新：diff children
      patchChildren(n1, n2, container, parentComponent);
    }
  };

  const processElement = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null
  ) => {
    if (n1 === null) {
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
    if (n1 === null) {
      mountComponent(n2, container, anchor, parentComponent);
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
        processFragment(n1, n2, container, parentComponent);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理元素
          processElement(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 处理组件 函数式组件（兼容Vue2）和状态组件
          processComponent(n1, n2, container, anchor, parentComponent);
        }
    }
  };

  // 卸载
  const unmount = (vnode) => {
    const { type, children, shapeFlag } = vnode;

    if (shapeFlag & ShapeFlags.COMPONENT) {
      unmountComponent(vnode.component);
      return;
    }

    // Fragment 需要卸载所有 children
    if (type === Fragment) {
      unmountChildren(children);
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
    if (vnode === null) {
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
