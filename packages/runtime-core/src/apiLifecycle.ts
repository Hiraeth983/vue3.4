/**
 * 利用 currentInstance 全局变量，让 onXxx() 知道要把钩子挂到哪个组件实例上
 * 
 * 注册流程：
    1. setup() 执行前，调用 setCurrentInstance(instance) 设置当前实例
    2. setup() 内部调用 onMounted(fn) 时，通过 getCurrentInstance() 拿到当前实例
    3. 把 fn 推入 instance.m 数组（m = mounted 的缩写）
    4. setup() 执行完，调用 unsetCurrentInstance() 清空
 *
 * 为什么用数组：同一个组件内可能调用多次 onMounted()，比如不同的 composable 都注册了 mounted 钩子
 */

import {
  currentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from "./component";
import { LifecycleHooks } from "./enums";

/**
 * 创建生命周期钩子注册函数的工厂
 * @param lifecycle - 钩子类型，对应 instance 上的属性名
 */
function createHook(lifecycle) {
  // 返回的函数就是 onMounted、onBeforeMount 等
  return (hook, target = currentInstance) => {
    if (target) {
      const hooks = target[lifecycle] || (target[lifecycle] = []);

      // 包装 hook，执行时自动设置 currentInstance
      // 这样钩子内部调用 getCurrentInstance() 也能拿到正确的实例
      const wrappedHook = () => {
        // 执行钩子时也设置 currentInstance
        setCurrentInstance(target);
        try {
          hook.call(target.proxy);
        } finally {
          unsetCurrentInstance();
        }
      };

      hooks.push(wrappedHook);
    } else {
      console.warn(`${lifecycle} 钩子只能在 setup() 中调用`);
    }
  };
}

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT);
export const onMounted = createHook(LifecycleHooks.MOUNTED);
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE);
export const onUpdated = createHook(LifecycleHooks.UPDATED);
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT);
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED);
