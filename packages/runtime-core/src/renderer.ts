import { ShapeFlags } from "@vue/shared";
import { isSameVnode, Text, Fragment, normalizeVnode } from "./vnode";

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

  const mountChildren = (children, container, anchor = null) => {
    for (let i = 0; i < children.length; i++) {
      // 此处children[i]可能是纯文本元素
      const child = normalizeVnode(children[i]);
      patch(null, child, container, anchor);
    }
  };

  const mountElement = (vnode, container, anchor = null) => {
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
      mountChildren(children, el);
    }

    hostInsert(el, container, anchor);
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

  const patchKeyedChildren = (c1, c2, container) => {
    let i = 0;
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;

    // 1.从头对比
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i];
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, container); // 递归 patch
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
        patch(n1, n2, container); // 递归 patch
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
        patch(null, c2[i], container, anchor);
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
          patch(oldChild, c2[newIndex], container);
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
          patch(null, nextChild, container, anchor);
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

  const patchChildren = (n1, n2, container) => {
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
          patchKeyedChildren(c1, c2, container);
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
          mountChildren(c2, container);
        }
      }
    }
  };

  const patchElement = (n1, n2) => {
    // 复用 DOM 节点
    const el = (n2.el = n1.el);

    const oldProps = n1.props || {};
    const newProps = n2.props || {};

    // 更新 props
    patchProps(el, oldProps, newProps);

    // 更新 children
    patchChildren(n1, n2, el);
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

  const processFragment = (n1, n2, container) => {
    if (n1 === null) {
      // 挂载：直接挂载 children
      mountChildren(n2.children, container);
    } else {
      // 更新：diff children
      patchChildren(n1, n2, container);
    }
  };

  const processElement = (n1, n2, container, anchor = null) => {
    if (n1 === null) {
      // 初始挂载操作
      mountElement(n2, container, anchor);
    } else {
      // 更新 同类型元素
      patchElement(n1, n2);
    }
  };

  // 渲染和更新
  // | 参数      | 含义                 | 类型         |
  // |-----------|----------------------|--------------|
  // | n1        | 旧的 vnode（更新前） | VNode | null |
  // | n2        | 新的 vnode（更新后） | VNode        |
  // | container | 父级 DOM 容器        | HTMLElement  |
  const patch = (n1, n2, container, anchor = null) => {
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
      case Fragment:
        // h(Fragment, null, [h('p', 'A'), h('p', 'B')]) -> <p>A</p><p>B</p> ← 没有外层包裹
        processFragment(n1, n2, container);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor);
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
        }
    }
  };

  // 卸载
  const unmount = (vnode) => {
    const { type, children } = vnode;

    // Fragment 需要卸载所有 children
    if (type === Fragment) {
      unmountChildren(children);
      return;
    }

    // 普通元素直接移除
    hostRemove(vnode.el);
  };

  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
    }
  };

  const render = (vnode, container) => {
    console.log(vnode, container, container._vnode);
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
      // 二分查找
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
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
  // 回溯
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
