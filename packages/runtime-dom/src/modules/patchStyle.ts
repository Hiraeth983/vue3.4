export default function patchClass(el, prevValue, nextValue) {
  const style = el.style;

  // 新值
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
