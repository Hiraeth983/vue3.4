export const enum ShapeFlags {
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1,
  STATEFUL_COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  TELEPORT = 1 << 6,
  SUSPENSE = 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  COMPONENT_KEPT_ALIVE = 1 << 9,
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
}

export const enum PatchFlags {
  // ====== 动态内容标记 ======
  TEXT = 1, // 1    - 动态文本 {{ msg }}
  CLASS = 1 << 1, // 2    - 动态 class :class="cls"
  STYLE = 1 << 2, // 4    - 动态 style :style="stl"
  PROPS = 1 << 3, // 8    - 动态属性（非 class/style）:id="id"
  FULL_PROPS = 1 << 4, // 16   - 动态 key，需要完整 diff v-bind="obj"
  HYDRATE_EVENTS = 1 << 5, // 32 - 有事件监听器 @click="fn"

  // ====== Fragment 标记 ======
  STABLE_FRAGMENT = 1 << 6, // 64  - 子节点顺序不变
  KEYED_FRAGMENT = 1 << 7, // 128 - 带 key 的 fragment
  UNKEYED_FRAGMENT = 1 << 8, // 256 - 不带 key 的 fragment

  // ====== 其他 ======
  NEED_PATCH = 1 << 9, // 512  - ref、指令等需要 patch
  DYNAMIC_SLOTS = 1 << 10, // 1024 - 动态插槽

  // ====== 特殊标记（负数，不参与位运算）======
  HOISTED = -1, // 静态提升的节点
  BAIL = -2, // diff 退出优化模式
}

// 用于 DEV 模式的可读名称
export const PatchFlagNames: Record<number, string> = {
  [PatchFlags.TEXT]: "TEXT",
  [PatchFlags.CLASS]: "CLASS",
  [PatchFlags.STYLE]: "STYLE",
  [PatchFlags.PROPS]: "PROPS",
  [PatchFlags.FULL_PROPS]: "FULL_PROPS",
  [PatchFlags.HYDRATE_EVENTS]: "HYDRATE_EVENTS",
  [PatchFlags.STABLE_FRAGMENT]: "STABLE_FRAGMENT",
  [PatchFlags.KEYED_FRAGMENT]: "KEYED_FRAGMENT",
  [PatchFlags.UNKEYED_FRAGMENT]: "UNKEYED_FRAGMENT",
  [PatchFlags.NEED_PATCH]: "NEED_PATCH",
  [PatchFlags.DYNAMIC_SLOTS]: "DYNAMIC_SLOTS",
  [PatchFlags.HOISTED]: "HOISTED",
  [PatchFlags.BAIL]: "BAIL",
};
