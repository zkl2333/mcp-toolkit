# MCP 文件系统服务器开发路线图

## 📍 当前状态

**已实现功能**:
- ✅ 基础文件操作（移动、复制、删除、重命名）
- ✅ 目录操作（创建、列出、权限修改）
- ✅ 链接操作（硬链接、软链接）
- ✅ 批量操作（批量移动、复制、删除）
- ✅ 文件信息获取
- ✅ 模块化架构重构

**当前问题**:
- ⚠️ TypeScript 类型兼容性问题需要修复

## 🔍 对比官方 filesystem 服务器

基于官方实现 `https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem`，以下是我们缺少的功能：

### 缺少的核心工具

#### 1. 文件内容操作
- [ ] `read_text_file` - 读取文本文件内容
  - 支持 head/tail 参数（读取首尾 N 行）
  - 编码处理
- [ ] `write_file` - 写入文件内容
  - 原子写入操作
  - 创建目录选项

#### 2. 文件编辑功能
- [ ] `edit_file` - 编辑文件内容
  - 基于 unified diff 格式
  - 支持部分内容替换

#### 3. 搜索功能
- [ ] `search_files` - 文件内容搜索
  - 支持正则表达式
  - glob 模式文件过滤
  - 递归目录搜索

#### 4. 高级目录功能
- [ ] `list_allowed_directories` - 列出允许访问的目录
- [ ] `directory_tree` - 显示目录树结构（可选功能）

### 缺少的安全特性

#### 1. 路径验证增强
- [ ] 实现官方的 `validatePath` 逻辑
  - 更严格的路径遍历检查
  - 符号链接目标验证
  - 父目录权限检查

#### 2. MCP Roots 协议支持
- [ ] `RootsListChangedNotification` 处理
- [ ] 动态允许目录更新
- [ ] 初始化时的根目录设置

### 缺少的实用工具

#### 1. 文件处理优化
- [ ] `tailFile` - 高效读取大文件末尾
- [ ] `headFile` - 高效读取大文件开头
- [ ] 内存友好的大文件处理

#### 2. 文件格式化
- [ ] `formatSize` - 文件大小格式化
- [ ] `normalizeLineEndings` - 行结束符标准化
- [ ] `createUnifiedDiff` - 创建统一差异格式

### 待实现功能列表

#### 立即需要（修复兼容性）
- [ ] 修复 MCP SDK API 兼容性问题
- [ ] 统一错误处理格式
- [ ] 基础功能测试

#### 核心功能补全
- [ ] `read_text_file` 工具实现
- [ ] `write_file` 工具实现  
- [ ] `edit_file` 工具实现
- [ ] `search_files` 工具实现
- [ ] `list_allowed_directories` 工具实现

#### 安全增强
- [ ] 路径验证逻辑增强
- [ ] MCP Roots 协议支持
- [ ] 符号链接安全检查改进

#### 性能优化
- [ ] 大文件处理优化（tailFile, headFile）
- [ ] 内存使用优化
- [ ] 错误处理改进

#### 附加功能
- [ ] 目录树显示
- [ ] 文件统计信息
- [ ] 更详细的错误信息

## 🎯 优先级排序

### P0 (必须完成)
1. 修复 TypeScript 兼容性问题
2. 实现 `read_text_file`
3. 实现 `write_file`
4. 实现 `search_files`

### P1 (重要功能)
1. 实现 `edit_file`
2. MCP Roots 协议支持
3. 路径验证增强
4. 大文件处理优化

### P2 (增强功能)
1. `list_allowed_directories`
2. 目录树显示
3. 更好的错误处理
4. 性能监控

## 📝 实现说明

每个功能的实现都应该：
- 保持现有的模块化架构
- 包含适当的安全检查
- 添加相应的测试用例


