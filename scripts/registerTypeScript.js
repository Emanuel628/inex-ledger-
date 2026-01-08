const fs = require("fs");
const ts = require("typescript");

const registerTypeScriptCompiler = () => {
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.React,
  };

  require.extensions[".ts"] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const { outputText, diagnostics } = ts.transpileModule(source, {
      compilerOptions,
      fileName: filename,
    });
    if (diagnostics && diagnostics.length) {
      diagnostics.forEach((diag) => {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        if (message) {
          console.warn("TypeScript warning:", message);
        }
      });
    }
    module._compile(outputText, filename);
  };
};

module.exports = { registerTypeScriptCompiler };
