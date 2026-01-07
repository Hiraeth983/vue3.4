import { NodeTypes, SimpleExpressionNode } from "./../ast";
import { isInScope, TransformContext } from "../transform";
import { parse } from "@babel/parser";
import type { Node, Identifier } from "@babel/types";

// 全局变量白名单，不需要加 _ctx.
const GLOBALS_WHITE_LIST = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
  "console",
  "Math",
  "Date",
  "Array",
  "Object",
  "String",
  "Number",
  "Boolean",
  "JSON",
  "parseInt",
  "parseFloat",
  "window",
  "document",
]);

/**
 * transformExpression 插件
 * 职责：给表达式加上 _ctx. 前缀
 */
export function transformExpression(node, context: TransformContext) {
  if (node.type === NodeTypes.INTERPOLATION) {
    // 处理插值里的表达式
    node.content = processExpression(node.content, context);
  } else if (node.type === NodeTypes.ELEMENT) {
    // 处理指令里的表达式
    for (const prop of node.props) {
      if (prop.type === NodeTypes.DIRECTIVE && prop.exp) {
        prop.exp = processExpression(prop.exp, context);
      }
    }
  }
}

/**
 * processExpression 处理简单表达式
 * 
 * 为什么不处理 CompoundExpressionNode？
 * 因为 CompoundExpressionNode 是在 transformText 中创建的，它的子节点（文本和插值）在创建之前已经被 transformExpression 处理过了。
 * 执行顺序：
  1. transformExpression 处理 {{ msg }} → content 变成 _ctx.msg
  2. transformText 合并 "hello " + {{ msg }} → CompoundExpressionNode
 */
function processExpression(
  node: SimpleExpressionNode,
  context: TransformContext
): SimpleExpressionNode {
  const rawExp = node.content.trim();

  if (!rawExp) {
    return node;
  }

  // 解析表达式
  let ast: Node;
  try {
    ast = parse(`(${rawExp})`, {
      plugins: ["typescript"],
    }).program.body[0];
  } catch (e) {
    console.warn(`[Vue compiler] Failed to parse expression: ${rawExp}`);
    return node;
  }

  // 收集标识符及其位置
  const identifiers: { name: string; start: number; end: number }[] = [];

  if (ast.type === "ExpressionStatement") {
    walkIdentifiers(ast.expression, (id, parent) => {
      if (!GLOBALS_WHITE_LIST.has(id.name) && !isInScope(context, id.name)) {
        identifiers.push({
          name: id.name,
          start: id.start! - 1, // 减 1 是因为我们包了一层括号
          end: id.end! - 1,
        });
      }
    });
  }

  // 从后往前替换，避免位置偏移
  identifiers.sort((a, b) => b.start - a.start);

  let result = rawExp;
  for (const { name, start, end } of identifiers) {
    result = result.slice(0, start) + `_ctx.${name}` + result.slice(end);
  }

  return {
    ...node,
    content: result,
  };
}

/**
 * 遍历 AST 找出需要加前缀的标识符
 */
function walkIdentifiers(
  node: Node,
  onIdentifier: (id: Identifier, parent: Node | null) => void,
  parent: Node | null = null
) {
  switch (node.type) {
    case "Identifier":
      // 检查是否是对象属性（obj.foo 中的 foo 不需要处理）
      if (
        parent?.type === "MemberExpression" &&
        parent.property === node &&
        !parent.computed
      ) {
        break;
      }
      onIdentifier(node, parent);
      break;

    case "MemberExpression":
      // obj.foo → 只处理 obj
      walkIdentifiers(node.object, onIdentifier, node);
      // obj[key] → key 也需要处理
      if (node.computed && node.property) {
        walkIdentifiers(node.property, onIdentifier, node);
      }
      break;

    case "CallExpression":
      // fn(a, b)
      if (node.callee) {
        walkIdentifiers(node.callee, onIdentifier, node);
      }
      node.arguments.forEach((arg) => {
        walkIdentifiers(arg, onIdentifier, node);
      });
      break;

    case "BinaryExpression":
    case "LogicalExpression":
      // a + b, a && b
      walkIdentifiers(node.left, onIdentifier, node);
      walkIdentifiers(node.right, onIdentifier, node);
      break;

    case "ConditionalExpression":
      // a ? b : c
      walkIdentifiers(node.test, onIdentifier, node);
      walkIdentifiers(node.consequent, onIdentifier, node);
      walkIdentifiers(node.alternate, onIdentifier, node);
      break;

    case "ArrayExpression":
      // [a, b]
      node.elements.forEach((el) => {
        if (el) walkIdentifiers(el, onIdentifier, node);
      });
      break;

    case "ObjectExpression":
      // { a: b }
      node.properties.forEach((prop) => {
        if (prop.type === "ObjectProperty") {
          if (prop.computed && prop.key) {
            walkIdentifiers(prop.key, onIdentifier, node);
          }
          walkIdentifiers(prop.value, onIdentifier, node);
        }
      });
      break;

    case "UnaryExpression":
      // !a, -b
      walkIdentifiers(node.argument, onIdentifier, node);
      break;

    case "TemplateLiteral":
      // `hello ${name}`
      node.expressions.forEach((exp) => {
        walkIdentifiers(exp, onIdentifier, node);
      });
      break;

    case "OptionalMemberExpression":
      // obj?.foo
      walkIdentifiers(node.object, onIdentifier, node);
      if (node.computed && node.property) {
        walkIdentifiers(node.property, onIdentifier, node);
      }
      break;

    case "OptionalCallExpression":
      // fn?.()
      if (node.callee) {
        walkIdentifiers(node.callee, onIdentifier, node);
      }
      node.arguments.forEach((arg) => {
        walkIdentifiers(arg, onIdentifier, node);
      });
      break;
  }
}
