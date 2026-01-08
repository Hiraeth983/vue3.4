import {
  ArrayExpression,
  CodegenNode,
  DirectiveNode,
  ElementNode,
  getChildCodegenNode,
  NodeTypes,
  RootNode,
  TemplateChildNode,
} from "./ast";

/**
 * Transform 阶段概述
 * 核心职责：把模板 AST 转换成适合代码生成的 JS AST
 * 
 * 模板 AST                        JS AST (codegenNode)
    ─────────                       ──────────────────
    ElementNode {                   {
      tag: 'div',          →          type: VNODE_CALL,
      props: [...],                   tag: '"div"',
      children: [...]                 props: {...},
    }                                }
 */

// 转换插件类型
type NodeTransform = (
  node: RootNode | TemplateChildNode,
  context: TransformContext
) => void | (() => void); // 可以返回退出函数

// 转换上下文
export interface TransformContext {
  root: RootNode; // 根节点
  parent: RootNode | TemplateChildNode | null; // 父节点
  currentNode: RootNode | TemplateChildNode | null; // 当前节点
  childIndex: number; // 当前节点在父节点中的索引
  helpers: Set<symbol>; // 收集用到的运行时函数
  nodeTransforms: NodeTransform[]; // 转换插件列表
  scopes: Set<string>[]; // 作用域栈，存储局部变量名

  // 方法
  helper(name: symbol): symbol; // 添加 helper
  replaceNode(node: TemplateChildNode): void; // 替换当前节点
  removeNode(): void; // 删除当前节点
  addIdentifiers(ids: string[]): void;
  removeIdentifiers(ids: string[]): void;
}

// 运行时帮助函数符号
export const CREATE_VNODE = Symbol("createVNode");
export const TO_DISPLAY_STRING = Symbol("toDisplayString");
export const FRAGMENT = Symbol("Fragment");
export const RENDER_LIST = Symbol("renderList");
export const CREATE_COMMENT = Symbol("createComment");
export const WITH_DIRECTIVES = Symbol("withDirectives");
export const V_SHOW = Symbol("vShow");
export const V_MODEL_TEXT = Symbol("vModelText");

// 符号到函数名的映射
export const helperNameMap: Record<symbol, string> = {
  [CREATE_VNODE]: "createVNode",
  [TO_DISPLAY_STRING]: "toDisplayString",
  [FRAGMENT]: "Fragment",
  [RENDER_LIST]: "renderList",
  [CREATE_COMMENT]: "createComment",
  [WITH_DIRECTIVES]: "withDirectives",
  [V_SHOW]: "vShow",
  [V_MODEL_TEXT]: "vModelText",
};

function createTransformContext(
  root: RootNode,
  options: { nodeTransforms?: NodeTransform[] } = {}
): TransformContext {
  const context: TransformContext = {
    root,
    parent: null,
    currentNode: null,
    childIndex: 0,
    helpers: new Set(),
    nodeTransforms: options.nodeTransforms || [],
    scopes: [new Set()],

    helper(name) {
      context.helpers.add(name);
      return name;
    },

    replaceNode(node) {
      if (context.parent) {
        const children = (context.parent as ElementNode).children;
        children[context.childIndex] = node;
        context.currentNode = node;
      }
    },

    removeNode() {
      if (context.parent) {
        const children = (context.parent as ElementNode).children;
        children.splice(context.childIndex, 1);
        context.currentNode = null;
      }
    },

    addIdentifiers(ids: string[]) {
      ids.forEach((id) => context.scopes[context.scopes.length - 1].add(id));
    },

    removeIdentifiers(ids: string[]) {
      ids.forEach((id) => context.scopes[context.scopes.length - 1].delete(id));
    },
  };

  return context;
}

/**
 * 遍历函数
 * 核心遍历逻辑：深度优先 + 退出回调
 */
export function transform(
  root: RootNode,
  options: { nodeTransforms?: NodeTransform[] } = {}
) {
  const context = createTransformContext(root, options);

  // 遍历 AST
  traverseNode(root, context);

  // 创建根节点的 codegenNode
  createRootCodegen(root, context);

  // 把收集的 helpers 挂到 root 上
  root.helpers = context.helpers;
}

function traverseNode(
  node: RootNode | TemplateChildNode,
  context: TransformContext
) {
  context.currentNode = node;

  const { nodeTransforms } = context;
  const exitFns: (() => void)[] = [];

  // 1. 进入阶段：执行所有转换插件，收集退出函数
  for (const transform of nodeTransforms) {
    const onExit = transform(node, context);
    if (onExit) {
      exitFns.push(onExit);
    }

    // 节点被删除情况
    if (!context.currentNode) {
      return;
    }
  }

  // 2. 递归处理子节点
  const currentNode = context.currentNode!; // 用当前节点，可能已被替换
  switch (currentNode.type) {
    case NodeTypes.ROOT:
    case NodeTypes.ELEMENT:
      traverseChildren(currentNode, context);
      break;
    case NodeTypes.INTERPOLATION:
      // 插值表达式需要 toDisplayString
      context.helper(TO_DISPLAY_STRING);
      break;
    case NodeTypes.IF:
      // 遍历每个分支的 children
      for (const branch of currentNode.branches) {
        for (let i = 0; i < branch.children.length; i++) {
          context.parent = branch;
          context.childIndex = i;
          traverseNode(branch.children[i], context);
        }
      }
      break;
    case NodeTypes.FOR:
      // 遍历 v-for 的 children
      for (let i = 0; i < currentNode.children.length; i++) {
        context.parent = currentNode;
        context.childIndex = i;
        traverseNode(currentNode.children[i], context);
      }
      break;
  }

  // 3. 退出阶段：倒序执行退出函数
  // 此时子节点已经处理完毕
  context.currentNode = node; // 恢复 currentNode（可能被子节点处理改掉了）
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}

function traverseChildren(
  parent: RootNode | ElementNode,
  context: TransformContext
) {
  const children = parent.children;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    context.parent = parent;
    context.childIndex = i;
    traverseNode(child, context);
  }
}

function createRootCodegen(root: RootNode, context: TransformContext) {
  const { children } = root;

  if (children.length === 1) {
    const child = children[0];
    // 单个元素节点，直接用它的 codegenNode
    if (child.type === NodeTypes.ELEMENT && child.codegenNode) {
      root.codegenNode = child.codegenNode;
    } else {
      root.codegenNode = getChildCodegenNode(child);
    }
  } else if (children.length > 1) {
    // 多个根节点，需要用 Fragment 包裹
    context.helper(CREATE_VNODE);
    root.codegenNode = {
      type: NodeTypes.VNODE_CALL,
      tag: context.helper(FRAGMENT),
      props: undefined,
      children: {
        type: NodeTypes.JS_ARRAY_EXPRESSION,
        elements: children.map(getChildCodegenNode),
      } as ArrayExpression,
    };
  }
}

/**
 * 查询 node 上指定 name 的 DirectiveNode
 */
export function findDir(node: ElementNode, name: string) {
  return node.props.find(
    (prop) => prop.type === NodeTypes.DIRECTIVE && prop.name === name
  ) as any;
}

/**
 * 移除 node 上指定 names 的 DirectiveNode
 */
export function removeDir(node: ElementNode, names: string[]) {
  node.props = node.props.filter(
    (prop) => prop.type !== NodeTypes.DIRECTIVE || !names.includes(prop.name)
  );
}

/**
 * 检查标识符是否在作用域中
 */
export function isInScope(context: TransformContext, name: string): boolean {
  return context.scopes.some((scope) => scope.has(name));
}
