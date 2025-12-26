/**
 * Vue3 normalizeVNode 策略解析
 *
 * 问题背景：
 * 在实现 slots 功能时，遇到了 diff 过程中 Cannot read properties of null (reading 'type') 的错误。
 * 原因是数组 children 中包含 null（如 isActive ? h('span') : null），但 diff 算法没有正确处理。
 */

// ============================================================
// 一、normalizeVNode 的作用
// ============================================================

/**
 * 将各种类型的 child 统一转换成 VNode：
 *
 * | 输入                      | 输出           |
 * |---------------------------|----------------|
 * | null / undefined / false  | Comment VNode  |
 * | string / number           | Text VNode     |
 * | array                     | Fragment VNode |
 * | VNode                     | 原样返回       |
 */

// ============================================================
// 二、错误的实现方式
// ============================================================

// ❌ 错误做法 1：mountChildren 中没有把结果赋值回原数组
const mountChildren_wrong = (children, container) => {
  for (let i = 0; i < children.length; i++) {
    const child = normalizeVnode(children[i]); // 规范化了，但没赋值回去
    patch(null, child, container);
  }
  // 问题：children 数组本身还是 [vnode, null, ...]
  // 下次 patch 时，c1 = vnode.children 还是包含 null
};

// ❌ 错误做法 2：patchKeyedChildren 中用 map 创建新数组
const patchKeyedChildren_wrong = (c1, c2, container) => {
  c2 = c2.map((child) => normalizeVnode(child)); // 创建了新数组
  // 问题：vnode.children 还是指向旧数组，引用丢失
};

// ============================================================
// 三、Vue3 的正确做法：延迟规范化 + 原地修改
// ============================================================

// ✅ 正确做法：规范化后赋值回原数组
const mountChildren_correct = (children, container) => {
  for (let i = 0; i < children.length; i++) {
    const child = (children[i] = normalizeVnode(children[i])); // 赋值回去！
    patch(null, child, container);
  }
  // children 数组被原地修改为 [VNode, CommentVNode, ...]
};

const patchKeyedChildren_correct = (c1, c2, container) => {
  let i = 0;
  // ...
  while (i <= e1 && i <= e2) {
    const n1 = c1[i];
    const n2 = (c2[i] = normalizeVnode(c2[i])); // 赋值回去！
    if (isSameVnode(n1, n2)) {
      patch(n1, n2, container);
    }
    // ...
  }
};

// ============================================================
// 四、数据流对比
// ============================================================

/**
 * ❌ 错误的数据流：
 *
 * 第一次渲染：
 *   vnode.children = ['text', null]
 *        ↓ mountChildren（没赋值回去）
 *   vnode.children = ['text', null]  ← 还是原样！
 *
 * 第二次渲染：
 *   c1 = oldVNode.children = ['text', null]  ← 包含 null
 *   访问 c1[1].type → null.type → 报错！
 *
 * ─────────────────────────────────────────────
 *
 * ✅ Vue3 的数据流：
 *
 * 第一次渲染：
 *   vnode.children = ['text', null]
 *        ↓ mountChildren（赋值回去）
 *   vnode.children = [TextVNode, CommentVNode]  ← 已规范化
 *
 * 第二次渲染：
 *   c1 = oldVNode.children = [TextVNode, CommentVNode]  ← 直接可用
 *   c2 = newVNode.children = ['new', null]
 *        ↓ patchKeyedChildren（赋值回去）
 *   c2 = [TextVNode, CommentVNode]  ← 规范化
 */

// ============================================================
// 五、这种设计的好处
// ============================================================

/**
 * 1. 性能优化 - 按需处理
 *    假设有 100 个子节点，但 diff 时只比较了前 3 个
 *    Vue3：只规范化实际访问到的 3 个节点
 *    如果开头全部 map：100 个全处理，浪费
 *
 * 2. 内存一致性 - 避免引用丢失
 *    c2 = c2.map(...) 会创建新数组，vnode.children 还是旧数组
 *    c2[i] = normalize(...) 原地修改，vnode.children 同步更新
 *
 * 3. 状态持久化 - 下次 patch 直接可用
 *    处理一次后，vnode.children 永远是规范化的
 *    不需要每次 patch 都重新处理
 *
 * 4. 简化 unmount 逻辑
 *    因为 c1 中永远是规范化后的 VNode，不会有 null
 *    unmount 不需要做空值检查
 */

// ============================================================
// 六、设计哲学
// ============================================================

/**
 * "在数据真正被使用的那一刻再处理，处理完立即持久化"
 *
 *  ├── 懒处理：不提前做无用功
 *  ├── 原地改：保持引用一致性
 *  └── 持久化：处理一次，后续复用
 *
 * 这就是为什么 Vue3 不需要额外的防御性检查——
 * 数据流是干净的，一旦进入 patch 流程，children 数组中就不可能存在 null。
 */
