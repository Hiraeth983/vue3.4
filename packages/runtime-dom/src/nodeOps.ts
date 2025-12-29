// 对节点元素的增删改查
export const nodeOps = {
  // anchor 是锚点/参考节点，用于指定新节点插入的位置，插入到 anchor 前
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null);
  },

  remove: (child) => {
    const parent = child.parentNode;
    if (parent) {
      parent.removeChild(child);
    }
  },

  createElement: (type) => {
    return document.createElement(type);
  },

  createText: (text) => document.createTextNode(text),

  createComment: (text) => document.createComment(text),

  // 仅对文本节点生效，createText
  setText: (node, text) => {
    node.nodeValue = text;
  },

  // 清空所有子节点，设为纯文本
  setElementText: (el, text) => {
    el.textContent = text;
  },

  parentNode: (node) => node.parentNode,

  nextSibling: (node) => node.nextSibling,

  querySelector: (selector) => document.querySelector(selector),
};
