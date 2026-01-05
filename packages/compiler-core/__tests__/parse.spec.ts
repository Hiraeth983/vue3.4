import { parse, NodeTypes } from "../src";
import { assertElementNode } from "./test-utils";

describe("compiler: parse", () => {
  describe("Text", () => {
    it("simple text", () => {
      const ast = parse("hello world");

      expect(ast.children.length).toBe(1);
      expect(ast.children[0]).toMatchObject({
        type: NodeTypes.TEXT,
        content: "hello world",
      });
    });
  });

  describe("Interpolation", () => {
    it("simple interpolation", () => {
      const ast = parse("{{ msg }}");

      expect(ast.children.length).toBe(1);
      expect(ast.children[0]).toMatchObject({
        type: NodeTypes.INTERPOLATION,
        content: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: "msg",
          isStatic: false,
        },
      });
    });
  });

  describe("Element", () => {
    it("simple div", () => {
      const ast = parse("<div></div>");

      expect(ast.children.length).toBe(1);
      expect(ast.children[0]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "div",
        children: [],
      });
    });

    it("element with text", () => {
      const ast = parse("<div>hello</div>");

      expect(ast.children[0]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "div",
        children: [{ type: NodeTypes.TEXT, content: "hello" }],
      });
    });

    it("element with interpolation", () => {
      const ast = parse("<div>{{ msg }}</div>");
      const node = ast.children[0];

      assertElementNode(node);
      expect(node.children[0]).toMatchObject({
        type: NodeTypes.INTERPOLATION,
        content: { content: "msg" },
      });
    });

    it("element with attributes", () => {
      const ast = parse('<div id="app" class="container"></div>');
      const node = ast.children[0];

      assertElementNode(node);
      expect(node.props).toMatchObject([
        { name: "id", value: { content: "app" } },
        { name: "class", value: { content: "container" } },
      ]);
    });
  });
});

describe("Directive", () => {
  it("v-bind", () => {
    const ast = parse('<div v-bind:id="userId"></div>');
    const element = ast.children[0];

    assertElementNode(element);
    expect(element.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: "bind",
      arg: { content: "id", isStatic: true },
      exp: { content: "userId" },
    });
  });

  it(":id shorthand", () => {
    const ast = parse('<div :id="userId"></div>');
    const element = ast.children[0];

    assertElementNode(element);
    expect(element.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: "bind",
      arg: { content: "id" },
      exp: { content: "userId" },
    });
  });

  it("@click with modifiers", () => {
    const ast = parse('<button @click.stop.prevent="handleClick"></button>');
    const element = ast.children[0];

    assertElementNode(element);
    expect(element.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: "on",
      arg: { content: "click" },
      exp: { content: "handleClick" },
      modifiers: ["stop", "prevent"],
    });
  });

  it("v-if", () => {
    const ast = parse('<div v-if="show"></div>');
    const element = ast.children[0];

    assertElementNode(element);
    expect(element.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: "if",
      exp: { content: "show" },
    });
  });

  it("v-for", () => {
    const ast = parse('<div v-for="item in list"></div>');
    const element = ast.children[0];

    assertElementNode(element);
    expect(element.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: "for",
      exp: { content: "item in list" },
    });
  });

  it("dynamic arg :[key]", () => {
    const ast = parse('<div :[attrName]="value"></div>');
    const element = ast.children[0];

    assertElementNode(element);
    expect(element.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: "bind",
      arg: { content: "attrName", isStatic: false }, // 动态参数
    });
  });
});
