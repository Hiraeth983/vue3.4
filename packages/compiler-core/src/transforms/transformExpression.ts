import { DirectiveNode, ExpressionNode, NodeTypes } from "./../ast";
import { TransformContext } from "../transform";

/**
 * transformExpression 插件
 * 职责：给表达式加上 _ctx. 前缀
 */
export function transformExpression(node, context: TransformContext) {
  if (node.type === NodeTypes.INTERPOLATION) {
    // 处理插值里的表达式
    node.content = processExpression(node.content);
  } else if (node.type === NodeTypes.ELEMENT) {
    // 处理指令里的表达式
    for (const prop of node.props) {
      if (prop.type === NodeTypes.DIRECTIVE && prop.exp) {
        prop.exp = processExpression(prop.exp);
      }
    }
  }
}

function processExpression(node: ExpressionNode) {
  // 简化处理：直接加 _ctx. 前缀
  // 完整实现需要用 @babel/parser 分析变量
  node.content = `_ctx.${node.content}`;
  return node;
}
