import { reactive, effect } from "reactivity.esm.js";

const state = reactive({ name: "leo", age: 23 });

effect(() => {
  console.log(state.name); // f1

  effect(() => {
    console.log(state.name); // f2
  });

  console.log(state.age); // f1
});

// 问题：嵌套的effect会导致前一次的activeEffect被下一次的activeEffect覆盖掉，可能导致外层的effect中的某些对象属性未能完整收集依赖

// lastEffect的作用：在嵌套effect中记录上次的activeEffect，让函数中每个访问到的代理对象属性都能正确收集依赖
