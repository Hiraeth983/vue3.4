import { isFunction, isObject } from "@vue/shared";
import { proxyRefs } from "@vue/reactivity";
import { createEmit } from "./componentEmits";

// 当前组件实例（生命周期钩子需要）
export let currentInstance = null;

export const setCurrentInstance = (instance) => (currentInstance = instance);
export const unsetCurrentInstance = () => (currentInstance = null);
export const getCurrentInstance = () => currentInstance;

// 创建组件实例
export function createComponentInstance(vnode, parent) {
  // | 属性                 | 含义                   | 内容示例                                    |
  // |----------------------|------------------------|---------------------------------------------|
  // | instance.vnode.props | 父组件传入的原始 props | { onClick: fn, class: 'btn', msg: 'hello' } |
  // | instance.props       | 经过解析后的组件 props | { msg: 'hello' } (只包含声明的)             |
  // | instance.type.props  | 组件声明的 props 定义  | { msg: { type: String, required: true } }   |
  const instance = {
    type: vnode.type, // 组件定义对象（包含 props 选项、render 等）
    vnode, // 组件的 vnode
    parent,
    props: null, // 响应式 props
    attrs: null, // 透传属性
    data: null, // data() 返回的响应式状态
    setupState: null, // setup 返回的状态对象（经过 proxyRefs 处理）
    render: null, // setup 返回的渲染函数
    proxy: null,
    subTree: null,
    isMounted: false, // 组件是否已挂载
    isUnmounted: false, // 组件是否已卸载
    update: null,
    next: null, // 待更新的 vnode（patchComponent 用）
    slots: null, // TODO 后续实现
    emit: null, // emit 函数
    emitted: null, // 已经触发过的 emitted 函数名称
    // 生命周期钩子
    bm: null, // beforeMount
    m: null, // mounted
    bu: null, // beforeUpdate
    u: null, // updated
    bum: null, // beforeUnmount
    um: null, // unmounted
  };

  // 创建 emit 函数，绑定当前实例
  instance.emit = createEmit(instance);

  return instance;
}

/**
 * 执行组件的 setup 函数
 */
export function setupComponent(instance) {
  const { type, props } = instance;
  const { setup } = type;

  if (setup) {
    // 创建 setup 的第二个参数 context
    const setupContext = createSetupContext(instance);

    // 设置当前实例 让钩子函数可以获取到
    setCurrentInstance(instance);

    // 执行 setup，传入 props 和 context
    const setupResult = setup(props, setupContext);

    // 清除当前实例
    unsetCurrentInstance();

    // 处理 setup 返回值
    handleSetupResult(instance, setupResult);
  }
}

/**
 * 创建 setup 的 context 参数
 */
function createSetupContext(instance) {
  return {
    attrs: instance.attrs,
    slots: instance.slots,
    emit: instance.emit,
    expose: () => {}, // TODO 后续实现
  };
}

/**
 * 处理 setup 返回值
 */
function handleSetupResult(instance, setupResult) {
  // 返回函数 → 作为 render 函数
  if (isFunction(setupResult)) {
    instance.render = setupResult;
  }
  // 返回对象 → 暴露给模板，用 proxyRefs 自动解包
  else if (isObject(setupResult)) {
    instance.setupState = proxyRefs(setupResult);
  }
}
