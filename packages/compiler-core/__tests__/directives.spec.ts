import { compile } from "../src/compile";

describe("指令系统测试", () => {
  // ============================================
  // v-if / v-else-if / v-else
  // ============================================
  describe("v-if 条件渲染", () => {
    it("单独 v-if", () => {
      const { code } = compile('<div v-if="show">content</div>');
      // 应该生成三元表达式
      expect(code).toContain("_ctx.show");
      expect(code).toContain("?");
      expect(code).toContain(":");
      // 没有 v-else 时，应该有注释节点占位
      expect(code).toContain("createComment");
    });

    it("v-if + v-else", () => {
      const { code } = compile(`
        <div v-if="show">A</div>
        <div v-else>B</div>
      `);
      expect(code).toContain("_ctx.show");
      expect(code).toContain("?");
      expect(code).toContain(":");
      // 有 v-else 时，不应该有 createComment
      expect(code).not.toContain("createComment");
    });

    it("v-if + v-else-if + v-else", () => {
      const { code } = compile(`
        <div v-if="type === 'A'">A</div>
        <div v-else-if="type === 'B'">B</div>
        <div v-else>C</div>
      `);
      // 嵌套三元表达式
      expect(code).toContain("_ctx.type");
      // 应该有两个三元运算符
      const questionMarks = (code.match(/\?/g) || []).length;
      expect(questionMarks).toBeGreaterThanOrEqual(2);
    });

    it("v-if 带属性和事件", () => {
      const { code } = compile(`
        <button v-if="visible" :class="btnClass" @click="handleClick">
          Click
        </button>
      `);
      expect(code).toContain("_ctx.visible");
      expect(code).toContain("_ctx.btnClass");
      expect(code).toContain("onClick");
      expect(code).toContain("_ctx.handleClick");
    });

    it("v-if 嵌套元素", () => {
      const { code } = compile(`
        <div v-if="show">
          <span>{{ msg }}</span>
        </div>
      `);
      expect(code).toContain("_ctx.show");
      expect(code).toContain("_ctx.msg");
      expect(code).toContain("toDisplayString");
    });
  });

  // ============================================
  // v-for 列表渲染
  // ============================================
  describe("v-for 列表渲染", () => {
    it("基本 v-for (item in list)", () => {
      const { code } = compile('<div v-for="item in list">{{ item }}</div>');
      expect(code).toContain("Fragment");
      expect(code).toContain("renderList");
      expect(code).toContain("_ctx.list");
      // item 是迭代变量，不应该加 _ctx.
      expect(code).toContain("toDisplayString(item)");
      expect(code).not.toContain("_ctx.item");
    });

    it("v-for 带索引 ((item, index) in list)", () => {
      const { code } = compile(
        '<div v-for="(item, index) in list">{{ index }}: {{ item }}</div>'
      );
      expect(code).toContain("renderList");
      expect(code).toContain("_ctx.list");
      // item 和 index 都是迭代变量
      expect(code).not.toContain("_ctx.item");
      expect(code).not.toContain("_ctx.index");
    });

    it("v-for 使用 of 语法", () => {
      const { code } = compile('<div v-for="item of items">{{ item }}</div>');
      expect(code).toContain("renderList");
      expect(code).toContain("_ctx.items");
    });

    it("v-for 访问 item 属性", () => {
      const { code } = compile(
        '<div v-for="user in users">{{ user.name }}</div>'
      );
      expect(code).toContain("renderList");
      expect(code).toContain("_ctx.users");
      // user 不加前缀，但 user.name 整体应该正确
      expect(code).toContain("user.name");
      expect(code).not.toContain("_ctx.user.name");

      expect(code).toMatchSnapshot();
    });

    it("v-for 带 :key", () => {
      const { code } = compile(
        '<div v-for="item in list" :key="item.id">{{ item.name }}</div>'
      );
      expect(code).toContain("renderList");
      expect(code).toContain("item.id");
      expect(code).toContain("item.name");
    });

    it("v-for 嵌套", () => {
      const { code } = compile(`
        <div v-for="row in rows">
          <span v-for="cell in row.cells">{{ cell }}</span>
        </div>
      `);
      expect(code).toContain("_ctx.rows");
      // row 不加前缀
      expect(code).toContain("row.cells");
      expect(code).not.toContain("_ctx.row.cells");
    });
  });

  // ============================================
  // v-model 双向绑定
  // ============================================
  describe("v-model 双向绑定", () => {
    describe("原生元素", () => {
      it("input text", () => {
        const { code } = compile('<input v-model="msg" />');
        // 应该展开为 :value + @input
        expect(code).toContain("value");
        expect(code).toContain("onInput");
        expect(code).toContain("_ctx.msg");
      });

      it("input with type text", () => {
        const { code } = compile('<input type="text" v-model="msg" />');
        expect(code).toContain("value");
        expect(code).toContain("onInput");
      });

      it("input checkbox", () => {
        const { code } = compile('<input type="checkbox" v-model="checked" />');
        // checkbox 应该用 checked + change
        expect(code).toContain("checked");
        expect(code).toContain("onChange");
        expect(code).toContain("_ctx.checked");
      });

      it("input radio", () => {
        const { code } = compile('<input type="radio" v-model="picked" />');
        expect(code).toContain("checked");
        expect(code).toContain("onChange");
      });

      it("textarea", () => {
        const { code } = compile('<textarea v-model="content"></textarea>');
        expect(code).toContain("value");
        expect(code).toContain("onInput");
        expect(code).toContain("_ctx.content");
      });

      it("select", () => {
        const { code } = compile(`
          <select v-model="selected">
            <option>A</option>
            <option>B</option>
          </select>
        `);
        expect(code).toContain("value");
        expect(code).toContain("onChange");
        expect(code).toContain("_ctx.selected");
      });
    });

    describe("组件", () => {
      it("组件默认 modelValue", () => {
        const { code } = compile('<MyInput v-model="msg" />');
        // 组件使用 modelValue + update:modelValue
        expect(code).toContain("modelValue");
        expect(code).toContain("onUpdate:modelValue");
        expect(code).toContain("_ctx.msg");
      });

      it("组件自定义参数 v-model:title", () => {
        const { code } = compile('<MyInput v-model:title="pageTitle" />');
        expect(code).toContain("title");
        expect(code).toContain("onUpdate:title");
        expect(code).toContain("_ctx.pageTitle");
      });
    });
  });

  // ============================================
  // v-show
  // ============================================
  describe("v-show", () => {
    it("基本 v-show", () => {
      const { code } = compile('<div v-show="visible">content</div>');
      expect(code).toContain("withDirectives");
      expect(code).toContain("vShow");
      expect(code).toContain("_ctx.visible");
    });

    it("v-show 带其他属性", () => {
      const { code } = compile(
        '<div v-show="isActive" :class="cls">text</div>'
      );
      expect(code).toContain("withDirectives");
      expect(code).toContain("vShow");
      expect(code).toContain("_ctx.isActive");
      expect(code).toContain("_ctx.cls");
    });

    it("v-show 复杂表达式", () => {
      const { code } = compile('<div v-show="count > 0">positive</div>');
      expect(code).toContain("withDirectives");
      expect(code).toContain("_ctx.count");
    });
  });

  // ============================================
  // v-html / v-text
  // ============================================
  describe("v-html", () => {
    it("基本 v-html", () => {
      const { code } = compile('<div v-html="rawHtml"></div>');
      expect(code).toContain("innerHTML");
      expect(code).toContain("_ctx.rawHtml");
    });

    it("v-html 会清空子节点", () => {
      const { code } = compile('<div v-html="html">这段文字会被忽略</div>');
      expect(code).toContain("innerHTML");
      // 子节点应该被清空，不应该包含原文本
      expect(code).not.toContain("这段文字会被忽略");
    });
  });

  describe("v-text", () => {
    it("基本 v-text", () => {
      const { code } = compile('<div v-text="message"></div>');
      expect(code).toContain("textContent");
      expect(code).toContain("_ctx.message");
    });

    it("v-text 会清空子节点", () => {
      const { code } = compile('<div v-text="text">原有内容</div>');
      expect(code).toContain("textContent");
      expect(code).not.toContain("原有内容");
    });
  });

  // ============================================
  // 指令组合
  // ============================================
  describe("指令组合", () => {
    it("v-if + v-for (v-if 优先)", () => {
      // 注意：在同一元素上，v-if 比 v-for 优先级高
      // 但通常不建议这样写，这里测试编译不报错
      const { code } = compile(
        '<div v-if="show" v-for="item in list">{{ item }}</div>'
      );
      expect(code).toContain("_ctx.show");
      expect(code).toContain("renderList");
    });

    it("v-for + v-show", () => {
      const { code } = compile(
        '<div v-for="item in list" v-show="item.visible">{{ item.name }}</div>'
      );
      expect(code).toContain("renderList");
      expect(code).toContain("withDirectives");
      expect(code).toContain("vShow");
    });

    it("v-model + v-show", () => {
      const { code } = compile('<input v-model="msg" v-show="editable" />');
      expect(code).toContain("value");
      expect(code).toContain("onInput");
      expect(code).toContain("withDirectives");
      expect(code).toContain("vShow");
    });
  });

  // ============================================
  // 快照测试
  // ============================================
  describe("快照测试", () => {
    it("v-if 快照", () => {
      const { code } = compile(`
        <div v-if="show">visible</div>
        <div v-else>hidden</div>
      `);
      expect(code).toMatchSnapshot();
    });

    it("v-for 快照", () => {
      const { code } = compile(
        '<li v-for="(item, index) in list" :key="item.id">{{ index }}: {{ item.name }}</li>'
      );
      expect(code).toMatchSnapshot();
    });

    it("v-model 快照", () => {
      const { code } = compile('<input v-model="username" />');
      expect(code).toMatchSnapshot();
    });

    it("v-show 快照", () => {
      const { code } = compile('<div v-show="active">content</div>');
      expect(code).toMatchSnapshot();
    });
  });
});
