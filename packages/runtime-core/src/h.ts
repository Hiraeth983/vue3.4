/**
 * h 的核心难点在于第二个参数的多态——它可能是 props，也可能是 children。调用形式汇总:
    h('div')                          // 只有 type
    h('div', { class: 'red' })        // type + props
    h('div', 'hello')                 // type + 文本children
    h('div', [child1, child2])        // type + 数组children
    h('div', h('span'))               // type + 单个vnode children
    h('div', { id: 'app' }, 'hello')  // type + props + children
    h('div', null, 'text', h('span')) // type + null + 多个children
 */
import { isArray, isObject } from "@vue/shared";
import { createVnode, isVnode } from "./vnode";

export function h(type, propsOrChildren?, children?) {
  const argsLen = arguments.length;

  if (argsLen === 2) {
    // 判断 propsOrChildren 是 props 还是 children
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // 对象类型
      // 判断是不是 vnode
      if (isVnode(propsOrChildren)) {
        // 单个 vnode 子节点，包成数组
        return createVnode(type, null, [propsOrChildren]);
      }
      // 普通对象视为 props，无 children
      return createVnode(type, propsOrChildren);
    } else {
      // 数组或基础类型，视为 children
      return createVnode(type, null, propsOrChildren);
    }
  } else {
    // 参数 >= 3，第二个是 props
    if (argsLen > 3) {
      children = Array.from(arguments).slice(2);
    } else if (argsLen === 3 && isVnode(children)) {
      // 单个 vnode children，包数组
      children = [children];
    }
    return createVnode(type, propsOrChildren, children);
  }
}
