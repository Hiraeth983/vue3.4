import { ElementNode, NodeTypes, TemplateChildNode } from "../ast";
import { findDir, removeDir, TransformContext } from "../transform";

/**
 * transformModel - 双向绑定
 *
 * v-model 是语法糖，展开为：
 * <input v-model="msg">
 * ↓
 * <input :value="msg" @input="msg = $event.target.value">
 *
 * 对于组件：
 * <Comp v-model="msg">
 * ↓
 * <Comp :modelValue="msg" @update:modelValue="msg = $event">
 */
export function transformModel(
  node: TemplateChildNode,
  context: TransformContext
) {
  if (node.type !== NodeTypes.ELEMENT) return;

  const element = node as ElementNode;
  const modelDir = findDir(element, "model");
  if (!modelDir) return;

  // 获取绑定的表达式
  const exp = modelDir.exp?.content;
  if (!exp) return;

  // 判断是原生元素还是组件 简易实现
  const isComponent = /^[A-Z]/.test(element.tag);
  const tag = element.tag;

  // 从 props 中移除 v-model
  removeDir(element, ["model"]);

  if (isComponent) {
    // 组件：modelValue + update:modelValue
    // 获取参数 只适用于组件 v-model:title
    const arg = modelDir.arg?.content || "modelValue";

    element.props.push(
      // :modelValue="exp"
      {
        type: NodeTypes.DIRECTIVE,
        name: "bind",
        arg: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: arg,
          isStatic: true,
        },
        exp: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: exp,
          isStatic: false,
        },
        modifiers: [],
      },
      // @update:modelValue="val => msg = val"
      {
        type: NodeTypes.DIRECTIVE,
        name: "on",
        arg: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `update:${arg}`,
          isStatic: true,
        },
        exp: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `$event => (${exp} = $event)`,
          isStatic: true,
        },
        modifiers: [],
      }
    );
  } else {
    // 原生元素：根据类型处理
    const { prop, event } = getModelPropAndEvent(tag);

    element.props.push(
      // :value="msg" 或 :checked="msg"
      {
        type: NodeTypes.DIRECTIVE,
        name: "bind",
        arg: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: prop,
          isStatic: true,
        },
        exp: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: exp,
          isStatic: false,
        },
        modifiers: [],
      },
      // @input="msg = $event.target.value"
      {
        type: NodeTypes.DIRECTIVE,
        name: "on",
        arg: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: event,
          isStatic: true,
        },
        exp: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `$event => (${exp} = $event.target.${prop})`,
          isStatic: false,
        },
        modifiers: [],
      }
    );
  }
}

function getModelPropAndEvent(tag: string) {
  if (tag === "input" || tag === "textarea") {
    return { prop: "value", event: "input" };
  }
  if (tag === "select") {
    return { prop: "value", event: "change" };
  }
  // checkbox/radio
  return { prop: "checked", event: "change" };
}
