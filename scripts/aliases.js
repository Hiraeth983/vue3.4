import { fileURLToPath } from "node:url";
import path from "node:path";

const resolveEntryForPkg = (/** @type {string} */ p) =>
  path.resolve(
    fileURLToPath(import.meta.url),
    `../../packages/${p}/src/index.ts`
  );

/** @type {Record<string, string>} */
const entries = {
  "@vue/shared": resolveEntryForPkg("shared"),
  "@vue/reactivity": resolveEntryForPkg("reactivity"),
  "@vue/runtime-core": resolveEntryForPkg("runtime-core"),
  "@vue/runtime-dom": resolveEntryForPkg("runtime-dom"),
  "@vue/compiler-core": resolveEntryForPkg("compiler-core"),
};

export { entries };
