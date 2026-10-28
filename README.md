# ToySVGEditor

高级软件设计 Lab1 Phase 1：TypeScript 面向对象 SVG 命令行编辑器。

## 开发

需要 Node.js 20 或更高版本。

```sh
npm ci
npm run cli
npm run check
```

通过标准输入回放命令脚本：

```sh
npm run cli < examples/flowchart.txt
```

实验要求保存在 `phase_cli_1 (1).md`；架构方案、开发过程和质量记录见 [doc/README.md](doc/README.md)。

## 分步计划

1. 工程骨架与架构方案。
2. 图形类层次、Composite 文档树与模型测试。
3. Command、事务式编辑、undo/redo 与 CLI。
4. SVG 文件读写和导入验证。
5. 完整会话验收、示例、文档自查与 `final` 标签。

## 使用示例

```text
init 400 200
create g scene
create rect r 20 30 100 50 #4a90d9 in scene
create text title 30 60 "Hello SVG" in scene
move scene 10 0
undo
tree
save demo.svg
```

在交互界面输入 `help` 查看全部语法，输入 `quit` 或按 Ctrl-D 退出。脚本中的空行和行首 `#` 注释会跳过，颜色中的 `#` 会保留；含空格的文本和路径用双引号，文本内引号写成 `\"`，反斜线写成 `\\`。

支持六种内置图形（rect/circle/ellipse/line/text/g）、分组与嵌套、属性修改、绘制顺序、undo/redo、SVG 读写和缺失 id 自动补全。成功执行 init/read/save 或修改画布尺寸后，历史按实验要求阻断；下一次成功编辑重新开启历史。

`examples/flowchart.txt` 是可回放脚本，`examples/flowchart.svg` 是生成结果，可直接用浏览器打开。`examples/other.svg` 含缺失 id，执行 `read examples/other.svg` 可观察自动分配警告。

## SVG 支持范围

读写六种内置元素、数值几何属性、fill/stroke/stroke-width 和文本。支持嵌套 g、XML 注释、CDATA、中文与字符转义；画布允许 px 尺寸及匹配尺寸的 viewBox。未知的 `data-kind` 容器按普通 g 导入。

本阶段未实现插件 `box`、transform、path、CSS、文本字体属性以及不匹配画布的 viewBox；此类外部 SVG 会明确报错，避免导入后悄悄丢失外观。撤销历史使用文档深拷贝，适合实验规模文档。

## 验证

`npm run check` 执行严格类型检查、模型/会话/SVG/真实 CLI 子进程测试和编译。测试会在临时目录进行文件操作，不覆盖项目示例。编译后也可运行 `node dist/src/main.js`。
