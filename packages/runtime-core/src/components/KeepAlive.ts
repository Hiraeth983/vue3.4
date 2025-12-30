import { isArray, isString, ShapeFlags } from "@vue/shared";
import { getCurrentInstance } from "../component";
import { isVnode } from "../vnode";
import { queuePostFlushCb } from "../scheduler";

export const isKeepAlive = (vnode) => vnode.type.__isKeepAlive;

// | 标志位                      | 含义                             | 作用时机   |
// |-----------------------------|---------------------------------|-----------|
// | COMPONENT_SHOULD_KEEP_ALIVE | 这个组件应该被缓存，卸载时别销毁   | 卸载时检查 |
// | COMPONENT_KEPT_ALIVE        | 这个组件从缓存激活，不需要重新挂载 | 挂载时检查 |
export const KeepAliveImpl = {
  name: "KeepAlive",
  __isKeepAlive: true,

  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [Number, String],
  },

  setup(props, { slots }) {
    // 缓存结构
    const cache = new Map(); // key -> vnode
    const keys = new Set(); // 记录访问顺序 LRU

    // 当前组件实例
    const instance = getCurrentInstance();

    // 从 renderer 注入的方法
    const { move, createElement, unmount: _unmount } = instance.ctx;

    // 隐藏容器：停用的组件 DOM 暂存在这里
    const hiddenContainer = createElement("div");

    // 激活：从隐藏容器移回页面
    instance.ctx.activate = (vnode, container, anchor) => {
      move(vnode, container, anchor);
      // 触发 activated 钩子
      const instance = vnode.component;
      if (instance.a) {
        queuePostFlushCb(() => instance.a.forEach((fn) => fn()));
      }
    };

    // 停用：从页面移到隐藏容器
    instance.ctx.deactivate = (vnode) => {
      move(vnode, hiddenContainer, null);
      // 触发 deactivated 钩子
      const instance = vnode.component;
      if (instance.da) {
        queuePostFlushCb(() => instance.da.forEach((fn) => fn()));
      }
    };

    // 真正卸载（超出 max 或者组件销毁时）
    const pruneCacheEntry = (key) => {
      const cached = cache.get(key);
      if (cached) {
        // 移除缓存标记，执行真正的卸载
        cached.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
        _unmount(cached);
        cache.delete(key);
        keys.delete(key);
      }
    };

    // 组件卸载时清空所有缓存
    if (!instance.um) instance.um = [];
    instance.um.push(() => {
      cache.forEach((_, key) => pruneCacheEntry(key));
    });

    // 获取缓存 key
    const getCacheKey = (vnode) => {
      // 优先用 key（同组件不同实例）
      // 否则用 type（不同组件）
      // Vue 官方文档也说明：如果你想缓存同一组件的多个实例，需要给它们不同的 key
      return vnode.key != null ? vnode.key : vnode.type;
    };

    // 检查组件名是否匹配 include/exclude
    const matches = (pattern, name) => {
      if (!name) return false;

      if (isString(pattern)) {
        return pattern.split(",").includes(name);
      }
      if (pattern instanceof RegExp) {
        return pattern.test(name);
      }
      if (isArray(pattern)) {
        return pattern.includes(name);
      }

      return false;
    };

    return () => {
      // Vue 源码中，如果 KeepAlive 有多个子节点，会警告并只取第一个
      // 获取默认插槽的第一个子节点
      const children = slots.default?.();
      const rawVNode = isArray(children) ? children[0] : children;

      // 添加多子节点警告
      if (isArray(children) && children.length > 1) {
        console.warn("[KeepAlive] should have exactly one child component");
      }

      // 只处理有状态组件
      if (
        !isVnode(rawVNode) ||
        !(rawVNode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT)
      ) {
        return rawVNode;
      }

      // 获取组件名
      const component = rawVNode.type;
      const name = component.name || component.__name;

      // 检查 include/exclude
      const { include, exclude, max } = props;
      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        // 不缓存，直接返回
        return rawVNode;
      }

      const key = getCacheKey(rawVNode);

      // 检查缓存
      const cachedVNode = cache.get(key);

      if (cachedVNode) {
        // 命中缓存：复用组件实例
        rawVNode.el = cachedVNode.el;
        rawVNode.component = cachedVNode.component;

        // 标记为从缓存激活
        rawVNode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;

        // 更新缓存中的 vnode 引用（props 可能变了）
        cache.set(key, rawVNode);

        // LRU 移到最新位置
        keys.delete(key);
        keys.add(key);
      } else {
        // 未命中：加入缓存
        cache.set(key, rawVNode);
        keys.add(key);

        // 超出 max，淘汰最久未使用的
        if (max && keys.size > parseInt(max as string, 10)) {
          const oldestKey = keys.values().next().value;
          pruneCacheEntry(oldestKey);
        }
      }

      // 标记：卸载时应该缓存而不是销毁
      rawVNode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;

      return rawVNode;
    };
  },
};

export const KeepAlive = KeepAliveImpl;
