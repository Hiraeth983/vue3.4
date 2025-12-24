import { isArray, isNumber, isObject, isString, ShapeFlags } from "@vue/shared";

export const Text = Symbol.for("v-txt");
export const Fragment = Symbol.for("v-fgt");

export function createVnode(type, props, children?) {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT // 元素
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT // 组件
    : 0;
  const vnode = {
    __v_isVnode: true,
    type,
    props,
    children,
    key: props?.key,
    el: null, // 虚拟节点对应的真实节点
    component: null,
    shapeFlag,
  };

  if (children) {
    if (isArray(children)) {
      vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
    } else {
      vnode.children = String(children);
      vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    }
  }

  return vnode;
}

export function isVnode(value) {
  return value?.__v_isVnode;
}

export function isSameVnode(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}

export function normalizeVnode(child) {
  // 简化版本，后续完善
  if (isString(child) || isNumber(child)) {
    return createVnode(Text, null, String(child));
  }
  return child;
}
