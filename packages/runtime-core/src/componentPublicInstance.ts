// 特殊属性映射表
export const publicPropertiesMap = {
  $attrs: (i) => i.attrs,
  $slots: (i) => i.slots,
  $props: (i) => i.props,
  $el: (i) => i.vnode.el,
  // $emit 需要单独处理，后面再加
};

export const PublicInstanceProxyHandlers = {
  get(target, key) {
    const { data, props, setupState } = target;

    // 1. 优先从 setupState 取（Composition API）
    if (setupState && key in setupState) {
      return setupState[key];
    }

    // 2. 再从 data 取（Options API 的 data）
    if (data && key in data) {
      return data[key];
    }

    // 3. 再从 props 取
    if (props && key in props) {
      return props[key];
    }

    // 4. 特殊属性 $xxx
    const publicGetter = publicPropertiesMap[key];
    if (publicGetter) {
      return publicGetter(target);
    }

    // 找不到就 undefined
  },
  set(target, key, value) {
    const { data, props, setupState } = target;

    // setupState 可写
    if (setupState && key in setupState) {
      setupState[key] = value;
      return true;
    }

    // data 可写
    if (data && key in data) {
      data[key] = value;
      return true;
    }

    // props 只读警告
    if (props && key in props) {
      console.warn(`Props "${String(key)}" 是只读的，不能修改`);
      return false;
    }

    return true;
  },
  // 支持 'xxx' in this 语法
  has(target, key) {
    const { data, props, setupState } = target;
    return (
      (setupState && key in setupState) ||
      (data && key in data) ||
      (props && key in props) ||
      key in publicPropertiesMap
    );
  },
};

// 主要作用是render、data函数中需要访问this.xxx，创建Proxy进行拦截并按照优先级查找数据源 setupState → data → props → ctx($attrs/$slots/...)
export function createComponentProxy(instance) {
  return new Proxy(instance, PublicInstanceProxyHandlers);
}
