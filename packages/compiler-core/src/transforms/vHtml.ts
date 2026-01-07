import { findDir, removeDir, TransformContext } from "./../transform";
import { ElementNode, NodeTypes, TemplateChildNode } from "../ast";

/**
 * v-html → innerHTML 属性
 */
export function transformVHtml(
  node: TemplateChildNode,
  context: TransformContext
) {
  if (node.type !== NodeTypes.ELEMENT) return;

  const element = node as ElementNode;
  const htmlDir = findDir(element, "html");
  if (!htmlDir) return;

  // 移除 v-html
  removeDir(element, ["html"]);

  // 添加 innerHTML 属性
  element.props.push({
    type: NodeTypes.DIRECTIVE,
    name: "bind",
    arg: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: "innerHtml",
      isStatic: true,
    },
    exp: htmlDir.exp,
    modifiers: [],
  });

  // 清空 children（v-html 会覆盖内容）
  element.children = [];
}

/**
 * v-text → textContent 属性
 */
export function transformVText(
  node: TemplateChildNode,
  context: TransformContext
) {
  if (node.type !== NodeTypes.ELEMENT) return;

  const element = node as ElementNode;
  const textDir = findDir(element, "text");
  if (!textDir) return;

  removeDir(element, ["text"]);

  element.props.push({
    type: NodeTypes.DIRECTIVE,
    name: "bind",
    arg: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: "textContent",
      isStatic: true,
    },
    exp: textDir.exp,
    modifiers: [],
  });

  element.children = [];
}
