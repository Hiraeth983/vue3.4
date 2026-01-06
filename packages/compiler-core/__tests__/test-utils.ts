import {
  ElementNode,
  InterpolationNode,
  NodeTypes,
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
