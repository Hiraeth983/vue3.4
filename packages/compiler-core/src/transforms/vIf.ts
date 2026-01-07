import {
  ConditionalExpression,
  ElementNode,
  IfBranchNode,
  IfNode,
  NodeTypes,
  TemplateChildNode,
} from "../ast";
import {
  CREATE_COMMENT,
  findDir,
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
 */
export function transformIf(
  node: TemplateChildNode,
  context: TransformContext
) {
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
  const branch = createIfBranch(node, ifDir.exp);
  ifNode.branches.push(branch);

  // 替换当前节点
  context.replaceNode(ifNode);

  // 查找后续的 v-else-if / v-else
  const parent = context.parent as ElementNode;
  if (parent && parent.children) {
    let i = context.childIndex + 1;

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
        ifNode.branches.push(createIfBranch(sibling, elseIfDir.exp));
        parent.children.splice(i, 1);
      } else if (elseDir) {
        // v-else 分支 无条件
        ifNode.branches.push(createIfBranch(sibling, undefined));
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

function createIfBranch(node: ElementNode, condition: any): IfBranchNode {
  // 从 props 中移除 v-if/v-else-if/v-else 指令
  removeDir(node, ["if", "else-if", "else"]);

  return {
    type: NodeTypes.IF_BRANCH,
    condition,
    children: [node],
  };
}

/**
 * 递归生成条件表达式
 * branches[0] ? branch0 : branches[1] ? branch1 : branch2
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
      consequent: getBranchCodegenNode(branch, context),
      alternate:
        index < branches.length - 1
          ? createCodegenNodeForBranches(branches, context, index + 1)
          : // index === branches.length - 1 即有条件指令为最后节点，没有 v-else，用注释节点占位
            createCommentVNode(context),
    } as ConditionalExpression;
  } else {
    // v-else：直接返回
    return getBranchCodegenNode(branch, context);
  }
}

function getBranchCodegenNode(branch: IfBranchNode, context: TransformContext) {
  const child = branch.children[0];
  if (child.type === NodeTypes.ELEMENT) {
    return child.codegenNode;
  }
  return child;
}

function createCommentVNode(context: TransformContext) {
  context.helper(CREATE_COMMENT);
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    callee: CREATE_COMMENT,
    arguments: [],
  };
}
