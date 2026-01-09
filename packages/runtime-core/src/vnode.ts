import {
  isArray,
  isFunction,
  isNumber,
  isObject,
  isString,
  ShapeFlags,
} from "@vue/shared";
import { isTeleport } from "./components/Teleport";
import { isSuspense } from "./components/Suspense";

export const Text = Symbol.for("v-txt");
export const Fragment = Symbol.for("v-fgt");
export const Comment = Symbol.for("v-cmt");

// ==================== Block 机制 ====================

/**
 * Block 栈（支持嵌套 Block）
 * 为什么是栈？因为 Block 可以嵌套，比如 v-for 里有 v-if
 */
let currentBlock: VNode[] | null = null;
const blockStack: (VNode[] | null)[] = [];

/**
 * 开启一个新的 Block 收集
 */
export function openBlock() {
  blockStack.push((currentBlock = []));
}

/**
 * 关闭当前 Block
 */
export function closeBlock() {
  blockStack.pop();
  currentBlock = blockStack[blockStack.length - 1] || null;
}

/**
 * 创建 Block 元素节点
 * 与 createVNode 的区别：会把收集到的动态节点挂到 dynamicChildren
 */
export function createElementBlock(
  type: any,
  props?: any,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode = createVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    true // isBlock
  );

  return vnode;
}

/**
 * 创建 Block（通用版本，用于 Fragment 等）
 */
export function createBlock(
  type: any,
  props?: any,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  return createElementBlock(type, props, children, patchFlag, dynamicProps);
}

// ==================== VNode 类型 ====================

export interface VNode {
  __v_isVnode: true;
  type: any;
  props: any;
  children: any;
  key: any;
  el: any;
  component: any;
  target: any;
  targetAnchor: any;
  shapeFlag: number;
  anchor: any;
  suspense: any;
  // 优化相关字段
  patchFlag: number | undefined;
  dynamicProps: string[] | null;
  dynamicChildren: VNode[] | null;
}

export function createVNode(
  type,
  props,
  children?,
  patchFlag?,
  dynamicProps?,
  isBlock = false
) {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT // 元素
    : isSuspense(type) // 新增：Suspense 检测
    ? ShapeFlags.SUSPENSE
    : isTeleport(type)
    ? ShapeFlags.TELEPORT // Teleport（必须在 isObject 之前）
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT // 组件
    : 0;
  const vnode: VNode = {
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
    suspense: null, // Suspense 边界引用
    // 优化相关
    patchFlag,
    dynamicProps: dynamicProps || null,
    dynamicChildren: null,
  };

  if (children != null) {
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

  // Block 收集逻辑
  if (isBlock) {
    // 是 Block 节点，收集 dynamicChildren 并关闭
    vnode.dynamicChildren = currentBlock;
    closeBlock();
  } else if (
    currentBlock &&
    patchFlag !== undefined &&
    patchFlag > 0 // 有正值 patchFlag 说明是动态节点
  ) {
    // 不是 Block，但有 patchFlag，加入当前 Block 的收集
    currentBlock.push(vnode);
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
    return createVNode(Comment, null, "");
  }
  // 字符串/数字 → 文本节点
  if (isString(child) || isNumber(child)) {
    return createVNode(Text, null, String(child));
  }
  // 数组 → Fragment 包裹
  if (isArray(child)) {
    return createVNode(Fragment, null, child);
  }
  // 已经是 vnode，直接返回
  return child;
}

/**
 * 创建注释节点（用于 v-if 无 else 时的占位）
 */
export function createCommentVNode(text: string = ""): VNode {
  return createVNode(Comment, null, text);
}
