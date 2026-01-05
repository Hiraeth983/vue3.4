import { ElementNode, NodeTypes, TemplateChildNode } from "../src/ast";

export function assertElementNode(
  node: TemplateChildNode
): asserts node is ElementNode {
  if (node.type !== NodeTypes.ELEMENT) {
    throw new Error(`Expected ELEMENT node, got ${node.type}`);
  }
}
