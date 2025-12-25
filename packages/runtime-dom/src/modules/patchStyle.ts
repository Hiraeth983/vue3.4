export default function patchStyle(el, prevValue, nextValue) {
  const style = el.style;

  // 支持字符串形式 { style: "background: #e3f2fd; padding: 10px;" }
  if (typeof nextValue === "string") {
    style.cssText = nextValue;
    return;
  }

  // 对象形式 样式
  for (const key in nextValue) {
    style[key] = nextValue[key];
  }

  // 处理旧值
  if (prevValue) {
    for (const key in prevValue) {
      if (nextValue && nextValue[key] === null) {
        style[key] = null;
      }
    }
  }
}
