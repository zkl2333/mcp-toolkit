#!/usr/bin/env node

/**
 * MCP 文件系统服务器 - 重构版本
 * 基于官方MCP服务器的最佳实践重构，提供企业级安全性和可维护性
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// 导入Schema配置
import { ToolConfigs } from "./schemas/tool-schemas.js";

// 导入安全模块
import { setSecurityConfig, validatePath } from "./lib/security.js";

// 导入文件操作模块
import {
  moveFile,
  copyFile,
  deleteFile,
  batchMoveFiles,
  batchCopyFiles,
  batchDeleteFiles,
} from "./lib/file-operations.js";

// 导入工具函数模块
import {
  handleAsyncOperation,
  listDirectory,
  createDirectory,
  getFileInfoDescription,
  createHardLink,
  createSoftLink,
  readSoftLink,
  renameFileOrDirectory,
  changeFilePermissions,
  formatBatchOperationResult,
} from "./lib/utils.js";

/**
 * 创建 MCP 服务器实例
 */
export const server = new McpServer({
  name: "filesystem-server",
  version: "0.2.0",
});

/**
 * 初始化安全配置
 * 可以通过环境变量或配置文件进行定制
 */
function initializeSecurity(): void {
  // 从环境变量获取允许的目录
  const allowedDirs = process.env.FS_ALLOWED_DIRS
    ? process.env.FS_ALLOWED_DIRS.split(";")
    : [process.cwd()]; // 默认允许当前工作目录

  const maxFileSize = process.env.FS_MAX_FILE_SIZE
    ? parseInt(process.env.FS_MAX_FILE_SIZE, 10)
    : 100 * 1024 * 1024; // 默认100MB

  setSecurityConfig({
    allowedDirectories: allowedDirs,
    maxFileSize,
    enableSymlinkValidation: true,
    enablePathTraversalProtection: true,
  });

  console.error(`🔒 安全配置已初始化，允许的目录: ${allowedDirs.join(", ")}`);
}

/**
 * 注册所有MCP工具
 */
function registerAllTools(): void {
  // 移动文件工具
  server.registerTool(
    "move-file",
    {
      title: ToolConfigs["move-file"].title,
      description: ToolConfigs["move-file"].description,
      inputSchema: ToolConfigs["move-file"].inputSchema,
    },
    async (
      { source, destination, overwrite, createDirs },
      extra
    ): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        const result = await moveFile(source, destination, {
          overwrite,
          createDirs,
        });
        return result.message;
      });
    }
  );

  // 复制文件工具
  server.registerTool(
    "copy-file",
    {
      title: ToolConfigs["copy-file"].title,
      description: ToolConfigs["copy-file"].description,
      inputSchema: ToolConfigs["copy-file"].inputSchema,
    },
    async (
      { source, destination, overwrite, createDirs },
      extra
    ): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        const result = await copyFile(source, destination, {
          overwrite,
          createDirs,
        });
        return result.message;
      });
    }
  );

  // 删除文件工具
  server.registerTool(
    "delete-file",
    {
      title: ToolConfigs["delete-file"].title,
      description: ToolConfigs["delete-file"].description,
      inputSchema: ToolConfigs["delete-file"].inputSchema,
    },
    async ({ path, force }, extra): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        const result = await deleteFile(path, {
          force,
        });
        return result.message;
      });
    }
  );

  // 列出目录工具
  server.registerTool(
    "list-directory",
    {
      title: ToolConfigs["list-directory"].title,
      description: ToolConfigs["list-directory"].description,
      inputSchema: ToolConfigs["list-directory"].inputSchema,
    },
    async ({ path, showHidden, details }, extra): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        return await listDirectory(path, showHidden, details);
      });
    }
  );

  // 创建目录工具
  server.registerTool(
    "create-directory",
    {
      title: ToolConfigs["create-directory"].title,
      description: ToolConfigs["create-directory"].description,
      inputSchema: ToolConfigs["create-directory"].inputSchema,
    },
    async ({ path, recursive }, extra): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        return await createDirectory(path, recursive);
      });
    }
  );

  // 获取文件信息工具
  server.registerTool(
    "file-info",
    {
      title: ToolConfigs["file-info"].title,
      description: ToolConfigs["file-info"].description,
      inputSchema: ToolConfigs["file-info"].inputSchema,
    },
    async ({ path }, extra): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        return await getFileInfoDescription(path);
      });
    }
  );

  // 创建硬链接工具
  server.registerTool(
    "create-hard-link",
    {
      title: ToolConfigs["create-hard-link"].title,
      description: ToolConfigs["create-hard-link"].description,
      inputSchema: ToolConfigs["create-hard-link"].inputSchema,
    },
    async (
      { source, destination, overwrite, createDirs },
      extra
    ): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        return await createHardLink(source, destination, overwrite, createDirs);
      });
    }
  );

  // 创建软链接工具
  server.registerTool(
    "create-symlink",
    {
      title: ToolConfigs["create-symlink"].title,
      description: ToolConfigs["create-symlink"].description,
      inputSchema: ToolConfigs["create-symlink"].inputSchema,
    },
    async (
      { target, linkPath, overwrite, createDirs },
      extra
    ): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        return await createSoftLink(target, linkPath, overwrite, createDirs);
      });
    }
  );

  // 读取软链接工具
  server.registerTool(
    "read-symlink",
    {
      title: ToolConfigs["read-symlink"].title,
      description: ToolConfigs["read-symlink"].description,
      inputSchema: ToolConfigs["read-symlink"].inputSchema,
    },
    async ({ linkPath }, extra): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        return await readSoftLink(linkPath);
      });
    }
  );

  // 重命名工具
  server.registerTool(
    "rename",
    {
      title: ToolConfigs["rename"].title,
      description: ToolConfigs["rename"].description,
      inputSchema: ToolConfigs["rename"].inputSchema,
    },
    async (
      { oldPath, newPath, overwrite, createDirs },
      extra
    ): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        return await renameFileOrDirectory(
          oldPath,
          newPath,
          overwrite,
          createDirs
        );
      });
    }
  );

  // 修改权限工具
  server.registerTool(
    "change-permissions",
    {
      title: ToolConfigs["change-permissions"].title,
      description: ToolConfigs["change-permissions"].description,
      inputSchema: ToolConfigs["change-permissions"].inputSchema,
    },
    async ({ path, mode }, extra): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        return await changeFilePermissions(path, mode);
      });
    }
  );

  // 批量移动工具
  server.registerTool(
    "batch-move",
    {
      title: ToolConfigs["batch-move"].title,
      description: ToolConfigs["batch-move"].description,
      inputSchema: ToolConfigs["batch-move"].inputSchema,
    },
    async (
      { sources, destination, overwrite, createDirs },
      extra
    ): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        const result = await batchMoveFiles(sources, destination, {
          overwrite,
          createDirs,
        });
        return formatBatchOperationResult(result, "移动");
      });
    }
  );

  // 批量复制工具
  server.registerTool(
    "batch-copy",
    {
      title: ToolConfigs["batch-copy"].title,
      description: ToolConfigs["batch-copy"].description,
      inputSchema: ToolConfigs["batch-copy"].inputSchema,
    },
    async (
      { sources, destination, overwrite, createDirs },
      extra
    ): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        const result = await batchCopyFiles(sources, destination, {
          overwrite,
          createDirs,
        });
        return formatBatchOperationResult(result, "复制");
      });
    }
  );

  // 批量删除工具
  server.registerTool(
    "batch-delete",
    {
      title: ToolConfigs["batch-delete"].title,
      description: ToolConfigs["batch-delete"].description,
      inputSchema: ToolConfigs["batch-delete"].inputSchema,
    },
    async ({ paths, force }, extra): Promise<CallToolResult> => {
      return handleAsyncOperation(async () => {
        const result = await batchDeleteFiles(paths, {
          force,
        });
        return formatBatchOperationResult(result, "删除");
      });
    }
  );

  console.error(`🔧 已注册 ${Object.keys(ToolConfigs).length} 个MCP工具`);
}

/**
 * 主函数：启动MCP服务器
 */
async function main(): Promise<void> {
  try {
    // 初始化安全配置
    initializeSecurity();

    // 注册所有工具
    registerAllTools();

    // 连接传输层
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("🚀 MCP文件系统服务器已启动 (重构版本)");
    console.error("📝 版本: 0.2.0");
    console.error("🔒 安全增强: 路径验证、符号链接保护、权限检查");
    console.error("📦 模块化架构: 分层设计、可维护性提升");
  } catch (error) {
    console.error("❌ 服务器启动失败:", error);
    process.exit(1);
  }
}

/**
 * 优雅关闭处理
 */
process.on("SIGINT", () => {
  console.error("\n🔄 正在关闭MCP文件系统服务器...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("\n🔄 正在关闭MCP文件系统服务器...");
  process.exit(0);
});

// 如果直接运行此文件，启动服务器
if (import.meta.main) {
  main().catch((error) => {
    console.error("启动失败:", error);
    process.exit(1);
  });
}
