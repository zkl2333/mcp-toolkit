# MCP 文件系统服务器

这是一个基于 Model Context Protocol (MCP) 的文件系统操作服务器，提供了全面的文件和目录操作工具。

## 功能特性

### 支持的工具 (Tools)

#### 基础文件操作
1. **move-file** - 移动文件
   - 从源路径移动文件到目标路径
   - 支持覆盖模式和自动创建目录

2. **copy-file** - 复制文件
   - 从源路径复制文件到目标路径
   - 支持覆盖模式和自动创建目录

3. **delete-file** - 删除文件
   - 安全删除指定文件
   - 包含文件存在性检查

4. **rename** - 重命名文件或目录
   - 重命名文件或目录
   - 支持覆盖模式和自动创建目录

#### 目录操作
5. **list-directory** - 列出目录内容
   - 列出指定目录中的文件和子目录
   - 支持显示隐藏文件和详细信息

6. **create-directory** - 创建目录
   - 创建新目录
   - 支持递归创建父目录

#### 文件信息
7. **file-info** - 获取文件信息
   - 获取文件或目录的详细信息
   - 包括大小、权限、时间戳等

#### 链接操作
8. **create-hard-link** - 创建硬链接
   - 为现有文件创建硬链接
   - 支持覆盖模式和自动创建目录
   - 硬链接不能链接到目录

9. **create-symlink** - 创建软链接
   - 创建符号链接（软链接）
   - 支持链接到不存在的文件
   - 支持覆盖模式和自动创建目录
   - 在 Windows 上自动处理权限问题

10. **read-symlink** - 读取软链接
    - 读取软链接的目标路径
    - 验证链接的有效性

#### 权限管理
11. **change-permissions** - 修改文件权限
    - 修改文件或目录的权限
    - 支持八进制权限模式（如 '755', '644'）

#### 批量操作
12. **batch-move** - 批量移动文件
    - 批量移动多个文件或目录到目标目录
    - 支持覆盖模式和自动创建目录
    - 提供详细的成功/失败报告

13. **batch-copy** - 批量复制文件
    - 批量复制多个文件或目录到目标目录
    - 支持覆盖模式和自动创建目录
    - 提供详细的成功/失败报告

14. **batch-delete** - 批量删除文件
    - 批量删除多个文件或目录
    - 支持强制删除模式
    - 提供详细的成功/失败报告

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

#### 基础文件操作

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

**重命名文件：**
```json
{
  "name": "rename",
  "arguments": {
    "oldPath": "/path/to/old-name.txt",
    "newPath": "/path/to/new-name.txt",
    "overwrite": false,
    "createDirs": true
  }
}
```

#### 目录操作

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

#### 文件信息

**获取文件信息：**
```json
{
  "name": "file-info",
  "arguments": {
    "path": "/path/to/file"
  }
}
```

#### 链接操作

**创建硬链接：**
```json
{
  "name": "create-hard-link",
  "arguments": {
    "source": "/path/to/original.txt",
    "destination": "/path/to/hardlink.txt",
    "overwrite": false,
    "createDirs": true
  }
}
```

**创建软链接：**
```json
{
  "name": "create-symlink",
  "arguments": {
    "target": "/path/to/target",
    "linkPath": "/path/to/symlink",
    "overwrite": false,
    "createDirs": true
  }
}
```

**读取软链接：**
```json
{
  "name": "read-symlink",
  "arguments": {
    "linkPath": "/path/to/symlink"
  }
}
```

#### 权限管理

**修改文件权限：**
```json
{
  "name": "change-permissions",
  "arguments": {
    "path": "/path/to/file",
    "mode": "755"
  }
}
```

#### 批量操作

**批量移动文件：**
```json
{
  "name": "batch-move",
  "arguments": {
    "sources": ["/path/to/file1.txt", "/path/to/file2.txt", "/path/to/file3.txt"],
    "destination": "/path/to/destination/",
    "overwrite": false,
    "createDirs": true
  }
}
```

**批量复制文件：**
```json
{
  "name": "batch-copy",
  "arguments": {
    "sources": ["/path/to/file1.txt", "/path/to/file2.txt"],
    "destination": "/path/to/backup/",
    "overwrite": false,
    "createDirs": true
  }
}
```

**批量删除文件：**
```json
{
  "name": "batch-delete",
  "arguments": {
    "paths": ["/path/to/file1.txt", "/path/to/file2.txt", "/path/to/old-dir"],
    "force": false
  }
}
```

## 安全考虑

- 所有文件路径都会被解析为绝对路径，防止路径遍历攻击
- 服务器会验证文件和目录的存在性
- 提供了适当的错误处理和用户反馈
- 支持安全的覆盖控制

### Windows 软链接权限

在 Windows 系统上创建符号链接需要特殊权限：

1. **管理员权限**：以管理员身份运行程序
2. **开发者模式**：在 Windows 10/11 中启用开发者模式
3. **手动创建**：使用 `mklink` 命令手动创建链接

如果权限不足，工具会提供详细的错误信息和解决方案。

## 测试

项目包含完整的自动化测试套件，测试所有文件系统操作功能。

[![codecov](https://codecov.io/gh/zkl2333/mcp-toolkit/graph/badge.svg?flag=fs-server)](https://codecov.io/gh/zkl2333/mcp-toolkit)
[![CI](https://github.com/zkl2333/mcp-toolkit/workflows/Test%20%26%20Coverage/badge.svg)](https://github.com/zkl2333/mcp-toolkit/actions)

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

1. **基础文件操作** - 创建、复制、移动、删除、重命名文件
2. **目录操作** - 创建目录、列出内容、获取信息
3. **链接操作** - 硬链接和软链接的创建、读取
4. **权限管理** - 文件权限的修改和验证
5. **批量操作** - 批量移动、复制、删除文件
6. **错误处理** - 验证错误情况的正确处理
7. **复杂场景** - 特殊字符、深层目录、批量操作
8. **覆盖保护** - 文件冲突处理
9. **路径验证** - 路径安全检查
10. **边界情况** - 不存在的文件、权限不足、跨文件系统操作

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
