import {
  isArray,
  isFunction,
  isNumber,
  isObject,
  isString,
  ShapeFlags,
} from "@vue/shared";
import { isTeleport } from "./components/Teleport";

export const Text = Symbol.for("v-txt");
export const Fragment = Symbol.for("v-fgt");
export const Comment = Symbol.for("v-cmt");

export function createVnode(type, props, children?) {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT // 元素
    : isTeleport(type)
    ? ShapeFlags.TELEPORT // Teleport（必须在 isObject 之前）
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
    target: null, // Teleport的目标容器 真实节点
    targetAnchor: null, // Teleport的目标容器的挂载锚点 真实节点
    shapeFlag,
    anchor: null, // Fragment 的结束锚点
  };

  if (children !== null) {
    let type = 0;

    if (isArray(children)) {
      type = ShapeFlags.ARRAY_CHILDREN;
    } else if (isObject(children)) {
      // 对象形式 → slots
      type = ShapeFlags.SLOTS_CHILDREN;
    } else if (isFunction(children)) {
      // 函数形式 → 包装成对象形式 slots
      children = { default: children };
      type = ShapeFlags.SLOTS_CHILDREN;
    } else {
      children = String(children);
      type = ShapeFlags.TEXT_CHILDREN;
    }

    // 统一赋值
    vnode.children = children;
    vnode.shapeFlag |= type;
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
  // null/undefined/boolean → 注释节点（不渲染任何内容）
  if (child == null || typeof child === "boolean") {
    return createVnode(Comment, null, "");
  }
  // 字符串/数字 → 文本节点
  if (isString(child) || isNumber(child)) {
    return createVnode(Text, null, String(child));
  }
  // 数组 → Fragment 包裹
  if (isArray(child)) {
    return createVnode(Fragment, null, child);
  }
  // 已经是 vnode，直接返回
  return child;
}
