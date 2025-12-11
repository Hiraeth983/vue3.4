import { reactive, effect } from "./reactivity.esm.js";

const state = reactive({ name: "leo", age: 23, address: { province: "浙江" } });

effect(() => {
  app.innerHTML = state.address.province;
});

setTimeout(() => {
  state.address.province = "江苏";
}, 1000);

// 问题：深层代理

// 思路：在取值的时候判断值是否为对象，若为对象就进行递归代理
