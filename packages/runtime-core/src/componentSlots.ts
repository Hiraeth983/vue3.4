import { isFunction, ShapeFlags } from "@vue/shared";

/**
 * 初始化 slots
 * @param instance - 组件实例
 * @param children - vnode.children
 */
export function initSlots(instance, children) {
  const { shapeFlag } = instance.vnode;

  // 只有 SLOTS_CHILDREN 才需要处理
  if (shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    normalizeObjectSlots(children, instance.slots);
  }
}

/**
 * 规范化对象形式的 slots
 */
function normalizeObjectSlots(children, slots) {
  // 将 h 函数创建的 vnode 中的 SLOTS_CHILDREN 赋值到组件实例中的 slots
  for (const key in children) {
    const value = children[key];
    // 确保每个 slot 都是函数
    slots[key] = isFunction(value) ? value : () => value;
  }
}

/**
 * 更新 slots（组件更新时调用）
 */
export function updateSlots(instance, children) {
  const { slots } = instance;

  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    normalizeObjectSlots(children, slots);
  }
}
