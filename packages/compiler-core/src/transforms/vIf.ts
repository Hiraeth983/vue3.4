import {
  CodegenNode,
  ConditionalExpression,
  ElementNode,
  ForNode,
  IfBranchNode,
  IfNode,
  NodeTypes,
  Property,
  TemplateChildNode,
  VNodeCall,
} from "../ast";
import {
  CREATE_COMMENT,
  CREATE_ELEMENT_BLOCK,
  findDir,
  OPEN_BLOCK,
  removeDir,
  TransformContext,
} from "../transform";

/**
 * transformIf - 条件渲染
 * 把 v-if/else-if/else 相邻节点收集成一个 IfNode
 *
 * 输入 AST:
 *   <div v-if="show">A</div>
 *   <div v-else-if="other">B</div>
 *   <div v-else>C</div>
 *
 * 输出结构:
 *   IfNode {
 *     branches: [
 *       { condition: show, children: [ElementNode A] },
 *       { condition: other, children: [ElementNode B] },
 *       { condition: undefined, children: [ElementNode C] }
 *     ]
 *   }
 *
 * 生成代码:
 *   show ? createVNode("div", null, "A")
 *        : other ? createVNode("div", null, "B")
 *                : createVNode("div", null, "C")
 *
 * 生成代码（Block 模式）:
 *   show ? (openBlock(), createElementBlock("div", { key: 0 }, "A"))
 *        : other ? (openBlock(), createElementBlock("div", { key: 1 }, "B"))
 *                : (openBlock(), createElementBlock("div", { key: 2 }, "C"))
 */
export function transformIf(
  node: TemplateChildNode,
  context: TransformContext
) {
  // 如果当前节点已被其他 transform 替换，跳过
  if (context.currentNode !== node) return;

  // 只处理带 v-if 的元素
  if (node.type !== NodeTypes.ELEMENT) return;

  const ifDir = findDir(node, "if");
  if (!ifDir) return;

  // 创建 IfNode
  const ifNode: IfNode = {
    type: NodeTypes.IF,
    branches: [],
  };

  // 第一个分支：v-if
  const branch = createIfBranch(node, ifDir.exp, 0);
  ifNode.branches.push(branch);

  // 替换当前节点
  context.replaceNode(ifNode);

  // 查找后续的 v-else-if / v-else
  const parent = context.parent as ElementNode;
  if (parent && parent.children) {
    let i = context.childIndex + 1;
    let keyIndex = 1;

    while (i < parent.children.length) {
      const sibling = parent.children[i] as ElementNode;

      if (sibling.type !== NodeTypes.ELEMENT) {
        // 跳过文本/空白
        i++;
        continue;
      }

      const elseIfDir = findDir(sibling, "else-if");
      const elseDir = findDir(sibling, "else");

      if (elseIfDir) {
        // v-else-if 分支
        ifNode.branches.push(
          createIfBranch(sibling, elseIfDir.exp, keyIndex++)
        );
        parent.children.splice(i, 1);
      } else if (elseDir) {
        // v-else 分支 无条件
        ifNode.branches.push(createIfBranch(sibling, undefined, keyIndex++));
        parent.children.splice(i, 1);
        break; // v-else 必须是最后一个
      } else {
        break;
      }
    }
  }

  // 返回退出函数，生成 codegenNode
  return () => {
    ifNode.codegenNode = createCodegenNodeForBranches(ifNode.branches, context);
  };
}

/**
 * 创建 if 分支，带 key 用于 Block 切换
 */
function createIfBranch(
  node: ElementNode,
  condition: any,
  key: number
): IfBranchNode {
  // 从 props 中移除 v-if/v-else-if/v-else 指令
  removeDir(node, ["if", "else-if", "else"]);

  return {
    type: NodeTypes.IF_BRANCH,
    condition,
    children: [node],
    // 存储 key，用于后续生成 Block
    userKey: {
      type: NodeTypes.ATTRIBUTE,
      name: "key",
      value: {
        type: NodeTypes.TEXT,
        content: String(key),
      },
    },
  };
}

/**
 * 递归生成条件表达式
 * branches[0] ? branch0 : branches[1] ? branch1 : branch2
 *
 * branches[0] ? block0 : branches[1] ? block1 : block2
 */
function createCodegenNodeForBranches(
  branches: IfBranchNode[],
  context: TransformContext,
  index = 0
): any {
  const branch = branches[index];

  if (branch.condition) {
    // 有条件：生成三元表达式
    return {
      type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
      test: branch.condition,
      consequent: getBranchCodegenNode(branch, index, context),
      alternate:
        index < branches.length - 1
          ? createCodegenNodeForBranches(branches, context, index + 1)
          : // index === branches.length - 1 即有条件指令为最后节点，没有 v-else，用注释节点占位
            createCommentVNode(context),
    } as ConditionalExpression;
  } else {
    // v-else：直接返回
    return getBranchCodegenNode(branch, index, context);
  }
}

/**
 * 获取分支的 codegenNode，并标记为 Block
 */
function getBranchCodegenNode(
  branch: IfBranchNode,
  index: number,
  context: TransformContext
): CodegenNode {
  const child = branch.children[0];

  // 添加 Block 所需的 helper
  context.helper(OPEN_BLOCK);
  context.helper(CREATE_ELEMENT_BLOCK);

  // 处理 ElementNode
  if (child.type === NodeTypes.ELEMENT) {
    const elementCodegen = (child as ElementNode).codegenNode;

    if (elementCodegen && elementCodegen.type === NodeTypes.VNODE_CALL) {
      // 标记为 Block
      elementCodegen.isBlock = true;

      // 注入 key 到 props（用于 v-if 分支切换时的高效替换）
      injectBranchKey(elementCodegen, index);

      return elementCodegen;
    }
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

/**
 * 注入分支 key 到 props
 */
function injectBranchKey(vnode: VNodeCall, key: number) {
  const keyProp: Property = {
    type: NodeTypes.JS_PROPERTY,
    key: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: "key",
      isStatic: true,
    },
    value: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: String(key),
      isStatic: true,
    },
  };

  if (vnode.props) {
    // 已有 props，添加 key
    vnode.props.properties.unshift(keyProp);
  } else {
    // 没有 props，创建
    vnode.props = {
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [keyProp],
    };
  }
}

function createCommentVNode(context: TransformContext) {
  context.helper(CREATE_COMMENT);
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    callee: CREATE_COMMENT,
    arguments: [],
  };
}
