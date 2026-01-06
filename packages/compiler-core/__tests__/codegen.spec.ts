import { compile } from "../src/compile";

describe("codegen", () => {
  it("text", () => {
    const { code } = compile("hello");
    expect(code).toMatchSnapshot();
  });

  it("interpolation", () => {
    const { code } = compile("{{ msg }}");
    expect(code).toMatchSnapshot();
  });

  it("element", () => {
    const { code } = compile("<div></div>");
    expect(code).toMatchSnapshot();
  });

  it("element with text", () => {
    const { code } = compile("<div>hello</div>");
    expect(code).toMatchSnapshot();
  });

  it("element with interpolation", () => {
    const { code } = compile("<div>{{ msg }}</div>");
    expect(code).toMatchSnapshot();
  });

  it("element with props", () => {
    const { code } = compile('<div id="app" :class="cls"></div>');
    expect(code).toMatchSnapshot();
  });

  it("mixed content", () => {
    const { code } = compile("<div>hello {{ msg }} world</div>");
    expect(code).toMatchSnapshot();
  });
});
