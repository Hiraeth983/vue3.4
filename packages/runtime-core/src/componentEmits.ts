import { isFunction } from "@vue/shared";

/**
 * 创建 emit 函数
 */
export function createEmit(instance) {
  return (event, ...args) => {
    // 1. 卸载检查
    if (instance.isUnmounted) return;

    const props = instance.vnode.props || {};

    // 2. 多格式事件名匹配：原始 → camelCase → kebab-case(v-model)
    // 父组件写法：
    // <Child @item-click="handler" />
    // 编译后 props: { onItemClick: handler }
    // Vue 模板编译器会转成 camelCase，例如 @click -> onClick  @item-click -> onItemClick  @itemClick -> onItemClick  v-model -> onUpdate:modelValue  v-model:visiable -> onUpdate:visiable
    // 此处逻辑就是将子组件emit传递的event事件名称转化为各种格式，匹配模板编译后的标准事件名
    let handlerName;
    let handler =
      props[(handlerName = toHandlerKey(event))] ||
      props[(handlerName = toHandlerKey(camelize(event)))];

    // v-model 的 update:xxx 事件，还需要尝试 kebab-case
    if (!handler && event.startsWith("update:")) {
      handler = props[(handlerName = toHandlerKey(hyphenate(event)))];
    }

    if (handler && isFunction(handler)) {
      handler(...args);
    }

    // 3. once 事件支持
    // 模版编译结果：事件名 + Once 后缀
    // | 模板写法                | 编译后的 prop key       |
    // |-------------------------|-------------------------|
    // | @click                  | onClick                 |
    // | @click.once             | onClickOnce             |
    // | @update:modelValue.once | onUpdate:modelValueOnce |
    // | @my-event.once          | onMyEventOnce           |
    const onceHandler = props[handlerName + "Once"];
    if (onceHandler && isFunction(onceHandler)) {
      // 初始化 emitted 记录
      if (instance.emitted) {
        instance.emitted = {};
      } else if (instance.emitted[handlerName]) {
        // 已经触发过，直接返回
        return;
      }

      instance.emitted[handlerName] = true;
      onceHandler(...args);
    }
  };
}

/**
 * 事件名转 handler 名
 * click → onClick
 * update:modelValue → onUpdate:modelValue
 */
function toHandlerKey(str) {
  if (!str) return "";
  return `on${str[0].toUpperCase()}${str.slice(1)}`;
}

/**
 * 驼峰化
 * kebab-case → camelCase
 * my-event → myEvent
 */
function camelize(str) {
  return str.replace(/-(\w)/g, (_, c) => c.toUpperCase());
}

/**
 * 用连字符连接
 * camelCase → kebab-case
 * myEvent → my-event
 * updateModelValue → update-model-value
 */
function hyphenate(str) {
  return str.replace(/\B([A-Z])/g, "-$1").toLowerCase();
}
