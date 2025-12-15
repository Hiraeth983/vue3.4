import { ComputedRefImpl } from "./computed";
import { ReactiveFlags } from "./constants";
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

export function trackRefValue(ref: RefImpl | ComputedRefImpl) {
  if (activeEffect) {
    if (!ref.dep) {
      ref.dep = createDep(() => (ref.dep = undefined), "ref");
    }
    trackEffect(activeEffect, ref.dep);
  }
}

export function triggerRefValue(ref: RefImpl | ComputedRefImpl) {
  const dep = ref.dep;
  if (dep) {
    triggerEffects(dep);
  }
}

export function toRef(obj, key) {
  return new ObjectRefImpl(obj, key);
}

export function toRefs(obj) {
  const result = {};
  for (const key in obj) {
    result[key] = toRef(obj, key);
  }
  return result;
}

class ObjectRefImpl {
  __v_isRef = true;

  constructor(public _object, public _key) {}

  get value() {
    return this._object[this._key];
  }

  set value(newValue) {
    this._object[this._key] = newValue;
  }
}

export function isRef(obj) {
  return obj ? obj[ReactiveFlags.IS_REF] === true : false;
}

export function proxyRefs(objectWithRefs) {
  return new Proxy(objectWithRefs, {
    get(target, key, receiver) {
      const r = Reflect.get(target, key, receiver);
      return isRef(r) ? r.value : r;
    },
    set(target, key, newValue, receiver) {
      const oldValue = target[key];

      if (isRef(oldValue)) {
        oldValue.value = newValue;
        return true;
      } else {
        return Reflect.set(target, key, newValue, receiver);
      }
    },
  });
}
