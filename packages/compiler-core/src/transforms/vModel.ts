import {
  AttributeNode,
  ElementNode,
  NodeTypes,
  TemplateChildNode,
} from "../ast";
import {
  findDir,
  removeDir,
  TransformContext,
  isComponent as _isComponent,
} from "../transform";

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
  // 如果当前节点已被其他 transform 替换，跳过
  if (context.currentNode !== node) return;

  if (node.type !== NodeTypes.ELEMENT) return;

  const element = node as ElementNode;
  const modelDir = findDir(element, "model");
  if (!modelDir) return;

  // 获取绑定的表达式
  const exp = modelDir.exp?.content;
  if (!exp) return;

  // 判断是原生元素还是组件
  const isComponent = _isComponent(element);

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
          isStatic: false,
        },
        modifiers: [],
      }
    );
  } else {
    // 原生元素：根据类型处理
    const { prop, event } = getModelPropAndEvent(element);

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

/**
 * 如果 type 是动态绑定的（:type="inputType"），编译时无法确定，需要运行时处理。Vue 官方使用 vModelText、vModelCheckbox、vModelRadio 等不同的运行时指令来处理。简易实现可以只支持静态 type
 */
function getModelPropAndEvent(element: ElementNode) {
  const tag = element.tag;

  if (tag === "input") {
    // 查找 type 属性
    const typeAttr = element.props.find(
      (p) => p.type === NodeTypes.ATTRIBUTE && p.name === "type"
    );
    const inputType = (typeAttr as AttributeNode)?.value?.content;

    if (inputType === "checkbox" || inputType === "radio") {
      return { prop: "checked", event: "change" };
    }
    // 默认 text/number 等
    return { prop: "value", event: "input" };
  }

  if (tag === "textarea") {
    return { prop: "value", event: "input" };
  }

  if (tag === "select") {
    return { prop: "value", event: "change" };
  }

  // 其他原生元素默认
  return { prop: "value", event: "input" };
}
