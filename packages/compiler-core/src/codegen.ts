import { isArray, isString } from "@vue/shared";
import {
  CodegenNode,
  CompoundExpressionNode,
  ElementNode,
  InterpolationNode,
  NodeTypes,
  ObjectExpression,
  RootNode,
  SimpleExpressionNode,
  TemplateChildNode,
  TextNode,
  VNodeCall,
} from "./ast";
import { helperNameMap, TO_DISPLAY_STRING } from "./transform";

// 代码生成上下文
interface CodegenContext {
  code: string; // 生成的代码
  indentLevel: number; // 缩进级别
  push(code: string): void; // 追加代码
  indent(): void; // 增加缩进
  deindent(): void; // 减少缩进
  newline(): void; // 换行
}

function createCodegenContext(): CodegenContext {
  const context: CodegenContext = {
    code: "",
    indentLevel: 0,

    push(code: string) {
      context.code += code;
    },

    indent() {
      context.indentLevel++;
      context.newline();
    },

    deindent() {
      context.indentLevel--;
      context.newline();
    },

    newline() {
      context.code += "\n" + "  ".repeat(context.indentLevel);
    },
  };

  return context;
}

/**
 * Codegen 阶段概述 generate 入口函数
 * 核心职责：把转换后的 AST 生成 render 函数代码字符串
 * 
 * // 输入 AST
  {
    type: VNODE_CALL,
    tag: '"div"',
    props: { properties: [...] },
    children: [...]
  }

  // 输出代码
  function render(_ctx) {
    return createVNode("div", { id: _ctx.userId }, "hello")
  }
 */
export function generate(ast: RootNode): { code: string } {
  const context = createCodegenContext();
  const { push, indent, deindent } = context;

  // 1. 生成前导代码（导入 helper 函数）
  // 生成: const { createVNode, toDisplayString } = Vue
  genFunctionPreamble(ast, context);

  // 2. 生成 render 函数签名
  const functionName = "render";
  const args = ["_ctx"];
  push(`function ${functionName}(${args.join(", ")}) {`);
  indent();

  // 3. 生成 return 语句
  push("return ");

  // 4. 生成节点代码
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context);
  } else {
    push("null");
  }

  // 5. 闭合函数
  deindent();
  push("}");

  return { code: context.code };
}

/**
 * 生成前导代码（导入语句）
 * 生成: const { createVNode, toDisplayString } = Vue
 */
function genFunctionPreamble(ast: RootNode, context: CodegenContext) {
  const { push, newline } = context;
  const helpers = Array.from(ast.helpers);

  if (helpers.length > 0) {
    push(`const { ${helpers.map((h) => helperNameMap[h]).join(", ")} } = Vue`);
    newline();
    newline();
  }
}

/**
 * genNode 分发函数
 * 根据节点类型分发到不同的生成函数
 */
function genNode(node: CodegenNode, context: CodegenContext) {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      genNode((node as ElementNode).codegenNode!, context);
      break;
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node as VNodeCall, context);
      break;
    case NodeTypes.TEXT:
      genText(node as TextNode, context);
      break;
    case NodeTypes.INTERPOLATION:
      genInterpolation(node as InterpolationNode, context);
      break;
    case NodeTypes.SIMPLE_EXPRESSION:
      genSimpleExpression(node as SimpleExpressionNode, context);
      break;
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node as CompoundExpressionNode, context);
      break;
  }
}

/**
 * genText - 文本节点
 */
function genText(node: TextNode, context: CodegenContext) {
  // 结果：输出带引号的字符串
  context.push(`"${node.content}"`);
}

/**
 * genSimpleExpression - 表达式节点
 * 
 * // 属性名 id 是静态的
    <div id="app">

    // 生成代码时，id 作为 key 需要加引号
    { "id": "app" }

    动态表达式（isStatic: false）

    指变量或表达式，生成代码时直接输出：

    // userId 是变量
    <div :id="userId">

    // 生成代码时，_ctx.userId 是 JS 变量，不能加引号
    { id: _ctx.userId }
 */
function genSimpleExpression(
  node: SimpleExpressionNode,
  context: CodegenContext
) {
  // 结果：静态表达式加引号，动态表达式直接输出
  context.push(node.isStatic ? `"${node.content}"` : node.content);
}

/**
 * genCompoundExpression - 复合表达式
 */
function genCompoundExpression(
  node: CompoundExpressionNode,
  context: CodegenContext
) {
  // 结果："hello " + toDisplayString(_ctx.msg) + "!"
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (isString(child)) {
      // 连接符 " + "
      context.push(child);
    } else {
      genNode(child, context);
    }
  }
}

/**
 * genInterpolation - 插值节点
 */
function genInterpolation(node: InterpolationNode, context: CodegenContext) {
  // 结果：{{ msg }} → toDisplayString(_ctx.msg)
  context.push(`${helperNameMap[TO_DISPLAY_STRING]}(`);
  genNode(node.content, context);
  context.push(")");
}

/**
 * genVNodeCall - VNode 调用
 */
function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push } = context;
  const { tag, props, children } = node;

  // 结果：createVNode("div", { ... }, [...])
  push("createVNode(");

  // 生成参数列表
  genNodeList([tag, props, children].filter(Boolean) as any[], context);

  push(")");
}

/**
 * 生成参数列表，用逗号分隔
 */
function genNodeList(
  nodes: (
    | string
    | TemplateChildNode
    | VNodeCall
    | ObjectExpression
    | undefined
  )[],
  context: CodegenContext
) {
  const { push } = context;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (isString(node)) {
      // tag 名，直接输出
      push(node);
    } else if (isArray(node)) {
      // children 数组
      genNodeListAsArray(node, context);
    } else if (typeof node === "object") {
      // props 对象或子节点
      // typeof (null | [] | {}) === "object"
      if (node.type === NodeTypes.JS_OBJECT_EXPRESSION) {
        genObjectExpression(node as ObjectExpression, context);
      } else {
        genNode(node as TemplateChildNode, context);
      }
    }

    // 添加逗号分隔（不是最后一个）
    if (i < nodes.length - 1) {
      push(", ");
    }
  }
}

/**
 * 生成数组形式的 children
 */
function genNodeListAsArray(
  nodes: TemplateChildNode[],
  context: CodegenContext
) {
  context.push("[");
  genNodeList(nodes, context);
  context.push("]");
}

/**
 * genObjectExpression - 对象表达式
 */
function genObjectExpression(node: ObjectExpression, context: CodegenContext) {
  const { push } = context;
  const { properties } = node;

  if (properties.length === 0) {
    push("{}");
    return;
  }

  push("{ ");

  for (let i = 0; i < properties.length; i++) {
    const { key, value } = properties[i];

    // key
    genSimpleExpression(key, context);
    push(": ");
    // value
    genNode(value, context);

    // 逗号
    if (i < properties.length - 1) {
      push(", ");
    }
  }

  push(" }");
}
