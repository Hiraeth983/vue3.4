import {
  AttributeNode,
  DirectiveNode,
  ElementNode,
  ElementPropNode,
  InterpolationNode,
  NodeTypes,
  RootNode,
  SimpleExpressionNode,
  TemplateChildNode,
  TextNode,
} from "./ast";

interface ParserContext {
  source: string; // 剩余待解析的模板字符串
  originalSource: string; // 原始模板（用于报错定位）
}

function createParserContext(template: string): ParserContext {
  return {
    source: template,
    originalSource: template,
  };
}

// 工具函数：向前推进 n 个字符
function advanceBy(context: ParserContext, numberOfCharacters: number) {
  context.source = context.source.slice(numberOfCharacters);
}

// 工具函数：跳过空白字符，匹配头部的全部空格并推进
function advanceSpaces(context: ParserContext) {
  const match = /^[\t\r\n\f ]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
}

// 工具函数：判断是否解析完毕
function isEnd(context: ParserContext, ancestors: ElementNode[]): boolean {
  const s = context.source;
  // 1. 遇到结束标签（且是祖先元素的）
  if (s.startsWith("</")) {
    for (let i = ancestors.length - 1; i >= 0; i--) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        return true;
      }
    }
  }

  // 2. source 耗尽
  return !s;
}

// 工具函数：判断剩余模板是否以指定的结束标签开头
function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    source.startsWith("</") &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase()
  );
}

// parse() 是入口，创建上下文后调用 parseChildren() 解析所有子节点
export function parse(template: string): RootNode {
  const context = createParserContext(template);

  return {
    type: NodeTypes.ROOT,
    children: parseChildren(context, []),
    helpers: new Set(),
  };
}

// 循环判断当前字符，分发到不同解析器
function parseChildren(
  context: ParserContext,
  ancestors: ElementNode[] // 祖先栈，用于判断结束标签
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = [];

  while (!isEnd(context, ancestors)) {
    const s = context.source;
    let node: TemplateChildNode | undefined;

    if (s.startsWith("{{")) {
      // 插值表达式
      node = parseInterpolation(context);
    } else if (s[0] === "<") {
      if (s[1] === "/") {
        // 这是结束标签，不应该在这里处理，跳出循环
        break;
      } else if (/[a-z]/i.test(s[1])) {
        // 元素开始标签
        node = parseElement(context, ancestors);
      }
    }

    // 都不是，当作文本处理
    if (!node) {
      node = parseText(context);
    }

    nodes.push(node);
  }

  return nodes;
}

/**
 * 解析插值
 *
 * 示例：
 * 输入: "{{ msg }}"
 * 输出: { type: INTERPOLATION, content: { content: "msg", isStatic: false } }
 */
function parseInterpolation(context: ParserContext): InterpolationNode {
  const openDelimiter = "{{";
  const closeDelimiter = "}}";

  // 找到结束位置
  const closeIndex = context.source.indexOf(
    closeDelimiter,
    openDelimiter.length
  );

  if (closeIndex === -1) {
    console.error("插值缺少结束标签 }}");
  }

  // 跳过 {{
  advanceBy(context, openDelimiter.length);

  // 取出中间内容
  const rawContentLength = closeIndex - openDelimiter.length;
  const rawContent = context.source.slice(0, rawContentLength);
  const content = rawContent.trim(); // 去除空格

  // 跳过内容和 }}
  advanceBy(context, rawContentLength + closeDelimiter.length);

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content,
      isStatic: false,
    },
  };
}

/**
 * 解析文本
 *
 * 示例：
 * 输入: "hello {{ msg }}"
 * 第一次 parseText: "hello " → 遇到 {{ 停止
 */
function parseText(context: ParserContext): TextNode {
  // 文本结束标识
  const endTokens = ["<", "{{"];
  let endIndex = context.source.length;

  // 找到文本结束位置
  for (const token of endTokens) {
    const index = context.source.indexOf(token);
    if (index !== -1 && index < endIndex) {
      endIndex = index;
    }
  }

  // 截取文本内容
  const content = context.source.slice(0, endIndex);

  // 推进游标
  advanceBy(context, content.length);

  return {
    type: NodeTypes.TEXT,
    content,
  };
}

/**
 * 解析元素
 * 思路：分三步走 - 开始标签 → 子节点 → 结束标签
 */
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[]
): ElementNode {
  // 1. 解析开始标签
  const element = parseTag(context, TagType.Start);

  // 自闭合标签直接返回
  if (element.isSelfClosing) {
    return element;
  }

  // 2.递归解析子节点
  ancestors.push(element);
  element.children = parseChildren(context, ancestors);
  ancestors.pop();

  // 3. 解析结束标签
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End);
  } else {
    console.error(`缺少结束标签: </${element.tag}>`);
  }

  return element;
}

const enum TagType {
  Start,
  End,
}

/**
 * 解析标签
 * 思路：用正则匹配标签名，然后解析属性
 */
function parseTag(context: ParserContext, type: TagType): ElementNode {
  // 匹配标签名: <div 或 </div
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source);
  const tag = match[1];

  // 跳过 <tag
  advanceBy(context, match[0].length);
  advanceSpaces(context);

  // 解析属性（暂时返回空数组，下一步实现）
  const props = parseAttributes(context);

  // 判断是否自闭合 />
  const isSelfClosing = context.source.startsWith("/>");

  // 跳过 > 或 />
  advanceBy(context, isSelfClosing ? 2 : 1);

  return {
    type: NodeTypes.ELEMENT,
    tag,
    props,
    children: [],
    isSelfClosing,
  };
}

/**
 * 解析属性
 * 思路：循环解析直到遇到 > 或 />
 */
function parseAttributes(context: ParserContext): ElementPropNode[] {
  const props: ElementPropNode[] = [];

  // 循环直到遇到 > 或 />
  while (
    context.source.length > 0 &&
    !context.source.startsWith(">") &&
    !context.source.startsWith("/>")
  ) {
    const attr = parseAttribute(context);
    props.push(attr);
    advanceSpaces(context);
  }

  return props;
}

function parseAttribute(context: ParserContext): ElementPropNode {
  // 匹配属性名 span、div、v-xxx、:xxx、@xxx、#xxx
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!;
  const name = match[0];

  advanceBy(context, name.length);
  advanceSpaces(context);

  // 解析 = 和属性值
  let value: TextNode | undefined;
  if (context.source.startsWith("=")) {
    advanceBy(context, 1); // 跳过 =
    advanceSpaces(context);
    value = parseAttributeValue(context);
  }

  // 判断是否是指令
  if (/^(v-|:|@|#)/.test(name)) {
    return parseDirective(name, value);
  }

  // 普通属性
  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value,
  };
}

function parseAttributeValue(context: ParserContext): TextNode {
  // 取引号（支持单引号和双引号
  const quote = context.source[0];
  const isQuoted = quote === "'" || quote === '"';

  let content: string;

  if (isQuoted) {
    // id="test"
    advanceBy(context, 1); // 跳过开始引号
    const endIndex = context.source.indexOf(quote);
    content = context.source.slice(0, endIndex);
    advanceBy(context, content.length + 1); // 跳过内容和结束引号
  } else {
    // 无引号，取到空格
    // disabled
    const match = /^[^\t\r\n\f >]+/.exec(context.source)!;
    content = match[0];
    advanceBy(context, content.length);
  }

  return {
    type: NodeTypes.TEXT,
    content,
  };
}

function parseDirective(
  rawName: string,
  value: TextNode | undefined
): DirectiveNode {
  let name: string;
  let arg: SimpleExpressionNode | undefined;
  let modifiers: string[] = [];

  // 处理简写语法
  if (rawName.startsWith(":")) {
    // :id → v-bind:id
    name = "bind";
    rawName = rawName.slice(1); // 去掉 :
  } else if (rawName.startsWith("@")) {
    // @click → v-on:click
    name = "on";
    rawName = rawName.slice(1); // 去掉 @
  } else if (rawName.startsWith("#")) {
    // #header -> v-slot:header
    name = "slot";
    rawName = rawName.slice(1); // 去掉 #
  } else {
    // v-bind:id.stop.prevent → bind:id.stop.prevent
    rawName = rawName.slice(2); // 去掉 v-

    // 提取指令名（到 : 或 . 为止）
    const colonIndex = rawName.indexOf(":");
    const dotIndex = rawName.indexOf(".");

    let nameEnd = rawName.length;
    if (colonIndex > -1) nameEnd = Math.min(nameEnd, colonIndex);
    if (dotIndex > -1) nameEnd = Math.min(nameEnd, dotIndex);

    name = rawName.slice(0, nameEnd);
    rawName = rawName.slice(nameEnd);

    // 如果以 : 开头，去掉它，方便后续统一处理
    if (rawName.startsWith(":")) {
      rawName = rawName.slice(1);
    }
  }

  // 提取参数 id.stop.prevent
  if (rawName) {
    // 检测动态参数 [xxx]
    if (rawName.startsWith("[")) {
      const closeIndex = rawName.indexOf("]");
      const argContent = rawName.slice(1, closeIndex); // 去掉 [ ]

      arg = {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: argContent,
        isStatic: false, // 动态参数
      };

      rawName = rawName.slice(closeIndex + 1);
    } else {
      const dotIndex = rawName.indexOf(".");
      const argContent = dotIndex > -1 ? rawName.slice(0, dotIndex) : rawName;

      if (argContent) {
        arg = {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: argContent,
          isStatic: true, // 静态参数，如 :id。动态参数 :[key] 后面再处理
        };
      }

      if (dotIndex > -1) {
        rawName = rawName.slice(dotIndex);
      } else {
        // 无修饰符 其他字符直接截断丢弃
        rawName = "";
      }
    }
  }

  // 提取修饰符 .stop.prevent
  if (rawName.startsWith(".")) {
    modifiers = rawName.slice(1).split(".");
  }

  // 表达式
  let exp: SimpleExpressionNode | undefined;
  if (value) {
    exp = {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: value.content,
      isStatic: false,
    };
  }

  return {
    type: NodeTypes.DIRECTIVE,
    name,
    arg,
    exp,
    modifiers,
  };
}
