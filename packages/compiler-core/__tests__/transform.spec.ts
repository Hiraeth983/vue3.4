import { NodeTypes } from "@vue/compiler-core";
import { parse } from "../src/parse";
import { transform } from "../src/transform";
import { transformElement } from "../src/transforms/transformElement";
import { assertElementNode, assertInterpolationNode } from "./test-utils";
import { transformExpression } from "../src/transforms/transformExpression";

describe("transform", () => {
  it("should addd codegenNode to element", () => {
    const ast = parse('<div id="app">hello</div>');

    transform(ast, {
      nodeTransforms: [transformElement],
    });

    const element = ast.children[0];
    assertElementNode(element);
    expect(element.codegenNode).toBeDefined();
    expect(element.codegenNode.type).toBe(NodeTypes.VNODE_CALL);
    expect(element.codegenNode.tag).toBe('"div"');
  });

  it("should process expression", () => {
    const ast = parse("{{ msg }}");

    transform(ast, {
      nodeTransforms: [transformExpression],
    });

    const element = ast.children[0];
    assertInterpolationNode(element);
    expect(element.content.content).toBe("_ctx.msg");
  });
});
