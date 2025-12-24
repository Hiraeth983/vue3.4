import { shallowReactive } from "@vue/reactivity";

/**
 * 初始化组件 props
 * @param instance - 组件实例
 * @param rawProps - vnode.props（父组件传入的原始属性）
 */
export const initProps = (instance, rawProps) => {
  const props = {};
  const attrs = {};

  // 获取组件定义中声明的 props 选项
  const options = instance.type.props || {};

  if (rawProps) {
    for (const key in rawProps) {
      const value = rawProps[key];
      // 组件声明了这个 prop → 放入 props
      // 否则 → 放入 attrs（透传给子元素）
      if (key in options) {
        props[key] = value;
      } else {
        attrs[key] = value;
      }
    }
  }

  // props需要进行响应式，attrs不需要响应式
  instance.props = shallowReactive(props);
  instance.attrs = attrs;
};

// 更新 props
export function updateProps(instance, nextRawProps) {
  const { props, attrs } = instance;
  const options = instance.type.props || {};

  // 遍历新的原始 props
  if (nextRawProps) {
    for (const key in nextRawProps) {
      const value = nextRawProps[key];

      if (key in options) {
        // 在 options 中声明了，更新 props
        if (props[key] !== value) {
          props[key] = value;
        }
      } else {
        // 在 options 中未声明，更新 attrs
        if (attrs[key] !== value) {
          attrs[key] = value;
        }
      }
    }
  }

  // 删除不存在的 props
  for (const key in props) {
    if (!nextRawProps || !(key in nextRawProps)) {
      delete props[key];
    }
  }

  // 删除不存在的 attrs
  for (const key in attrs) {
    if (!nextRawProps || !(key in nextRawProps)) {
      delete attrs[key];
    }
  }
}
