import { reactive, effect } from "./reactivity.esm.js";

const state = reactive({ name: "leo", age: 23, flag: true });

effect(() => {
  app.innerHTML = state.name;
  state.name = Math.random();
});

// 问题：防止递归调用

// 思路：使用标志位（_running）标识当前effect是否在运行中，运行中则不运行
