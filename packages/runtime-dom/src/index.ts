import { nodeOps } from "./nodeOps";
import patchProp from "./patchProp";
import { createRenderer } from "@vue/runtime-core";

const renderOptions = Object.assign({ patchProp }, nodeOps);

// 采用 DOM API 进行渲染
export const render = (vnode, container) => {
  return createRenderer(renderOptions).render(vnode, container);
};

export { renderOptions };
export * from "@vue/runtime-core";
