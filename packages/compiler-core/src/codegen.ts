import { isString } from "@vue/shared";
import {
  ArrayExpression,
  CallExpression,
  CodegenNode,
  CompoundExpressionNode,
  ConditionalExpression,
  ForNode,
  FunctionExpression,
  HoistedNode,
  IfNode,
  InterpolationNode,
  NodeTypes,
  ObjectExpression,
  RootNode,
  SimpleExpressionNode,
  TextNode,
  VNodeCall,
} from "./ast";
import {
  CREATE_ELEMENT_BLOCK,
  CREATE_VNODE,
  helperNameMap,
  OPEN_BLOCK,
  TO_DISPLAY_STRING,
} from "./transform";

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
  const { push, indent, deindent, newline } = context;

  // 1. 生成前导代码（导入 helper 函数）
  // 生成: const { createVNode, toDisplayString } = Vue
  genFunctionPreamble(ast, context);

  // 2. 生成 hoisted 节点声明 在 render 函数外
  const hoists = ast.hoists || [];
  if (hoists.length > 0) {
    for (let i = 0; i < hoists.length; i++) {
      push(`const _hoisted_${i + 1} = `);
      genNode(hoists[i], context);
      newline();
    }
    newline();
  }

  // 3. 生成 render 函数签名
  const functionName = "render";
  const args = ["_ctx"];
  push(`function ${functionName}(${args.join(", ")}) {`);
  indent();

  // 4. 生成 return 语句
  push("return ");

  // 5. 生成节点代码
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context);
  } else {
    push("null");
  }

  // 6. 闭合函数
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
    case NodeTypes.JS_ARRAY_EXPRESSION:
      genArrayExpression(node as ArrayExpression, context);
      break;
    case NodeTypes.JS_OBJECT_EXPRESSION:
      genObjectExpression(node as ObjectExpression, context);
      break;
    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      genConditionalExpression(node as ConditionalExpression, context);
      break;
    case NodeTypes.JS_FUNCTION_EXPRESSION:
      genFunctionExpression(node as FunctionExpression, context);
      break;
    case NodeTypes.JS_CALL_EXPRESSION:
      genCallExpression(node as CallExpression, context);
      break;
    case NodeTypes.JS_HOISTED:
      genHoisted(node as HoistedNode, context);
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
 * genVNodeCall - 生成 VNode 调用且支持 Block 生成
 */
function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push } = context;
  const { tag, props, children, patchFlag, dynamicProps, isBlock } = node;

  // 🔥 如果是 Block，先生成 (openBlock(),
  if (isBlock) {
    push(`(${helperNameMap[OPEN_BLOCK]}(), `);
  }

  // 选择 helper：Block 用 createElementBlock，普通用 createVNode
  // 结果：createVNode("div", { ... }, [...])
  const callHelper = isBlock
    ? helperNameMap[CREATE_ELEMENT_BLOCK]
    : helperNameMap[CREATE_VNODE];
  push(`${callHelper}(`);

  // 生成参数列表
  // 单独处理 tag 可能是字符串 '"div"' 或 symbol FRAGMENT
  if (typeof tag === "symbol") {
    push(helperNameMap[tag]); // 输出 "Fragment"
  } else {
    push(tag); // 输出 '"div"'
  }
  // 处理 props
  if (props) {
    push(", ");
    genNode(props, context);
  } else if (children || patchFlag !== undefined) {
    push(", null"); // props 为空，需要占位
  }
  // 处理 children
  if (children) {
    push(", ");
    genNode(children, context);
  } else if (patchFlag !== undefined) {
    push(", null");
  }
  // patchFlag
  if (patchFlag !== undefined) {
    push(`, ${patchFlag}`);
  }
  // dynamicProps
  if (dynamicProps && dynamicProps.length > 0) {
    push(`, [`);
    push(dynamicProps.map((prop) => `"${prop}"`).join(", "));
    push(`]`);
  }

  push(")");

  // 如果是 Block，闭合括号
  if (isBlock) {
    push(")");
  }
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

/**
 * genArrayExpression - 数组表达式
 */
function genArrayExpression(node: ArrayExpression, context: CodegenContext) {
  const { push } = context;
  push("[");

  const { elements } = node;
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    if (isString(element)) {
      push(element);
    } else {
      genNode(element, context);
    }

    if (i < elements.length - 1) {
      push(", ");
    }
  }

  push("]");
}

/**
 * 条件表达式 a ? b : c
 */
function genConditionalExpression(
  node: ConditionalExpression,
  context: CodegenContext
) {
  const { test, consequent, alternate } = node;
  const { push, indent, deindent, newline } = context;

  // test
  genNode(test, context);

  // ? consequent
  indent();
  push("? ");
  genNode(consequent, context);

  // : alternate
  newline();
  push(": ");
  genNode(alternate, context);

  deindent();
}

/**
 * 函数表达式 (item, index) => { return ... }
 */
function genFunctionExpression(
  node: FunctionExpression,
  context: CodegenContext
) {
  const { push } = context;
  const { params, returns } = node;

  // (item, index) =>
  push("(");
  for (let i = 0; i < params.length; i++) {
    genNode(params[i], context);
    if (i < params.length - 1) push(", ");
  }
  push(") => ");

  // return body
  genNode(returns, context);
}

/**
 * 函数调用 renderList(source, callback)
 */
function genCallExpression(node: CallExpression, context: CodegenContext) {
  const { push } = context;
  const { callee, arguments: args } = node;

  // 函数名
  if (typeof callee === "symbol") {
    push(helperNameMap[callee]);
  } else {
    push(callee);
  }

  // 参数
  push("(");
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg === "string") {
      push(arg);
    } else {
      genNode(arg, context);
    }
    if (i < args.length - 1) push(", ");
  }
  push(")");
}

/**
 * 生成 hoisted 引用
 * 变量引用（在 render 函数内）
 */
function genHoisted(node: HoistedNode, context: CodegenContext) {
  context.push(`_hoisted_${node.index + 1}`);
}
