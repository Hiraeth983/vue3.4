export default function patchEvent(el, name, handler) {
  // vue_event_invoker
  const invokers = el._vei || (el._vei = {});
  const eventName = name.slice(2).toLowerCase();

  const existingInvoker = invokers[name];

  // 先前存在当前类型事件，且现在也存在
  if (existingInvoker && handler) {
    // 事件换绑
    return (existingInvoker.handler = handler);
  }

  // 先前不存在当前类型事件，但现在存在
  if (handler) {
    const invoker = (invokers[name] = createInvoker(handler));
    return el.addEventListener(eventName, invoker);
  }

  // 先前存在当前类型事件，但现在不存在
  if (existingInvoker) {
    el.removeEventListener(eventName, existingInvoker);
    invokers[name] = undefined;
  }
}

function createInvoker(handler) {
  const invoker = (e) => invoker.handler(e);
  invoker.handler = handler; // 修改invoker的handler属性，可以修改对应的调用函数
  return invoker;
}
