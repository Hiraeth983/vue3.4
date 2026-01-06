import {
  ElementNode,
  ExpressionNode,
  InterpolationNode,
  NodeTypes,
  SimpleExpressionNode,
  TemplateChildNode,
} from "../src/ast";

export function assertElementNode(
  node: TemplateChildNode
): asserts node is ElementNode {
  if (node.type !== NodeTypes.ELEMENT) {
    throw new Error(`Expected ELEMENT node, got ${node.type}`);
  }
}

export function assertInterpolationNode(
  node: TemplateChildNode
): asserts node is InterpolationNode {
  if (node.type !== NodeTypes.INTERPOLATION) {
    throw new Error(`Expected INTERPOLATION node, got ${node.type}`);
  }
}

// 参数类型改为 ExpressionNode，因为 InterpolationNode.content 是 ExpressionNode
export function assertSimpleExpressionNode(
  node: ExpressionNode
): asserts node is SimpleExpressionNode {
  if (node.type !== NodeTypes.SIMPLE_EXPRESSION) {
    throw new Error(`Expected SimpleExpressionNode node, got ${node.type}`);
  }
}
