import {
  CodegenNode,
  ElementNode,
  ElementPropNode,
  getChildCodegenNode,
  NodeTypes,
  ObjectExpression,
  Property,
  VNodeCall,
} from "../ast";
import { CREATE_VNODE, TransformContext } from "../transform";

/**
 * transformElement 插件
 * 职责：把 ElementNode 转换成 VNodeCall
 */
export function transformElement(node, context: TransformContext) {
  // 只处理元素节点
  if (node.type !== NodeTypes.ELEMENT) {
    return;
  }

  // 返回退出函数，等子节点处理完再执行
  return () => {
    const { tag, props, children } = node as ElementNode;

    // 1. 处理 Tag
    const vnodeTag = `"${tag}"`;

    // 2. 处理 props
    let vnodeProps: ObjectExpression | undefined;
    if (props.length > 0) {
      vnodeProps = buildProps(props, context);
    }

    // 3. 处理 children
    let vnodeChildren: CodegenNode | undefined;
    if (children.length === 1) {
      // 单个子节点，取其 codegenNode
      vnodeChildren = getChildCodegenNode(children[0]);
    } else if (children.length > 1) {
      // 多个子节点包装成 ArrayExpression
      vnodeChildren = {
        type: NodeTypes.JS_ARRAY_EXPRESSION,
        elements: children.map(getChildCodegenNode),
      };
    }

    // 4. 创建 VNodeCall
    const vnode: VNodeCall = {
      type: NodeTypes.VNODE_CALL,
      tag: vnodeTag,
      props: vnodeProps,
      children: vnodeChildren,
    };

    // 添加 helper
    context.helper(CREATE_VNODE);

    // 挂载到节点上
    (node as ElementNode).codegenNode = vnode;
  };
}

// 构建 props 对象
function buildProps(
  props: ElementPropNode[],
  context: TransformContext
): ObjectExpression {
  const properties: Property[] = [];

  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      // 普通属性 id="app"
      properties.push({
        type: NodeTypes.JS_PROPERTY,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: prop.name,
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: prop.value ? `"${prop.value.content}"` : "true",
          isStatic: true,
        },
      });
    } else if (prop.type === NodeTypes.DIRECTIVE) {
      // 指令，根据类型分别处理
      if (prop.name === "bind") {
        // v-bind / :xxx
        // 先判断 arg 是否是 SimpleExpressionNode
        const argNode = prop.arg;
        const argContent =
          argNode.type === NodeTypes.SIMPLE_EXPRESSION
            ? argNode?.content || ""
            : "";
        const argIsStatic =
          argNode.type === NodeTypes.SIMPLE_EXPRESSION
            ? argNode?.isStatic ?? true
            : true;

        properties.push({
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: argContent,
            isStatic: argIsStatic,
          },
          value: prop.exp!,
        });
      } else if (prop.name === "on") {
        // v-on / @xxx
        const argNode = prop.arg;
        const argContent =
          argNode.type === NodeTypes.SIMPLE_EXPRESSION
            ? argNode?.content || ""
            : "";
        const eventName = "on" + capitalize(argContent || "");

        properties.push({
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: eventName,
            isStatic: true,
          },
          value: prop.exp!,
        });
      }
    }
  }

  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties,
  };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
