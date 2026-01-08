import { CompoundExpressionNode, NodeTypes } from "../ast";
import { TransformContext } from "../transform";

/**
 * transformText 插件
 * 职责：合并相邻的文本和插值节点
 */
export function transformText(node, context: TransformContext) {
  if (node.type !== NodeTypes.ELEMENT && node.type !== NodeTypes.ROOT) {
    return;
  }

  // 返回退出函数，等子节点处理完再执行
  return () => {
    const children = node.children;
    let currentContainer: CompoundExpressionNode | undefined;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      if (isText(child)) {
        // 查找下一个连续的文本节点
        for (let j = i + 1; j < children.length; j++) {
          const next = children[j];

          if (isText(next)) {
            // 创建复合表达式容器
            if (!currentContainer) {
              currentContainer = (children[i] as CompoundExpressionNode) = {
                type: NodeTypes.COMPOUND_EXPRESSION,
                children: [child],
              };
            }

            // 添加 + 连接符和下一个节点
            currentContainer.children.push(" + ", next);

            // 删除已合并的节点
            children.splice(j, 1);
            // 为了下一次循环 j++ 定位到下个元素
            j--;
          } else {
            // 不是文本节点，停止合并
            currentContainer = undefined;
            break;
          }
        }
      }
    }
  };
}

function isText(node): boolean {
  return node.type === NodeTypes.TEXT || node.type === NodeTypes.INTERPOLATION;
}
