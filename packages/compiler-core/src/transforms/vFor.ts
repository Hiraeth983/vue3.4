import {
  CREATE_ELEMENT_BLOCK,
  CREATE_VNODE,
  findDir,
  FRAGMENT,
  OPEN_BLOCK,
  removeDir,
  RENDER_LIST,
  TransformContext,
} from "./../transform";
import {
  ElementNode,
  ElementPropNode,
  ExpressionNode,
  ForNode,
  getChildCodegenNode,
  NodeTypes,
  TemplateChildNode,
} from "../ast";
import { PatchFlags } from "@vue/shared";

/**
 * transformFor - 列表渲染
 *
 * 输入: <div v-for="item in list" :key="item.id">{{ item.name }}</div>
 *
 * 输出结构:
 *   ForNode {
 *     source: list,
 *     valueAlias: item,
 *     children: [ElementNode]
 *   }
 *
 * 生成代码:
 *   createVNode(Fragment, null, renderList(list, (item) => {
 *     return createVNode("div", { key: item.id }, item.name)
 *   }))
 *
 * 生成代码（Block 模式）:
 *   (openBlock(), createElementBlock(Fragment, null, renderList(list, (item) => {
 *     return (openBlock(), createElementBlock("div", { key: item.id }, item.name))
 *   }), 128 /* KEYED_FRAGMENT *\/))
 */
export function transformFor(
  node: TemplateChildNode,
  context: TransformContext
) {
  // 如果当前节点已被其他 transform 替换，跳过
  if (context.currentNode !== node) return;

  if (node.type !== NodeTypes.ELEMENT) return;

  const forDir = findDir(node, "for");
  if (!forDir) return;

  // 解析 v-for 表达式：item in list / (item, index) in list
  const parseResult = parseForExpression(forDir.exp?.content || "");
  if (!parseResult) {
    console.warn("[Vue compiler] Invalid v-for expression");
    return;
  }

  const { source, value, key } = parseResult;

  // 从 props 中移除 v-for
  const element = node as ElementNode;
  removeDir(element, ["for"]);

  // 检查是否有 :key | v-bind:key
  const keyProp = findKeyProp(element);

  // 创建 ForNode
  const forNode: ForNode = {
    type: NodeTypes.FOR,
    source: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: source,
      isStatic: false,
    },
    valueAlias: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: value,
      isStatic: false,
    },
    keyAlias: key
      ? {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: key,
          isStatic: false,
        }
      : undefined,
    children: [element],
  };

  // 替换原节点
  context.replaceNode(forNode);

  // 收集迭代变量
  const localVars: string[] = [value];
  if (key) localVars.push(key);

  // 添加到作用域
  context.addIdentifiers(localVars);

  // 退出函数：生成 codegenNode
  return () => {
    // 退出时移除作用域
    context.removeIdentifiers(localVars);

    context.helper(OPEN_BLOCK);
    context.helper(CREATE_ELEMENT_BLOCK);
    context.helper(CREATE_VNODE);
    context.helper(RENDER_LIST);
    context.helper(FRAGMENT);

    // 获取子节点的 codegenNode，并标记为 Block
    const childCodegenNode = getChildCodegenNode(element);

    if (childCodegenNode.type === NodeTypes.VNODE_CALL) {
      // 每个循环项都是 Block
      childCodegenNode.isBlock = true;
    }

    // 构建函数参数
    const params: ExpressionNode[] = [forNode.valueAlias];
    if (forNode.keyAlias) {
      params.push(forNode.keyAlias);
    }

    // 确定 Fragment 的 patchFlag
    // 有 key → KEYED_FRAGMENT（可以做高效 diff）
    // 无 key → UNKEYED_FRAGMENT（只能全量 diff）
    const fragmentPatchFlag = keyProp
      ? PatchFlags.KEYED_FRAGMENT
      : PatchFlags.UNKEYED_FRAGMENT;

    // 外层 Fragment 也是 Block
    forNode.codegenNode = {
      type: NodeTypes.VNODE_CALL,
      tag: FRAGMENT,
      props: undefined,
      children: {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: RENDER_LIST,
        arguments: [
          forNode.source,
          {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            params,
            returns: childCodegenNode,
          },
        ],
      },
      patchFlag: fragmentPatchFlag,
      dynamicProps: undefined,
      isBlock: true, // Fragment 也是 Block
    };
  };
}

/**
 * 查找 :key | v-bind:key 绑定
 */
function findKeyProp(node: ElementNode): ElementPropNode | undefined {
  return node.props.find((prop) => {
    if (prop.type === NodeTypes.DIRECTIVE && prop.name === "bind") {
      const arg = prop.arg;
      return arg?.type === NodeTypes.SIMPLE_EXPRESSION && arg.content === "key";
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === "key") {
      return true;
    }
    return false;
  });
}

/**
 * 解析 v-for 表达式
 * "item in list" → { source: "list", value: "item" }
 * "(item, index) in list" → { source: "list", value: "item", key: "index" }
 */
function parseForExpression(exp: string) {
  // 匹配 in 或 of
  const inMatch = exp.match(/\s+(in|of)\s+/);
  if (!inMatch) return null;

  // 简单版本，无法适配所有 v-for 表达式
  const [left, source] = exp.split(inMatch[0]);

  let value: string;
  let key: string | undefined;

  const trimmedLeft = left.trim();

  if (trimmedLeft.startsWith("(") && trimmedLeft.endsWith(")")) {
    const inner = trimmedLeft.slice(1, -1);
    const parts = inner.split(",").map((s) => s.trim());
    value = parts[0];
    key = parts[1];
  } else {
    value = trimmedLeft;
  }

  return {
    source: source.trim(),
    value,
    key,
  };
}
