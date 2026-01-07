import { generate } from "./codegen";
import { parse } from "./parse";
import { transform } from "./transform";
import { transformElement } from "./transforms/transformElement";
import { transformExpression } from "./transforms/transformExpression";
import { transformText } from "./transforms/transformText";
import { transformFor } from "./transforms/vFor";
import { transformVHtml, transformVText } from "./transforms/vHtml";
import { transformIf } from "./transforms/vIf";
import { transformModel } from "./transforms/vModel";
import { transformVShow } from "./transforms/vShow";

export function compile(template: string) {
  // 1. Parse
  const ast = parse(template);

  // 2. Transform
  transform(ast, {
    nodeTransforms: [
      // 结构转换（必须先执行）
      transformIf, // v-if/else-if/else
      transformFor, // v-for

      // 指令展开
      transformModel, // v-model → :value + @input
      transformVHtml, // v-html → innerHTML
      transformVText, // v-text → textContent

      // 表达式处理
      transformExpression,

      // 元素转换
      transformElement,
      transformText,

      // 运行时指令（最后）
      transformVShow,
    ],
  });

  // 3. Codegen
  const { code } = generate(ast);

  return {
    ast,
    code,
  };
}
