import { PatchFlags } from "@vue/shared";
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
import {
  CREATE_ELEMENT_BLOCK,
  CREATE_VNODE,
  OPEN_BLOCK,
  TransformContext,
} from "../transform";
import { isStaticExpression } from "./hoistStatic";

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

    // 2. 分析 PatchFlag
    const { patchFlag, dynamicProps } = analyzePatchFlag(
      node as ElementNode,
      context
    );

    // 3. 处理 props
    let vnodeProps: ObjectExpression | undefined;
    if (props.length > 0) {
      vnodeProps = buildProps(props, context);
    }

    // 4. 处理 children
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

    // 判断是否应该作为 Block
    // 根节点、或有结构指令的节点应该是 Block
    const shouldUseBlock = isRootNode(node, context);

    // 5. 创建 VNodeCall
    const vnode: VNodeCall = {
      type: NodeTypes.VNODE_CALL,
      tag: vnodeTag,
      props: vnodeProps,
      children: vnodeChildren,
      patchFlag,
      dynamicProps,
      isBlock: shouldUseBlock,
    };

    // 根据是否是 Block 选择不同的 helper
    if (shouldUseBlock) {
      context.helper(OPEN_BLOCK);
      context.helper(CREATE_ELEMENT_BLOCK);
    } else {
      context.helper(CREATE_VNODE);
    }

    // 挂载到节点上
    (node as ElementNode).codegenNode = vnode;
  };
}

/**
 * 判断是否是根节点（简化判断）
 */
function isRootNode(node: ElementNode, context: TransformContext): boolean {
  return context.parent?.type === NodeTypes.ROOT;
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
          argNode?.type === NodeTypes.SIMPLE_EXPRESSION
            ? argNode.content || ""
            : "";
        const argIsStatic =
          argNode?.type === NodeTypes.SIMPLE_EXPRESSION
            ? argNode.isStatic ?? true
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
          argNode?.type === NodeTypes.SIMPLE_EXPRESSION
            ? argNode.content || ""
            : "";
        const eventName = "on" + capitalize(argContent);

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

/**
 * 分析元素的 patchFlag
 */
function analyzePatchFlag(
  node: ElementNode,
  context: TransformContext
): { patchFlag: number | undefined; dynamicProps: string[] | undefined } {
  let patchFlag = 0;
  const dynamicProps: string[] = [];
  const { props, children } = node;

  // ========== 1. 检查子节点 ==========
  // 单个插值子节点 → TEXT flag
  if (children.length === 1 && children[0].type === NodeTypes.INTERPOLATION) {
    patchFlag |= PatchFlags.TEXT;
  }

  // ========== 2. 检查 props ==========
  for (const prop of props) {
    if (prop.type !== NodeTypes.DIRECTIVE) continue;

    const { name, arg, exp } = prop;

    if (name === "bind") {
      // v-bind 动态绑定
      if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION) {
        // 检查属性名是否是动态的 :[dynamicKey]="value"
        if (!arg.isStatic) {
          // 动态属性名，运行时无法确定具体属性，需要完整 diff
          patchFlag |= PatchFlags.FULL_PROPS;
          continue;
        }

        const propName = arg.content;

        // 表达式是动态的才标记
        if (exp && !isStaticExpression(exp)) {
          if (propName === "class") {
            patchFlag |= PatchFlags.CLASS;
          } else if (propName === "style") {
            patchFlag |= PatchFlags.STYLE;
          } else {
            // 其他动态属性
            dynamicProps.push(propName);
          }
        }
      } else if (!arg) {
        // v-bind="obj" 无参数，把整个对象展开绑定到元素上，动态 key，需要 FULL_PROPS
        // <div v-bind="attrs">对象展开绑定</div>
        patchFlag |= PatchFlags.FULL_PROPS;
      }
    } else if (name === "on") {
      // 事件绑定
      patchFlag |= PatchFlags.HYDRATE_EVENTS;
    } else if (name === "model" || name === "show") {
      // 需要 patch 的指定
      patchFlag |= PatchFlags.NEED_PATCH;
    }
  }

  // ========== 3. 处理 PROPS flag ==========
  if (dynamicProps.length > 0) {
    patchFlag |= PatchFlags.PROPS;
  }

  return {
    patchFlag: patchFlag || undefined,
    dynamicProps: dynamicProps.length > 0 ? dynamicProps : undefined,
  };
}
