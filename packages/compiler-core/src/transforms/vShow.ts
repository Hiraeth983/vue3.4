import {
  CallExpression,
  ElementNode,
  NodeTypes,
  TemplateChildNode,
} from "../ast";
import {
  findDir,
  TransformContext,
  V_SHOW,
  WITH_DIRECTIVES,
} from "../transform";

/**
 * v-show 需要运行时指令处理
 *
 * <div v-show="visible">
 * ↓
 * withDirectives(createVNode("div"), [[vShow, visible]])
 */
export function transformVShow(
  node: TemplateChildNode,
  context: TransformContext
) {
  if (node.type !== NodeTypes.ELEMENT) return;

  const element = node as ElementNode;
  const showDir = findDir(element, "show");
  if (!showDir) return;

  // 在退出时处理，等 codegenNode 生成后包装
  return () => {
    if (!element.codegenNode) return;

    context.helper(WITH_DIRECTIVES);
    context.helper(V_SHOW);

    // 包装成 withDirectives 调用
    element.codegenNode = {
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: WITH_DIRECTIVES,
      arguments: [
        element.codegenNode,
        {
          type: NodeTypes.JS_ARRAY_EXPRESSION,
          elements: [
            {
              type: NodeTypes.JS_ARRAY_EXPRESSION,
              elements: [
                {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: "vShow",
                  isStatic: false,
                },
                (showDir as any).exp,
              ],
            },
          ],
        },
      ],
    } as CallExpression;
  };
}
