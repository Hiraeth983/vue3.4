/**
 * 节点类型枚举
 */
export const enum NodeTypes {
  ROOT, // 根节点
  ELEMENT, // 元素 <div>
  TEXT, // 文本
  COMMENT,
  SIMPLE_EXPRESSION, // 简单表达式（插值里的内容）
  INTERPOLATION, // 插值 {{ xxx }}
  ATTRIBUTE,
  DIRECTIVE, // 指令节点
  // 用于 codegen 的类型
  COMPOUND_EXPRESSION, // 复合表达式（文本 + 插值混合）
  JS_CALL_EXPRESSION, // JS 函数调用 h(...)
  JS_OBJECT_EXPRESSION, // JS 对象 { ... }
  JS_PROPERTY, // JS 属性 key: value
  JS_ARRAY_EXPRESSION, // JS 数组 [ ... ]
  VNODE_CALL, // createVNode 调用
  IF, // 用于 v-if
  IF_BRANCH,
  FOR, // 用于 v-for
  JS_CONDITIONAL_EXPRESSION, // JS 条件表达式
  JS_FUNCTION_EXPRESSION, // JS 函数表达式（v-for 回调）
}

/**
 * 根节点
 */
export interface RootNode {
  type: NodeTypes.ROOT;
  children: TemplateChildNode[];
  codegenNode?: CodegenNode;
  helpers: Set<symbol>; // 需要导入的运行时帮助函数
}

/**
 * 元素节点
 */
export interface ElementNode {
  type: NodeTypes.ELEMENT;
  tag: string; // 标签名
  props: Array<ElementPropNode>; // 可以是属性或指令
  children: TemplateChildNode[];
  isSelfClosing: boolean; // 是否自闭合
  codegenNode?: VNodeCall | CallExpression;
}

/**
 * 文本节点
 */
export interface TextNode {
  type: NodeTypes.TEXT;
  content: string;
}

/**
 * 插值节点 {{ msg }}
 */
export interface InterpolationNode {
  type: NodeTypes.INTERPOLATION;
  content: ExpressionNode; // 里面的表达式
}

/**
 * 表达式节点
 */
export interface SimpleExpressionNode {
  type: NodeTypes.SIMPLE_EXPRESSION;
  content: string; // 表达式内容，如 "msg"
  isStatic: boolean; // 是否静态（字面量）
}

/**
 * 属性节点（普通属性）
 */
export interface AttributeNode {
  type: NodeTypes.ATTRIBUTE;
  name: string;
  value: TextNode | undefined;
}

/**
 * 指令节点（v-bind、v-on、v-if、v-for 等）
 */
export interface DirectiveNode {
  type: NodeTypes.DIRECTIVE;
  name: string; // 指令名：bind、on、if、for、model...
  exp: ExpressionNode | undefined; // 指令表达式：v-if="show" 中的 show
  arg: ExpressionNode | undefined; // 指令参数：v-bind:id 中的 id
  modifiers: string[]; // 修饰符：@click.stop.prevent 中的 ['stop', 'prevent']
}
// | 语法                     | name  | arg    | exp          | modifiers          |
// |--------------------------|-------|--------|--------------|--------------------|
// | v-bind:id="userId"       | bind  | id     | userId       | []                 |
// | :id="userId"             | bind  | id     | userId       | []                 |
// | v-on:click="handleClick" | on    | click  | handleClick  | []                 |
// | @click="handleClick"     | on    | click  | handleClick  | []                 |
// | @click.stop.prevent="fn" | on    | click  | fn           | ['stop','prevent'] |
// | v-if="show"              | if    | -      | show         | []                 |
// | v-for="item in list"     | for   | -      | item in list | []                 |
// | v-model="value"          | model | -      | value        | []                 |
// | v-slot:header            | slot  | header | -            | []                 |
// | #header                  | slot  | header | -            | []                 |

/**
 * 复合表达式：文本和插值混合
 * 例如 "hello " + msg + "!"
 */
export interface CompoundExpressionNode {
  type: NodeTypes.COMPOUND_EXPRESSION;
  children: (TextNode | InterpolationNode | SimpleExpressionNode | string)[];
}

/**
 * VNode 调用节点（给 codegen 用）
 */
export interface VNodeCall {
  type: NodeTypes.VNODE_CALL;
  tag: string | symbol;
  props: ObjectExpression | undefined;
  children: CodegenNode | undefined;
}

/**
 * JS 对象表达式 { class: 'red', id: 'app' }
 */
export interface ObjectExpression {
  type: NodeTypes.JS_OBJECT_EXPRESSION;
  properties: Property[];
}

/**
 * JS 属性
 */
export interface Property {
  type: NodeTypes.JS_PROPERTY;
  key: SimpleExpressionNode;
  value: ExpressionNode;
}

/**
 * JS 数组
 */
export interface ArrayExpression {
  type: NodeTypes.JS_ARRAY_EXPRESSION;
  elements: (CodegenNode | string)[];
}

/**
 * v-if 节点
 */
export interface IfNode {
  type: NodeTypes.IF;
  branches: IfBranchNode[];
  codegenNode?: CodegenNode;
}

/**
 * v-if 分支
 */
export interface IfBranchNode {
  type: NodeTypes.IF_BRANCH;
  condition: ExpressionNode | undefined; // v-else 没有条件
  children: TemplateChildNode[];
  userKey?: ElementPropNode; // 用户指定的 key
}

/**
 * v-for 节点
 */
export interface ForNode {
  type: NodeTypes.FOR;
  source: ExpressionNode; // 数据源：list
  valueAlias: ExpressionNode; // 值别名：item
  keyAlias?: ExpressionNode; // 索引别名：index
  children: TemplateChildNode[];
  codegenNode?: CodegenNode;
}

/**
 * JS 条件表达式 a ? b : c
 */
export interface ConditionalExpression {
  type: NodeTypes.JS_CONDITIONAL_EXPRESSION;
  test: ExpressionNode; // a
  consequent: ExpressionNode; // b
  alternate: ExpressionNode; // c
}

/**
 * JS 函数表达式 (item, index) => { ... }
 */
export interface FunctionExpression {
  type: NodeTypes.JS_FUNCTION_EXPRESSION;
  params: ExpressionNode[];
  returns: CodegenNode;
}

/**
 * JS 函数调用表达式 createComment() / renderList(...)
 */
export interface CallExpression {
  type: NodeTypes.JS_CALL_EXPRESSION;
  callee: symbol | string; // 函数名：CREATE_COMMENT / RENDER_LIST
  arguments: (CodegenNode | ExpressionNode)[]; // 参数列表
}

/**
 * 子节点联合类型
 */
export type TemplateChildNode =
  | ElementNode
  | TextNode
  | InterpolationNode
  | ExpressionNode
  | IfNode
  | ForNode;

/**
 * 表达式联合类型
 */
export type ExpressionNode = SimpleExpressionNode | CompoundExpressionNode;

/**
 * Element 属性联合类型
 */
export type ElementPropNode = AttributeNode | DirectiveNode;

/**
 * Codegen 节点联合类型
 */
export type CodegenNode =
  | Exclude<TemplateChildNode, ElementNode | IfNode | ForNode>
  | VNodeCall
  | ArrayExpression
  | ObjectExpression
  | ConditionalExpression
  | FunctionExpression
  | CallExpression;

/**
 * 获取子节点的 CodegenNode
 * ElementNode、IfNode、ForNode 需要取它的 codegenNode，其他类型直接返回
 */
export function getChildCodegenNode(child: TemplateChildNode): CodegenNode {
  // 处理 ElementNode
  if (child.type === NodeTypes.ELEMENT) {
    return (child as ElementNode).codegenNode!;
  }
  // 处理 IfNode
  if (child.type === NodeTypes.IF) {
    return (child as IfNode).codegenNode!;
  }
  // 处理 ForNode
  if (child.type === NodeTypes.FOR) {
    return (child as ForNode).codegenNode!;
  }
  return child as CodegenNode;
}
