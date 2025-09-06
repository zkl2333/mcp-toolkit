# MCP 文件系统服务器

这是一个基于 Model Context Protocol (MCP) 的文件系统操作服务器，提供了全面的文件和目录操作工具。

## 功能特性

### 支持的工具 (Tools)

1. **move-file** - 移动文件
   - 从源路径移动文件到目标路径
   - 支持覆盖模式和自动创建目录

2. **copy-file** - 复制文件
   - 从源路径复制文件到目标路径
   - 支持覆盖模式和自动创建目录

3. **delete-file** - 删除文件
   - 安全删除指定文件
   - 包含文件存在性检查

4. **list-directory** - 列出目录内容
   - 列出指定目录中的文件和子目录
   - 支持显示隐藏文件和详细信息

5. **create-directory** - 创建目录
   - 创建新目录
   - 支持递归创建父目录

6. **file-info** - 获取文件信息
   - 获取文件或目录的详细信息
   - 包括大小、权限、时间戳等

## 安装和使用

### 开发模式

```bash
# 安装依赖
bun install

# 开发模式运行
bun run dev

# 构建
bun run build

# 运行构建后的版本
bun run start
```

### 生产模式

```bash
# 构建项目
bun run build

# 运行MCP服务器
node dist/index.js
```

### 作为全局命令安装

```bash
# 从根目录安装所有工作区包
bun install

# 构建fs-server包
cd packages/fs-server
bun run build

# 全局链接
npm link

# 现在可以在任何地方使用
mcp-fs-server
```

## MCP 客户端集成

这个服务器使用标准的 MCP 协议，可以与任何兼容的 MCP 客户端集成。

### 配置示例

在支持 MCP 的应用中（如 Claude Desktop），可以这样配置：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/packages/fs-server/dist/index.js"]
    }
  }
}
```

### 工具使用示例

服务器启动后，客户端可以调用以下工具：

**移动文件：**
```json
{
  "name": "move-file",
  "arguments": {
    "source": "/path/to/source/file.txt",
    "destination": "/path/to/destination/file.txt",
    "overwrite": false,
    "createDirs": true
  }
}
```

**列出目录：**
```json
{
  "name": "list-directory",
  "arguments": {
    "path": "/path/to/directory",
    "showHidden": false,
    "details": true
  }
}
```

**获取文件信息：**
```json
{
  "name": "file-info",
  "arguments": {
    "path": "/path/to/file"
  }
}
```

## 安全考虑

- 所有文件路径都会被解析为绝对路径，防止路径遍历攻击
- 服务器会验证文件和目录的存在性
- 提供了适当的错误处理和用户反馈
- 支持安全的覆盖控制

## 测试

项目包含完整的自动化测试套件，测试所有文件系统操作功能。

[![codecov](https://codecov.io/gh/YOUR_GITHUB_USERNAME/mcp-toolkit/graph/badge.svg?flag=fs-server)](https://codecov.io/gh/YOUR_GITHUB_USERNAME/mcp-toolkit)
[![CI](https://github.com/YOUR_GITHUB_USERNAME/mcp-toolkit/workflows/Test%20%26%20Coverage/badge.svg)](https://github.com/YOUR_GITHUB_USERNAME/mcp-toolkit/actions)

### 运行测试

```bash
# 运行完整测试套件
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监视模式运行测试
npm run test:watch
```

### 测试内容

自动化测试覆盖以下功能：

1. **文件操作** - 创建、复制、移动、删除文件
2. **目录操作** - 创建目录、列出内容、获取信息
3. **错误处理** - 验证错误情况的正确处理
4. **复杂场景** - 特殊字符、深层目录、批量操作
5. **覆盖保护** - 文件冲突处理
6. **路径验证** - 路径安全检查

## 开发

### 项目结构

```
packages/fs-server/
├── src/
│   └── index.ts          # 主要的MCP服务器实现
├── tests/               # 测试文件
│   └── fs-server.test.ts # 主要测试文件
├── dist/                 # 构建输出目录
├── package.json          # 包配置
├── tsconfig.json         # TypeScript配置
└── README.md            # 本文档
```

### 依赖

- `@modelcontextprotocol/sdk` - MCP TypeScript SDK
- `zod` - 运行时类型验证
- `typescript` - TypeScript支持

## License

MIT
