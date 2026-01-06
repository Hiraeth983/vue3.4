import { NodeTypes } from "@vue/compiler-core";
import { parse } from "../src/parse";
import { transform } from "../src/transform";
import { transformElement } from "../src/transforms/transformElement";
import {
  assertElementNode,
  assertInterpolationNode,
  assertSimpleExpressionNode,
} from "./test-utils";
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
    const content = element.content;
    assertSimpleExpressionNode(content);
    expect(content.content).toBe("_ctx.msg");
  });
});

describe("transformExpression with babel", () => {
  it("simple identifier", () => {
    const ast = parse("{{ msg }}");
    transform(ast, { nodeTransforms: [transformExpression] });

    const node = ast.children[0];
    assertInterpolationNode(node);
    assertSimpleExpressionNode(node.content);
    expect(node.content.content).toBe("_ctx.msg");
  });

  it("binary expression", () => {
    const ast = parse("{{ count + 1 }}");
    transform(ast, { nodeTransforms: [transformExpression] });
    const node = ast.children[0];
    assertInterpolationNode(node);
    assertSimpleExpressionNode(node.content);
    expect(node.content.content).toBe("_ctx.count + 1");
  });

  it("member expression", () => {
    const ast = parse("{{ obj.foo }}");
    transform(ast, { nodeTransforms: [transformExpression] });
    const node = ast.children[0];
    assertInterpolationNode(node);
    assertSimpleExpressionNode(node.content);
    expect(node.content.content).toBe("_ctx.obj.foo");
  });

  it("computed member", () => {
    const ast = parse("{{ arr[index] }}");
    transform(ast, { nodeTransforms: [transformExpression] });
    const node = ast.children[0];
    assertInterpolationNode(node);
    assertSimpleExpressionNode(node.content);
    expect(node.content.content).toBe("_ctx.arr[_ctx.index]");
  });

  it("function call", () => {
    const ast = parse("{{ fn(a, b) }}");
    transform(ast, { nodeTransforms: [transformExpression] });
    const node = ast.children[0];
    assertInterpolationNode(node);
    assertSimpleExpressionNode(node.content);
    expect(node.content.content).toBe("_ctx.fn(_ctx.a, _ctx.b)");
  });

  it("global whitelist", () => {
    const ast = parse("{{ Math.max(a, b) }}");
    transform(ast, { nodeTransforms: [transformExpression] });
    const node = ast.children[0];
    assertInterpolationNode(node);
    assertSimpleExpressionNode(node.content);
    expect(node.content.content).toBe("Math.max(_ctx.a, _ctx.b)");
  });

  it("ternary expression", () => {
    const ast = parse("{{ ok ? a : b }}");
    transform(ast, { nodeTransforms: [transformExpression] });
    const node = ast.children[0];
    assertInterpolationNode(node);
    assertSimpleExpressionNode(node.content);
    expect(node.content.content).toBe("_ctx.ok ? _ctx.a : _ctx.b");
  });
});
