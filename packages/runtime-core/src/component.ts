// 当前组件实例（生命周期钩子需要）
export let currentInstance = null;

export const setCurrentInstance = (instance) => (currentInstance = instance);
export const unsetCurrentInstance = () => (currentInstance = null);
export const getCurrentInstance = () => currentInstance;

// 创建组件实例
export function createComponentInstance(vnode, parent) {
  const instance = {
    type: vnode.type, // 组件定义对象（包含 props 选项、render 等）
    vnode, // 组件的 vnode
    parent,
    props: null, // 响应式 props
    attrs: null, // 透传属性
    data: null, // data() 返回的响应式状态
    setupState: null,
    proxy: null,
    subTree: null,
    isMounted: false,
    update: null,
    next: null, // 待更新的 vnode（patchComponent 用）
    // 生命周期钩子
    bm: null, // beforeMount
    m: null, // mounted
    bu: null, // beforeUpdate
    u: null, // updated
    bum: null, // beforeUnmount
    um: null, // unmounted
  };
  return instance;
}
