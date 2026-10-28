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
