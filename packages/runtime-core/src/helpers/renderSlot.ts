import { isFunction } from "@vue/shared";
import { createVNode, Fragment } from "../vnode";

/**
 * 渲染插槽内容
 * @param slots - 组件实例的 $slots 对象
 * @param name - 插槽名称
 * @param props - 传递给作用域插槽的数据
 * @param fallback - 默认内容（当插槽未提供时使用）
 *
 */
export function renderSlot(slots, name, props: any = {}, fallback?) {
  // 取出对应的插槽函数
  const slot = slots[name];

  let children;

  if (slot) {
    // 插槽存在
    if (isFunction(slot)) {
      // 作用域插槽：传入 props
      children = slot(props);
    } else {
      // 兼容非函数情况（理论上不应该出现）
      children = slot;
    }
  } else if (fallback) {
    // 插槽不存在，使用默认内容
    children = fallback();
  }

  // 用 Fragment 包裹，因为插槽可能返回多个根节点
  // 比如 <template #default><span>A</span><span>B</span></template>
  return createVNode(Fragment, { key: props.key }, children);
}
