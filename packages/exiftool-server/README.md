# MCP ExifTool 服务器

这是一个基于 Model Context Protocol (MCP) 的 ExifTool 服务器，提供了全面的图片和视频元数据操作工具。它封装了强大的 `exiftool-vendored` 库，支持读取、写入和编辑各种格式的媒体文件元数据。

## 功能特性

### 支持的工具 (Tools)

1. **read-metadata** - 读取元数据

   - 读取图片/视频文件的完整元数据（EXIF、IPTC、XMP 等）
   - 支持指定特定标签进行读取
   - 自动处理日期时间和时区信息

2. **write-metadata** - 写入元数据

   - 添加或修改文件元数据
   - 支持各种元数据标准（EXIF、IPTC、XMP）
   - 批量更新多个标签

3. **extract-thumbnail** - 提取缩略图

   - 从文件中提取嵌入的缩略图
   - 支持覆盖现有文件选项
   - 自动处理各种图片格式

4. **extract-preview** - 提取预览图

   - 提取比缩略图更大的预览图
   - 适用于 RAW 文件等专业格式
   - 保持原始图片质量

5. **delete-metadata** - 删除元数据

   - 安全删除指定的元数据标签
   - 批量删除多个标签
   - 保留文件完整性

6. **get-version** - 获取版本信息
   - 显示 ExifTool 版本
   - 用于兼容性检查

### 支持的文件格式

- **图片格式**: JPEG, TIFF, PNG, GIF, BMP, WebP, HEIC, AVIF 等
- **RAW 格式**: CR2, NEF, ARW, DNG, ORF, RAF, PEF, RW2 等
- **视频格式**: MP4, MOV, AVI, MKV, WEBM 等
- **可执行文件/程序资源 (PE)**: EXE, DLL, SYS 等（版本、公司名、产品名、描述、原始文件名等）
- **文档/档案/音频**: PDF, PostScript, ZIP, MP3, FLAC 等

## 典型使用场景

- **电商/内容平台**：读取并规范商品图片元数据（相机信息、拍摄时间、版权、关键词），辅助 SEO、检索与合规。
- **数字资产管理（DAM）**：批量读取/写入版权与标签，构建可检索、可审计的媒体库。
- **安全与合规/取证**：读取 EXE/DLL 的版本与厂商信息（CompanyName、ProductName、FileVersion 等），辅助来源甄别与资产盘点。
- **摄影工作流**：统一整理 EXIF/XMP/IPTC 标签，批量修正 AllDates，提取缩略图/预览图用于快速浏览。

## 安装和使用

### 前置要求

- Node.js >= 18
- 支持 Perl（ExifTool 的依赖）

### 开发模式

```bash
# 进入子包目录
cd packages/exiftool-server

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

# 运行 MCP 服务器
node dist/index.js
```

## MCP 客户端集成

这个服务器使用标准的 MCP 协议，可以与任何兼容的 MCP 客户端集成。

### 配置示例

在支持 MCP 的应用中（如 Claude Desktop），可以这样配置：

```json
{
  "mcpServers": {
    "exiftool": {
      "command": "npx",
      "args": ["@zkl2333/exiftool-mcp-server"]
    }
  }
}
```

### 工具使用示例

服务器启动后，客户端可以调用以下工具：

**读取元数据：**

```json
{
  "name": "read-metadata",
  "arguments": {
    "filePath": "/path/to/photo.jpg",
    "tags": ["Make", "Model", "DateTimeOriginal", "GPSLatitude", "GPSLongitude"]
  }
}
```

**写入元数据：**

```json
{
  "name": "write-metadata",
  "arguments": {
    "filePath": "/path/to/photo.jpg",
    "metadata": {
      "Copyright": "© 2024 摄影师姓名",
      "Keywords": ["风景", "日落", "自然"],
      "XPComment": "美丽的日落照片"
    }
  }
}
```

**提取缩略图：**

```json
{
  "name": "extract-thumbnail",
  "arguments": {
    "filePath": "/path/to/photo.jpg",
    "outputPath": "/path/to/thumbnail.jpg",
    "overwrite": false
  }
}
```

**删除元数据：**

```json
{
  "name": "delete-metadata",
  "arguments": {
    "filePath": "/path/to/photo.jpg",
    "tags": ["UserComment", "ImageDescription", "IPTC:Keywords"]
  }
}
```

**读取 EXE/DLL 信息：**

```json
{
  "name": "read-metadata",
  "arguments": {
    "filePath": "C:/Path/To/App.exe",
    "tags": [
      "FileVersion",
      "ProductName",
      "CompanyName",
      "FileDescription",
      "OriginalFilename",
      "FileType",
      "MIMEType"
    ]
  }
}
```

## 提示词模板（Prompts）

- **电商商品图片元数据诊断与优化**
  - 目标：读取图片关键信息，产出标题/Alt 文本/关键词建议。
  - 模板：
    ```
    使用 MCP 的 exiftool 服务器：
    1) 调用 read-metadata 读取 /path/to/image.jpg 的以下标签：
       [Make, Model, LensModel, DateTimeOriginal, GPSLatitude, GPSLongitude, Keywords, Title, Description, Copyright]
    2) 输出：
       - 简要拍摄信息（相机/镜头/时间/地点）
       - 建议的 SEO 标题（<= 60 字）
       - 建议的 Alt 文本（<= 125 字）
       - 建议的 5-10 个关键词
    ```

- **可执行文件来源核验（EXE/DLL）**
  - 目标：核对版本与厂商信息，辅助资产盘点与来源甄别。
  - 模板：
    ```
    使用 MCP 的 exiftool 服务器读取 C:/Path/To/App.exe 的版本信息：
    调用 read-metadata，tags: [FileVersion, ProductName, CompanyName, FileDescription, OriginalFilename, FileType]
    请输出：
    - 产品名/公司名/版本
    - 文件描述与原始文件名
    - 基于信息给出可信度评估（低/中/高）
    ```

- **批量合规清理（去除敏感元数据）**
  - 目标：检测并清理隐私字段（如 GPS、作者/版权等）。
  - 模板：
    ```
    对目录 /assets/export 下所有图片：
    1) 逐个调用 read-metadata 检查 GPS、Author、Copyright、UserComment。
    2) 列出需清理的文件与字段。
    3) 生成 delete-metadata / write-metadata 的建议操作列表（勿直接执行）。
    ```

## 常用元数据标签

### 基本信息

- `Make` - 相机制造商
- `Model` - 相机型号
- `LensModel` - 镜头型号
- `Software` - 处理软件

### 拍摄参数

- `ISO` - ISO 感光度
- `FNumber` - 光圈值
- `ExposureTime` - 快门速度
- `FocalLength` - 焦距

### 日期时间

- `DateTimeOriginal` - 拍摄时间
- `CreateDate` - 创建时间
- `ModifyDate` - 修改时间
- `AllDates` - 批量设置所有日期

### GPS 信息

- `GPSLatitude` - 纬度
- `GPSLongitude` - 经度
- `GPSAltitude` - 海拔

### 描述信息

- `Title` - 标题
- `Copyright` - 版权信息
- `Keywords` - 关键词
- `Description` - 描述

### IPTC 标签

- `IPTC:Keywords` - IPTC 关键词
- `IPTC:CopyrightNotice` - IPTC 版权声明
- `IPTC:Caption-Abstract` - IPTC 说明

### XMP 标签

- `XMP:Title` - XMP 标题
- `XMP:Description` - XMP 描述
- `XMP:Creator` - XMP 创作者

## 安全考虑

- 所有文件路径都会被解析为绝对路径，防止路径遍历攻击
- 服务器会验证文件的存在性
- 提供了适当的错误处理和用户反馈
- 支持安全的覆盖控制
- 自动处理 ExifTool 进程的生命周期管理

## 错误处理

服务器提供详细的错误信息：

- **文件不存在**: 当指定的文件路径无效时
- **输出文件冲突**: 当输出文件已存在且未启用覆盖模式时
- **元数据读取错误**: 当文件格式不受支持或损坏时
- **权限错误**: 当没有文件读写权限时

## 测试

项目包含完整的自动化测试套件，测试所有 MCP 工具功能。

[![codecov](https://codecov.io/gh/zkl2333/mcp-toolkit/graph/badge.svg?flag=exiftool-server)](https://codecov.io/gh/zkl2333/mcp-toolkit)
[![CI](https://github.com/zkl2333/mcp-toolkit/workflows/Test%20%26%20Coverage/badge.svg)](https://github.com/zkl2333/mcp-toolkit/actions)

### 运行测试

```bash
# 运行完整测试套件
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监视模式运行测试
npm run test:watch

# 设置测试图片
npm run test:setup
```

### 测试内容

自动化测试覆盖以下功能：

1. **服务器初始化** - 验证 MCP 服务器正常启动
2. **工具列表** - 确认所有预期工具都可用
3. **版本信息** - 获取 ExifTool 版本
4. **读取元数据** - 测试完整和部分元数据读取
5. **写入元数据** - 验证元数据添加和修改
6. **删除元数据** - 测试元数据标签删除
7. **提取操作** - 缩略图和预览图提取
8. **错误处理** - 验证错误情况的正确处理

### 测试文件结构

```
tests/
├── fixtures/                    # 测试用的图片文件
├── output/                      # 测试输出文件
├── create-test-image.js         # 创建测试图片脚本
└── exiftool-simple.test.ts      # Bun 测试套件（主要测试文件）
```

## 开发

### 项目结构

```
packages/exiftool-server/
├── src/
│   └── index.ts          # 主要的MCP服务器实现
├── dist/                 # 构建输出目录
├── tests/               # 测试文件和资源
├── package.json          # 包配置
├── tsconfig.json         # TypeScript配置
└── README.md            # 本文档
```

### 依赖

- `@modelcontextprotocol/sdk` - MCP TypeScript SDK
- `exiftool-vendored` - ExifTool 的 Node.js 封装
- `zod` - 运行时类型验证
- `typescript` - TypeScript 支持

## 性能优化

- 使用单例模式管理 ExifTool 实例
- 支持并发处理多个文件
- 自动管理进程池
- 内存使用优化

## 故障排除

### 常见问题

1. **ExifTool 未找到**

   - 确保系统安装了 Perl
   - 检查 `exiftool-vendored` 是否正确安装

2. **权限问题**

   - 确保对文件有读写权限
   - 检查输出目录的写入权限

3. **不支持的文件格式**
   - 查看 ExifTool 支持的格式列表
   - 确认文件未损坏

### 调试模式

启用调试日志：

```bash
NODE_DEBUG=exiftool-vendored node dist/index.js
```

## License

MIT

## 相关链接

- [ExifTool 官网](https://exiftool.org/)
- [exiftool-vendored 文档](https://photostructure.github.io/exiftool-vendored.js/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
