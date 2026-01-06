// 节点类型枚举
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
}

// 根节点
export interface RootNode {
  type: NodeTypes.ROOT;
  children: TemplateChildNode[];
  codegenNode?: CodegenNode;
  helpers: Set<symbol>; // 需要导入的运行时帮助函数
}

// 元素节点
export interface ElementNode {
  type: NodeTypes.ELEMENT;
  tag: string; // 标签名
  props: Array<ElementPropNode>; // 可以是属性或指令
  children: TemplateChildNode[];
  isSelfClosing: boolean; // 是否自闭合
  codegenNode?: VNodeCall;
}

// 文本节点
export interface TextNode {
  type: NodeTypes.TEXT;
  content: string;
}

// 插值节点 {{ msg }}
export interface InterpolationNode {
  type: NodeTypes.INTERPOLATION;
  content: ExpressionNode; // 里面的表达式
}

// 表达式节点
export interface SimpleExpressionNode {
  type: NodeTypes.SIMPLE_EXPRESSION;
  content: string; // 表达式内容，如 "msg"
  isStatic: boolean; // 是否静态（字面量）
}

// 属性节点（普通属性）
export interface AttributeNode {
  type: NodeTypes.ATTRIBUTE;
  name: string;
  value: TextNode | undefined;
}

// 指令节点（v-bind、v-on、v-if、v-for 等）
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

// VNode 调用节点（给 codegen 用）
export interface VNodeCall {
  type: NodeTypes.VNODE_CALL;
  tag: string | symbol;
  props: ObjectExpression | undefined;
  children: TemplateChildNode | TemplateChildNode[] | undefined; // 支持单个节点
}

// JS 对象表达式 { class: 'red', id: 'app' }
export interface ObjectExpression {
  type: NodeTypes.JS_OBJECT_EXPRESSION;
  properties: Property[];
}

// JS 属性
export interface Property {
  type: NodeTypes.JS_PROPERTY;
  key: SimpleExpressionNode;
  value: SimpleExpressionNode;
}

// 子节点联合类型
export type TemplateChildNode =
  | ElementNode
  | TextNode
  | InterpolationNode
  | CompoundExpressionNode;

// 表达式联合类型
export type ExpressionNode = SimpleExpressionNode;

// Element 属性联合类型
export type ElementPropNode = AttributeNode | DirectiveNode;

// Codegen 节点联合类型
export type CodegenNode =
  | TemplateChildNode
  | VNodeCall
  | CompoundExpressionNode;
