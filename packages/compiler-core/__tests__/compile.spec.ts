import { compile } from "../src/compile";

describe("compiler-core 综合测试", () => {
  // 辅助函数：打印生成的代码
  const logCode = (template: string) => {
    const { code } = compile(template);
    console.log(`\n模板: ${template}`);
    console.log(`生成代码:\n${code}`);
    return code;
  };

  describe("基础场景", () => {
    it("纯文本", () => {
      const { code } = compile("hello world");
      expect(code).toContain("return");
      expect(code).toContain('"hello world"');
    });

    it("插值表达式", () => {
      const { code } = compile("{{ msg }}");
      expect(code).toContain("toDisplayString");
      expect(code).toContain("_ctx.msg");
    });

    it("简单元素", () => {
      const { code } = compile("<div></div>");
      expect(code).toContain("createVNode");
      expect(code).toContain('"div"');
    });

    it("自闭合元素", () => {
      const { code } = compile("<input />");
      expect(code).toContain("createVNode");
      expect(code).toContain('"input"');
    });
  });

  describe("属性处理", () => {
    it("静态属性", () => {
      const { code } = compile('<div id="app"></div>');
      expect(code).toContain('"id"');
      expect(code).toContain('"app"');
    });

    it("动态属性 v-bind", () => {
      const { code } = compile('<div :id="userId"></div>');
      expect(code).toContain("_ctx.userId");
    });

    it("简写动态属性", () => {
      const { code } = compile('<div :class="className"></div>');
      expect(code).toContain("_ctx.className");
    });

    it("事件绑定 v-on", () => {
      const { code } = compile('<button @click="handleClick"></button>');
      expect(code).toContain("onClick");
      expect(code).toContain("_ctx.handleClick");
    });

    it("混合属性", () => {
      const { code } = compile(
        '<div id="app" :class="cls" @click="onClick"></div>'
      );
      expect(code).toContain('"id"');
      expect(code).toContain("_ctx.cls");
      expect(code).toContain("onClick");
    });
  });

  describe("子节点处理", () => {
    it("元素包含文本", () => {
      const { code } = compile("<div>hello</div>");
      expect(code).toContain('"hello"');
      // props 为空时，第二个参数应该是 null
      expect(code).toContain("null");
    });

    it("元素包含插值", () => {
      const { code } = compile("<div>{{ msg }}</div>");
      expect(code).toContain("toDisplayString");
      expect(code).toContain("_ctx.msg");
      // props 为空时，第二个参数应该是 null
      expect(code).toContain("null");
    });

    it("文本和插值混合", () => {
      const { code } = compile("<div>hello {{ msg }} world</div>");
      expect(code).toContain('"hello "');
      expect(code).toContain("toDisplayString");
      expect(code).toContain('" world"');
      // 应该用 + 连接
      expect(code).toMatch(/\"hello \"\s*\+/);
      // props 为空时，第二个参数应该是 null
      expect(code).toMatch(/createVNode\("div", null,/);
    });

    it("多个子节点", () => {
      const { code } = compile("<div><span>a</span><span>b</span></div>");
      expect(code).toContain("[");
      expect(code).toContain("]");
      // 外层 div 的 props 为空
      expect(code).toMatch(/createVNode\("div", null, \[/);
    });
  });

  describe("嵌套结构", () => {
    it("二层嵌套", () => {
      const { code } = compile("<div><span>hello</span></div>");
      expect(code).toContain('"div"');
      expect(code).toContain('"span"');
      expect(code).toContain('"hello"');
      // 没有 props 的元素，第二个参数是 null
      expect(code).toMatch(/createVNode\("div", null/);
      expect(code).toMatch(/createVNode\("span", null/);
    });

    it("三层嵌套", () => {
      const { code } = compile("<div><p><span>text</span></p></div>");
      expect(code).toContain('"div"');
      expect(code).toContain('"p"');
      expect(code).toContain('"span"');
    });

    it("嵌套带属性", () => {
      const { code } = compile(
        '<div id="outer"><span :class="inner">text</span></div>'
      );
      expect(code).toContain('"outer"');
      expect(code).toContain("_ctx.inner");
      // 有 props 的元素不应该有 null 占位
      expect(code).not.toMatch(/createVNode\("div", null/);
    });
  });

  describe("多根节点 (Fragment)", () => {
    it("两个根元素", () => {
      const { code } = compile("<span>a</span><span>b</span>");
      expect(code).toContain("Fragment");
      expect(code).toContain("[");
      // Fragment 第二个参数是 null
      expect(code).toMatch(/createVNode\(Fragment, null, \[/);
    });

    it("三个根元素", () => {
      const { code } = compile("<div>1</div><div>2</div><div>3</div>");
      expect(code).toContain("Fragment");
      expect(code).toMatch(/createVNode\(Fragment, null/);
    });
  });

  describe("复杂表达式", () => {
    it("成员访问", () => {
      const { code } = compile("{{ user.name }}");
      expect(code).toContain("_ctx.user.name");
    });

    it("计算属性访问", () => {
      const { code } = compile("{{ list[index] }}");
      expect(code).toContain("_ctx.list");
      expect(code).toContain("_ctx.index");
    });

    it("函数调用", () => {
      const { code } = compile("{{ formatDate(date) }}");
      expect(code).toContain("_ctx.formatDate");
      expect(code).toContain("_ctx.date");
    });

    it("三元表达式", () => {
      const { code } = compile("{{ isActive ? 'yes' : 'no' }}");
      expect(code).toContain("_ctx.isActive");
    });

    it("全局变量不加前缀", () => {
      const { code } = compile("{{ Math.random() }}");
      expect(code).toContain("Math.random");
      expect(code).not.toContain("_ctx.Math");
    });

    it("console 不加前缀", () => {
      const { code } = compile('<button @click="console.log(msg)"></button>');
      expect(code).toContain("console.log");
      expect(code).not.toContain("_ctx.console");
    });
  });

  describe("综合场景", () => {
    it("完整组件模板", () => {
      const template = `
        <div id="app" :class="rootClass">
          <header>
            <h1>{{ title }}</h1>
          </header>
          <main>
            <p>{{ content }}</p>
            <button @click="handleClick">Click me</button>
          </main>
        </div>
      `;
      const { code } = compile(template);

      expect(code).toContain("createVNode");
      expect(code).toContain("toDisplayString");
      expect(code).toContain("_ctx.rootClass");
      expect(code).toContain("_ctx.title");
      expect(code).toContain("_ctx.content");
      expect(code).toContain("_ctx.handleClick");
      expect(code).toContain("onClick");
    });

    it("列表项模板", () => {
      const template = `
        <ul>
          <li :key="item.id" :class="item.active ? 'active' : ''">
            {{ item.name }}
          </li>
        </ul>
      `;
      const { code } = compile(template);

      expect(code).toContain("_ctx.item");
      expect(code).toContain("toDisplayString");
    });
  });

  describe("快照测试", () => {
    it("简单模板快照", () => {
      const { code } = compile('<div id="app">{{ msg }}</div>');
      expect(code).toMatchSnapshot();
    });

    it("嵌套模板快照", () => {
      const { code } = compile(`
        <div :class="cls">
          <span>hello {{ name }}</span>
        </div>
      `);
      expect(code).toMatchSnapshot();
    });

    it("多根节点快照", () => {
      const { code } = compile("<span>a</span><span>b</span>");
      expect(code).toMatchSnapshot();
    });
  });
});
