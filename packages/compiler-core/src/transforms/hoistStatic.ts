import { TransformContext } from "./../transform";
import {
  ElementNode,
  ExpressionNode,
  NodeTypes,
  RootNode,
  TemplateChildNode,
} from "../ast";
import { isComponent } from "../transform";
import { PatchFlags } from "@vue/shared";

/**
 * 静态类型枚举
 */
export const enum StaticType {
  NOT_STATIC = 0, // 不是静态
  FULL_STATIC = 1, // 完全静态，可以提升
  HAS_RUNTIME = 2, // 包含运行时常量（如 key），可以字符串化但不能提升
}

/**
 * 分析节点的静态类型
 */
export function getStaticType(node: TemplateChildNode) {
  switch (node.type) {
    case NodeTypes.TEXT:
      // 纯文本永远是静态的
      return StaticType.FULL_STATIC;

    case NodeTypes.INTERPOLATION:
      // 插值表达式永远不是静态的
      return StaticType.NOT_STATIC;

    case NodeTypes.IF:
    case NodeTypes.FOR:
      // 结构指令不是静态的
      return StaticType.NOT_STATIC;

    case NodeTypes.ELEMENT:
      return getElementStaticType(node as ElementNode);

    default:
      return StaticType.NOT_STATIC;
  }
}

/**
 * 分析元素节点的静态类型
 */
function getElementStaticType(node: ElementNode): StaticType {
  // 1. 组件不是静态的
  if (isComponent(node)) {
    return StaticType.NOT_STATIC;
  }

  // 2. 检查 props
  for (const prop of node.props) {
    // 有任何指令都不是静态的（指令意味着运行时行为）
    // 包括 v-bind、v-on、v-if、v-for、v-show、v-model、v-html、v-text 等
    if (prop.type === NodeTypes.DIRECTIVE) {
      return StaticType.NOT_STATIC;
    }

    // 检查是否有 ref 属性（ref 的元素不能提升）
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === "ref") {
      return StaticType.NOT_STATIC;
    }
  }

  // 3. 递归检查子节点
  let childrenType = StaticType.FULL_STATIC;
  for (const child of node.children) {
    const childType = getStaticType(child);
    if (childType === StaticType.NOT_STATIC) {
      return StaticType.NOT_STATIC;
    }
    // 父节点的静态程度取决于它最不静态的子节点
    if (childType < childrenType) {
      childrenType = childType;
    }
  }

  return childrenType;
}

/**
 * 检查表达式是否静态
 */
export function isStaticExpression(node: ExpressionNode): boolean {
  if (node.type === NodeTypes.SIMPLE_EXPRESSION) {
    return node.isStatic;
  }
  return false;
}

/**
 * hoistStatic transform
 * 在所有其他 transform 之后执行
 */
export function transformHoistStatic(
  root: RootNode,
  context: TransformContext
) {
  if (!context.hoistStatic) return;

  // 遍历子节点 提升静态节点
  hoistChildren(root.children, context);
}

function hoistChildren(
  children: TemplateChildNode[],
  context: TransformContext
) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    // 处理 ELEMENT 节点
    if (child.type === NodeTypes.ELEMENT) {
      const staticType = getStaticType(child);

      if (staticType === StaticType.FULL_STATIC) {
        // 完全静态，可以提升
        if (
          child.codegenNode &&
          child.codegenNode.type === NodeTypes.VNODE_CALL
        ) {
          // 标记为 HOISTED
          child.codegenNode.patchFlag = PatchFlags.HOISTED;
          // 提升的节点不需要是 Block（避免在模块顶层调用 openBlock）
          child.codegenNode.isBlock = false;
          // 提升节点
          const hoisted = context.hoist(child.codegenNode);
          // 替换原节点的 codegenNode
          child.codegenNode = hoisted as any;
        }
      } else {
        // 不是完全静态，但子节点可能可以提升
        hoistChildren(child.children, context);
      }
    }

    // 处理 IF 节点
    if (child.type === NodeTypes.IF) {
      for (const branch of child.branches) {
        hoistChildren(branch.children, context);
      }
    }

    // 处理 FOR 节点
    if (child.type === NodeTypes.FOR) {
      hoistChildren(child.children, context);
    }
  }
}
