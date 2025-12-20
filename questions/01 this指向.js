const person = {
  name: "leo",
  get alias() {
    return this.name + "666";
  },
};

const proxyPerson = new Proxy(person, {
  get(target, key, receiver) {
    console.log('key', key)
    // return target[key]; // 存在属性访问器的情况下 this指向直接指向未代理对象target，导致依赖收集不全，就会直接导致name发生变化时无法触发alias刷新
    return Reflect.get(target, key, receiver); // 此用法下 this指向代理对象
  },
});

console.log(proxyPerson.alias)
