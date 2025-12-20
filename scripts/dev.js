import minimist from "minimist";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import esbuild from "esbuild";

// 获取命令行参数
const argv = minimist(process.argv.slice(2));
// esm 下获取 cjs 的相关参数
const __filename = fileURLToPath(import.meta.url); // 获取当前文件的绝对路径
const __dirname = dirname(__filename); // 获取当前文件所在目录的绝对路径
const require = createRequire(import.meta.url); // 创建 require 函数
// 解析参数
const target = argv._[0] || "reactivity"; // 打包目标目录
const format = argv.f || "iife"; // 打包格式

// 打包入口文件 根据命令行提供的参数进行解析
const entry = resolve(__dirname, `../packages/${target}/src/index.ts`);
const pkg = require(resolve(__dirname, `../packages/${target}/package.json`));

// 根据需要进行打包
esbuild.context({
  entryPoints: [entry], // 入口
  outfile: resolve(__dirname, `../packages/${target}/dist/${target}.${format}.js`), // 出口
  bundle: true, // reactivity --> shared 依赖会打包到一起
  platform: "browser", // 打包平台 browser 浏览器环境
  sourcemap: true, // 生成 sourcemap
  format, // 打包格式 cjs esm iife
  globalName: pkg.buildOptions?.name // var VueReactivity = (() => { ... })()
}).then((ctx) => {
  console.log("start dev");

  return ctx.watch(); // 监控入口文件并持续进行打包
});
