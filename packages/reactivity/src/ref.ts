import { activeEffect, trackEffect, triggerEffects } from "./effect";
import { toReactive } from "./reactive";
import { createDep, Dep } from "./reactiveEffect";

export function ref(value) {
  return createRef(value);
}

function createRef(value) {
  return new RefImpl(value);
}

class RefImpl {
  __v_isRef = true;
  _value; // 代理后的值
  dep: Dep; // 收集对应的effect

  constructor(public rawValue) {
    this._value = toReactive(rawValue);
  }

  // 类的访问器属性
  get value() {
    trackRefValue(this);
    return this._value;
  }

  set value(newValue) {
    if (newValue !== this.rawValue) {
      this.rawValue = newValue;
      this._value = toReactive(newValue);
      triggerRefValue(this);
    }
  }
}

function trackRefValue(ref: RefImpl) {
  if (activeEffect) {
    if (!ref.dep) {
      ref.dep = createDep(() => (ref.dep = undefined), "ref");
    }
    trackEffect(activeEffect, ref.dep);
  }
}

function triggerRefValue(ref: RefImpl) {
  const dep = ref.dep;
  if (dep) {
    triggerEffects(dep);
  }
}
