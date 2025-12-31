export const isString = (val: unknown): val is string =>
  typeof val === "string";
export const isNumber = (val: unknown): val is number =>
  typeof val === "number";

export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === "object";

export const isFunction = (val: unknown): val is Function =>
  typeof val === "function";

export const isArray = Array.isArray;

export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === "[object Map]";
export const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === "[object Set]";

export const objectToString = Object.prototype.toString;
export const toTypeString = (value: unknown): string =>
  objectToString.call(value);

export const isPlainObject = (val: unknown): val is object =>
  toTypeString(val) === "[object Object]";

const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key);

export const invokeArrayFns = (fns: Function[], ...arg: any[]) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](...arg);
  }
};

export const isPromise = (val) => val && typeof val.then === "function";

export * from "./shapeFlages";
