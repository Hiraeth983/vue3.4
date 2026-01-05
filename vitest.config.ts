import { defineConfig } from "vitest/config";
import { entries } from "./scripts/aliases.js";

export default defineConfig({
  test: {
    // 全局 API，不用每次 import { describe, it, expect }
    globals: true,
    // 测试环境
    environment: "node",
    // 测试文件匹配规则
    include: ["packages/**/__tests__/**/*.spec.ts"],
  },
  resolve: {
    // 对应 tsconfig 的 paths 配置
    alias: entries,
  },
});
