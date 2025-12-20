import { reactive, effect } from "./reactivity.esm.js";

const state = reactive({ name: "leo", age: 23, flag: true });

effect(() => {
  console.log('runner')
  app.innerHTML = state.flag ? state.name : state.age;
});

setTimeout(() => {
  state.flag = false;

  setTimeout(() => {
    console.log('修改后，不应该重复执行effect了')
    state.name = "handsome leo";
  }, 1000);
}, 1000);

// 分支切换依赖问题
// 问题：当执行effect函数时，会将`flag`和`name`进行依赖收集，随后外层定时器触发，`flag`发生变化触发effect执行，同时对`age`收集依赖，此时三个变量都存在对应的依赖；随后内层定时器触发，`name`发生变化触发对应的effect执行，但此时页面并未渲染`name`相关的dom，也就是说此次effect等于无效执行，试问如何解决这个问题？

// 思路：每次执行effect之前，将上一次的effect对应的依赖清空 effect.deps（diff清除），并在effect执行之后清除多余的deps

/**
 * _trackId: 记录effect的执行次数，防止单一变量在同一次effect执行中多次收集依赖
 */
