import { isFunction } from "@vue/shared";
import { currentInstance } from "./component";

/**
 * provide - 向后代组件提供数据
 */
export function provide(key, value) {
  if (!currentInstance) {
    console.warn("provide() 只能在 setup() 中调用");
    return;
  }

  let provides = currentInstance.provides;
  const parentProvides = currentInstance.parent?.provides;

  // 首次 provide 时，创建新对象继承父级，避免污染父组件
  if (provides === parentProvides) {
    provides = currentInstance.provides = Object.create(parentProvides);
  }

  provides[key] = value;
}

/**
 * inject - 注入祖先组件提供的数据
 */
export function inject(key, defaultValue, treatDefaultAsFactory = false) {
  const instance = currentInstance;

  if (!instance) {
    console.warn("inject() 只能在 setup() 中调用");
    return;
  }

  // 从父组件的 provides 开始查找，而非自己的
  const provides = instance.parent?.provides;

  if (provides && key in provides) {
    return provides[key];
  }

  // 没找到，返回默认值
  if (arguments.length > 1) {
    return treatDefaultAsFactory && isFunction(defaultValue)
      ? defaultValue.call(instance && instance.proxy)
      : defaultValue;
  }

  console.warn(`inject "${String(key)}" 未找到`);
}
