import { parse } from "./parse";
import { transform } from "./transform";
import { transformElement } from "./transforms/transformElement";
import { transformExpression } from "./transforms/transformExpression";
import { transformText } from "./transforms/transformText";

export function compile(template: string) {
  // 1. Parse
  const ast = parse(template);

  // 2. Transform
  transform(ast, {
    nodeTransforms: [
      transformExpression, // 先处理表达式
      transformElement,
      transformText,
    ],
  });

  // 3. Codegen（下一步实现）
  // return generate(ast)

  return ast;
}
