import { isFunction } from "@vue/shared";
import { ReactiveEffect } from "./effect";
import { trackRefValue, triggerRefValue } from "./ref";

export function computed(getterOrOption) {
  let onlyGetter = isFunction(getterOrOption);

  let getter;
  let setter;
  if (onlyGetter) {
    getter = getterOrOption;
    setter = () => {};
  } else {
    getter = getterOrOption.get;
    setter = getterOrOption.set;
  }

  return new ComputedRefImpl(getter, setter);
}

export class ComputedRefImpl {
  _value; // 缓存计算后的值
  effect: ReactiveEffect;
  dep;

  constructor(public getter, public setter) {
    // 计算属性相当于一个effect，需要创建ReactiveEffect实例，同时关联dirty属性
    this.effect = new ReactiveEffect(
      () => getter(this._value),
      () => {
        triggerRefValue(this);
      }
    );
  }

  get value() {
    // 当dirty为true时重新计算值并返回
    if (this.effect.dirty) {
      this._value = this.effect.run();
    }

    // 放在该位置是收集，存在缓存数据且依赖数据未变化时的多个effect
    trackRefValue(this);

    return this._value;
  }

  set value(newValue) {
    this.setter(newValue);
  }
}
