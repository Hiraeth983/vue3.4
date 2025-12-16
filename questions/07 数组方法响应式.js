import { reactive, watch } from "./reactivity.esm.js";

const arr = reactive([1, 2, 3]);

watch(arr, (newVal) => {
  console.log("数组变化:", newVal);
});

setTimeout(() => {
  arr.push(4); // 期望触发 watch，但不会触发
}, 1000);

// 问题：数组的 push、pop、shift、unshift、splice 等方法不触发响应式

// =============================================================================
// 原因分析
// =============================================================================

/**
 * 1. 原生数组方法的特殊性
 *
 *    arr.push(4) 内部做的事：
 *    - 设置 arr[3] = 4（新索引）
 *    - 自动更新 arr.length = 4（内置行为，不走 Proxy setter）
 *
 *    Proxy 的 setter 只能捕获显式赋值，无法捕获 length 的自动更新
 */

/**
 * 2. 依赖收集与触发的不匹配
 *
 *    traverse 收集时：
 *    for (let i = 0; i < value.length; i++) {  // 收集 "length" 依赖
 *      traverse(value[i]);                      // 收集 "0", "1", "2" 依赖
 *    }
 *
 *    push 触发时：
 *    arr[3] = 4  →  trigger("3")  // "3" 没有被收集过！
 *    arr.length 自动更新  →  不触发 setter
 *
 *    结果：没有匹配的依赖被触发
 */

/**
 * 3. targetMap 的 key 是原始对象
 *
 *    targetMap = WeakMap {
 *      { 原始数组 } => depsMap
 *    }
 *
 *    如果用 Proxy 对象去查找：
 *    targetMap.get(Proxy) → undefined
 *
 *    所以 trigger 时需要获取原始对象
 */

// =============================================================================
// 解决方案
// =============================================================================

/**
 * 1. 重写数组方法
 *
 *    const arrayInstrumentations = {};
 *    ['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
 *      arrayInstrumentations[key] = function (...args) {
 *        pauseTracking();  // 暂停收集，避免死循环
 *        const res = Array.prototype[key].apply(this, args);
 *        resetTracking();
 *
 *        const raw = this[ReactiveFlags.RAW];  // 获取原始对象
 *        trigger(raw, "length", this.length, undefined);  // 手动触发
 *        return res;
 *      };
 *    });
 */

/**
 * 2. 在 Proxy getter 中拦截数组方法
 *
 *    get(target, key, receiver) {
 *      // 返回原始对象
 *      if (key === ReactiveFlags.RAW) {
 *        return target;
 *      }
 *
 *      // 数组方法重写
 *      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
 *        return Reflect.get(arrayInstrumentations, key, receiver);
 *      }
 *
 *      // ...
 *    }
 */

/**
 * 3. pauseTracking 的作用
 *
 *    push 内部会访问 length 属性，如果不暂停收集：
 *    - effect.run() 执行 traverse，收集 length 依赖
 *    - push 触发，scheduler 执行 effect.run()
 *    - effect.run() 中执行 getter → arr.push → 访问 length
 *    - 又会触发依赖收集，可能导致问题
 *
 *    所以在执行原生数组方法时暂停依赖收集
 */

// =============================================================================
// 流程对比
// =============================================================================

/**
 * 【修复前】
 * arr.push(4)
 *     ↓
 * Proxy setter 捕获 arr[3] = 4
 *     ↓
 * trigger("3")
 *     ↓
 * depsMap.get("3") → undefined（没收集过）
 *     ↓
 * 不触发
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 【修复后】
 * arr.push(4)
 *     ↓
 * 拦截 push 方法，执行重写版本
 *     ↓
 * Array.prototype.push.apply(this, args)
 *     ↓
 * 手动 trigger("length")
 *     ↓
 * depsMap.get("length") → dep
 *     ↓
 * 触发 watch 回调
 */
