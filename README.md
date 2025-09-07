# MCP工具包 (MCP Toolkit)

这是一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 的工具包monorepo，使用 Bun 和 TypeScript 开发。每个包都是独立的 MCP 服务器，可以为大语言模型 (LLM) 提供特定领域的工具和功能。

## 项目特点

- 🚀 **轻量级 Monorepo** - 使用 Bun 工作区进行简单高效的包管理
- 📦 **独立 MCP 服务器** - 每个包都是完整的 MCP 服务器实现
- 🔧 **TypeScript + Bun** - 开发时使用 Bun 和 TypeScript，发布时兼容 Node.js
- 📚 **模块化设计** - 每个工具专注于特定功能领域
- 🔄 **Changesets 版本管理** - 自动化版本发布和更新日志生成

## 项目结构

```
mcp-toolkit/
├── packages/
│   ├── fs-server/           # 文件系统操作 MCP 服务器
│   └── exiftool-server/     # ExifTool 元数据操作 MCP 服务器
├── .changeset/              # Changesets 配置
├── package.json             # 根目录配置
├── tsconfig.json            # TypeScript 配置
└── README.md               # 本文档
```

## 已包含的 MCP 服务器

### 🗂️ @mcp/fs-server
文件系统操作服务器 - [详细信息](./packages/fs-server/README.md)

[![codecov](https://codecov.io/gh/zkl2333/mcp-toolkit/graph/badge.svg?flag=fs-server)](https://codecov.io/gh/zkl2333/mcp-toolkit)
[![CI](https://github.com/zkl2333/mcp-toolkit/workflows/Test%20%26%20Coverage/badge.svg)](https://github.com/zkl2333/mcp-toolkit/actions)

### 📸 @mcp/exiftool-server
图片/视频元数据操作服务器 - [详细信息](./packages/exiftool-server/README.md)

[![codecov](https://codecov.io/gh/zkl2333/mcp-toolkit/graph/badge.svg?flag=exiftool-server)](https://codecov.io/gh/zkl2333/mcp-toolkit)
[![CI](https://github.com/zkl2333/mcp-toolkit/workflows/Test%20%26%20Coverage/badge.svg)](https://github.com/zkl2333/mcp-toolkit/actions)

### 🧪 @mcp/test-utils
测试工具包 - [详细信息](./packages/test-utils/README.md)

[![codecov](https://codecov.io/gh/zkl2333/mcp-toolkit/graph/badge.svg?flag=test-utils)](https://codecov.io/gh/zkl2333/mcp-toolkit)
[![CI](https://github.com/zkl2333/mcp-toolkit/workflows/Test%20%26%20Coverage/badge.svg)](https://github.com/zkl2333/mcp-toolkit/actions)

## 快速开始

### 前置要求

- [Bun](https://bun.sh/) >= 1.0.0
- Node.js >= 18 (用于运行发布的包)

### 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd mcp-toolkit

# 安装依赖
bun install
```

### 开发和构建

```bash
# 构建所有包
bun run build

# 开发模式（监听文件变化）
bun run dev

# 运行测试
bun run test

# 运行测试并生成覆盖率报告
bun run test:coverage

# 类型检查
bun run type-check
```

### 运行特定的 MCP 服务器

```bash
# 运行文件系统服务器
cd packages/fs-server
bun run dev

# 或者运行构建后的版本
bun run start
```


## 开发指南

### 添加新的 MCP 服务器

1. 在 `packages/` 目录下创建新包：
```bash
mkdir packages/your-server-name
cd packages/your-server-name
```

2. 创建 `package.json`，参考现有的 `fs-server` 包

3. 实现 MCP 服务器：
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "your-server",
  version: "0.1.0"
});

// 注册工具、资源等...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 版本管理

使用 Changesets 进行版本管理：

```bash
# 创建变更集
bun changeset

# 更新版本号
bun changeset:version

# 发布到 npm
bun changeset:publish
```

## 贡献指南

1. Fork 本项目
2. 创建功能分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送分支: `git push origin feature/your-feature`
5. 提交 Pull Request

## License

MIT

## 相关链接

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Bun](https://bun.sh/)
- [Changesets](https://github.com/changesets/changesets)
