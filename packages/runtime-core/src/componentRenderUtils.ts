export function shouldUpdateComponent(n1, n2) {
  const prevProps = n1.props;
  const nextProps = n2.props;

  // 引用相同 不需要更新
  if (prevProps === nextProps) return false;

  // 旧的没有 props，看新的有没有
  if (!prevProps) return !!nextProps;

  // 新的没有 props，旧的有，需要更新
  if (!nextProps) return true;

  // 都有 props，逐个比较
  return hasPropsChanged(prevProps, nextProps);
}

// 判断 props 是否变化
function hasPropsChanged(prevProps, nextProps) {
  const nextKeys = Object.keys(nextProps);
  // 数量不同 则不同
  if (Object.keys(prevProps).length !== nextKeys.length) return true;

  // 逐个对比值
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    if (prevProps[key] !== nextProps[key]) {
      return true;
    }
  }

  return false;
}
