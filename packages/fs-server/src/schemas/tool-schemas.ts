/**
 * MCP 工具参数 Schema 定义
 * 基于官方MCP服务器的最佳实践，增强了参数验证和描述
 */

import { z } from "zod";

// 基础路径验证
const PathSchema = z.string()
  .min(1, "路径不能为空")
  .describe("文件或目录路径");

const OptionalBooleanSchema = (description: string, defaultValue: boolean = false) =>
  z.boolean()
    .optional()
    .describe(description)
    .default(defaultValue);

// 移动文件参数 Schema
export const MoveFileArgsSchema = z.object({
  source: PathSchema.describe("源文件路径"),
  destination: PathSchema.describe("目标文件路径"),
  overwrite: OptionalBooleanSchema("是否覆盖已存在的文件", false),
  createDirs: OptionalBooleanSchema("是否自动创建目标目录", true)
}).describe("移动文件工具参数");

// 复制文件参数 Schema
export const CopyFileArgsSchema = z.object({
  source: PathSchema.describe("源文件路径"),
  destination: PathSchema.describe("目标文件路径"),
  overwrite: OptionalBooleanSchema("是否覆盖已存在的文件", false),
  createDirs: OptionalBooleanSchema("是否自动创建目标目录", true)
}).describe("复制文件工具参数");

// 删除文件参数 Schema
export const DeleteFileArgsSchema = z.object({
  path: PathSchema.describe("要删除的文件路径"),
  force: OptionalBooleanSchema("强制删除，不进行确认", false)
}).describe("删除文件工具参数");

// 列出目录参数 Schema
export const ListDirectoryArgsSchema = z.object({
  path: PathSchema.describe("目录路径"),
  showHidden: OptionalBooleanSchema("是否显示隐藏文件", false),
  details: OptionalBooleanSchema("是否显示详细信息（大小、修改时间等）", false)
}).describe("列出目录内容工具参数");

// 创建目录参数 Schema
export const CreateDirectoryArgsSchema = z.object({
  path: PathSchema.describe("要创建的目录路径"),
  recursive: OptionalBooleanSchema("是否递归创建父目录", true)
}).describe("创建目录工具参数");

// 获取文件信息参数 Schema
export const FileInfoArgsSchema = z.object({
  path: PathSchema.describe("文件或目录路径")
}).describe("获取文件信息工具参数");

// 创建硬链接参数 Schema
export const CreateHardLinkArgsSchema = z.object({
  source: PathSchema.describe("源文件路径"),
  destination: PathSchema.describe("硬链接目标路径"),
  overwrite: OptionalBooleanSchema("是否覆盖已存在的文件", false),
  createDirs: OptionalBooleanSchema("是否自动创建目标目录", true)
}).describe("创建硬链接工具参数");

// 创建软链接参数 Schema  
export const CreateSymlinkArgsSchema = z.object({
  target: PathSchema.describe("链接目标路径"),
  linkPath: PathSchema.describe("软链接路径"),
  overwrite: OptionalBooleanSchema("是否覆盖已存在的文件", false),
  createDirs: OptionalBooleanSchema("是否自动创建目标目录", true)
}).describe("创建软链接工具参数");

// 读取软链接参数 Schema
export const ReadSymlinkArgsSchema = z.object({
  linkPath: PathSchema.describe("软链接路径")
}).describe("读取软链接工具参数");

// 重命名参数 Schema
export const RenameArgsSchema = z.object({
  oldPath: PathSchema.describe("原路径"),
  newPath: PathSchema.describe("新路径"),
  overwrite: OptionalBooleanSchema("是否覆盖已存在的文件", false),
  createDirs: OptionalBooleanSchema("是否自动创建目标目录", true)
}).describe("重命名文件或目录工具参数");

// 修改权限参数 Schema
export const ChangePermissionsArgsSchema = z.object({
  path: PathSchema.describe("文件或目录路径"),
  mode: z.string()
    .regex(/^[0-7]{3}$/, "权限模式必须是3位八进制数字，如 '755' 或 '644'")
    .describe("权限模式（八进制字符串，如 '755' 或 '644'）")
}).describe("修改文件权限工具参数");

// 批量移动参数 Schema
export const BatchMoveArgsSchema = z.object({
  sources: z.array(PathSchema)
    .min(1, "至少需要一个源文件路径")
    .describe("源文件路径数组"),
  destination: PathSchema.describe("目标目录路径"),
  overwrite: OptionalBooleanSchema("是否覆盖已存在的文件", false),
  createDirs: OptionalBooleanSchema("是否自动创建目标目录", true)
}).describe("批量移动文件工具参数");

// 批量复制参数 Schema
export const BatchCopyArgsSchema = z.object({
  sources: z.array(PathSchema)
    .min(1, "至少需要一个源文件路径")
    .describe("源文件路径数组"),
  destination: PathSchema.describe("目标目录路径"),
  overwrite: OptionalBooleanSchema("是否覆盖已存在的文件", false),
  createDirs: OptionalBooleanSchema("是否自动创建目标目录", true)
}).describe("批量复制文件工具参数");

// 批量删除参数 Schema
export const BatchDeleteArgsSchema = z.object({
  paths: z.array(PathSchema)
    .min(1, "至少需要一个文件路径")
    .describe("要删除的文件路径数组"),
  force: OptionalBooleanSchema("强制删除，不进行确认", false)
}).describe("批量删除文件工具参数");

// 工具配置类型，包含Schema和描述信息
export interface ToolConfig {
  title: string;
  description: string;
  inputSchema: any; // 使用原始对象格式而不是ZodSchema
}

// 所有工具的配置映射
export const ToolConfigs: Record<string, ToolConfig> = {
  "move-file": {
    title: "移动文件",
    description: "将文件从源路径移动到目标路径，支持覆盖和自动创建目录",
    inputSchema: {
      source: z.string().describe("源文件路径"),
      destination: z.string().describe("目标文件路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否自动创建目标目录").default(true)
    }
  },
  "copy-file": {
    title: "复制文件", 
    description: "将文件从源路径复制到目标路径，支持覆盖和自动创建目录",
    inputSchema: {
      source: z.string().describe("源文件路径"),
      destination: z.string().describe("目标文件路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否自动创建目标目录").default(true)
    }
  },
  "delete-file": {
    title: "删除文件",
    description: "安全删除指定文件，包含存在性检查",
    inputSchema: {
      path: z.string().describe("要删除的文件路径"),
      force: z.boolean().optional().describe("强制删除，不进行确认").default(false)
    }
  },
  "list-directory": {
    title: "列出目录内容",
    description: "列出指定目录中的文件和子目录，支持显示隐藏文件和详细信息",
    inputSchema: {
      path: z.string().describe("目录路径"),
      showHidden: z.boolean().optional().describe("是否显示隐藏文件").default(false),
      details: z.boolean().optional().describe("是否显示详细信息（大小、修改时间等）").default(false)
    }
  },
  "create-directory": {
    title: "创建目录",
    description: "创建新目录，支持递归创建父目录",
    inputSchema: {
      path: z.string().describe("要创建的目录路径"),
      recursive: z.boolean().optional().describe("是否递归创建父目录").default(true)
    }
  },
  "file-info": {
    title: "获取文件信息",
    description: "获取文件或目录的详细信息，包括大小、权限、时间戳等",
    inputSchema: {
      path: z.string().describe("文件或目录路径")
    }
  },
  "create-hard-link": {
    title: "创建硬链接",
    description: "为现有文件创建硬链接，不能链接到目录",
    inputSchema: {
      source: z.string().describe("源文件路径"),
      destination: z.string().describe("硬链接目标路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否自动创建目标目录").default(true)
    }
  },
  "create-symlink": {
    title: "创建软链接",
    description: "创建符号链接（软链接），支持链接到不存在的文件，在Windows上自动处理权限问题",
    inputSchema: {
      target: z.string().describe("链接目标路径"),
      linkPath: z.string().describe("软链接路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否自动创建目标目录").default(true)
    }
  },
  "read-symlink": {
    title: "读取软链接",
    description: "读取软链接的目标路径，验证链接的有效性",
    inputSchema: {
      linkPath: z.string().describe("软链接路径")
    }
  },
  "rename": {
    title: "重命名文件或目录",
    description: "重命名文件或目录，支持移动到不同目录",
    inputSchema: {
      oldPath: z.string().describe("原路径"),
      newPath: z.string().describe("新路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否自动创建目标目录").default(true)
    }
  },
  "change-permissions": {
    title: "修改文件权限",
    description: "修改文件或目录的权限，支持八进制权限模式",
    inputSchema: {
      path: z.string().describe("文件或目录路径"),
      mode: z.string()
        .regex(/^[0-7]{3}$/, "权限模式必须是3位八进制数字，如 '755' 或 '644'")
        .describe("权限模式（八进制字符串，如 '755' 或 '644'）")
    }
  },
  "batch-move": {
    title: "批量移动文件",
    description: "批量移动多个文件或目录到目标目录，提供详细的成功/失败报告",
    inputSchema: {
      sources: z.array(z.string()).min(1, "至少需要一个源文件路径").describe("源文件路径数组"),
      destination: z.string().describe("目标目录路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否自动创建目标目录").default(true)
    }
  },
  "batch-copy": {
    title: "批量复制文件",
    description: "批量复制多个文件或目录到目标目录，提供详细的成功/失败报告",
    inputSchema: {
      sources: z.array(z.string()).min(1, "至少需要一个源文件路径").describe("源文件路径数组"),
      destination: z.string().describe("目标目录路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否自动创建目标目录").default(true)
    }
  },
  "batch-delete": {
    title: "批量删除文件",
    description: "批量删除多个文件或目录，支持强制删除模式，提供详细的成功/失败报告",
    inputSchema: {
      paths: z.array(z.string()).min(1, "至少需要一个文件路径").describe("要删除的文件路径数组"),
      force: z.boolean().optional().describe("强制删除，不进行确认").default(false)
    }
  }
};
