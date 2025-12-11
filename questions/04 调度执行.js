import { reactive, effect } from "./reactivity.esm.js";

const state = reactive({ name: "leo", age: 23, flag: true });

const runner = effect(
  () => {
    app.innerHTML = state.flag ? state.name : state.age;
  },
  {
    scheduler: () => {
      console.log("不重新渲染，走自己的逻辑");
      runner();
      console.log(runner.effect);
    },
  }
);

setTimeout(() => {
  state.flag = false;
}, 1000);

// 问题：调度执行

export function effect(fn, options) {
  const _effect = new ReactiveEffect(fn, () => {
    _effect.run();
  });
  _effect.run();

  // 调度执行
  if (options) {
    Object.assign(_effect, options);
  }

  const runner = _effect.run.bind(_effect);
  runner.effect = _effect;

  return runner;
}
