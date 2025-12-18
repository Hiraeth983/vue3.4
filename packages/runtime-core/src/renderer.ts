import { ShapeFlags } from "@vue/shared";
import { isSameVnode, Text, Fragment } from "./vnode";

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

  const mountChildren = (children, container) => {
    for (let i = 0; i < children.length; i++) {
      // 此处children[i]可能是纯文本元素
      patch(null, children[i], container);
    }
  };

  const mountElement = (vnode, container) => {
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

    hostInsert(el, container);
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
          // patchKeyedChildren(c1, c2, container)
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

  const processElement = (n1, n2, container) => {
    if (n1 === null) {
      // 初始挂载操作
      mountElement(n2, container);
    } else {
      // 更新 同类型元素
      patchElement(n1, n2);
    }
  };

  // 渲染和更新
  const patch = (n1, n2, container) => {
    // 1.相同虚拟节点不需要更新
    if (n1 === n2) {
      return;
    }

    // 2.不同虚拟节点，直接卸载旧节点，并走后续的挂在流程
    if (n1 && !isSameVnode(n1, n2)) {
      unmount(n1);
      n1 = null;
    }

    // 3.根据节点类型分发处理
    const { type, shapeFlag } = n2;
    switch (type) {
      case Text:
        break;
      case Fragment:
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container);
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
        }
    }
  };

  // 卸载
  const unmount = (vnode) => hostRemove(vnode.el);

  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
    }
  };

  const render = (vnode, container) => {
    console.log(vnode, container);
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
