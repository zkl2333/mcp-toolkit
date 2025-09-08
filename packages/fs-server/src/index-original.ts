#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { promises as fs } from 'node:fs';
import { resolve, dirname, join, relative, basename, extname } from 'node:path';
import { stat, link, symlink, readlink, chmod, lstat } from 'node:fs/promises';
import { platform } from 'node:os';

/**
 * MCP 文件系统服务器
 * 提供文件系统操作工具，包括文件移动、复制、删除、读取等功能
 */

/**
 * 创建符号链接的辅助函数
 * 在 Windows 上处理权限问题
 */
async function createSymbolicLink(target: string, linkPath: string): Promise<void> {
  const isWindows = platform() === 'win32';
  
  if (isWindows) {
    try {
      // 在 Windows 上，首先尝试使用相对路径
      const relativeTarget = relative(dirname(linkPath), target);
      await symlink(relativeTarget, linkPath);
    } catch (error: any) {
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        // 如果权限不足，尝试使用绝对路径
        try {
          await symlink(target, linkPath);
        } catch (secondError: any) {
          if (secondError.code === 'EPERM' || secondError.code === 'EACCES') {
            // 如果仍然权限不足，提供更详细的错误信息
            throw new Error(
              `在 Windows 上创建符号链接需要特殊权限。请尝试以下解决方案：\n` +
              `1. 以管理员身份运行程序\n` +
              `2. 启用开发者模式（Windows 10/11）\n` +
              `3. 使用 mklink 命令手动创建链接\n` +
              `原始错误：${secondError.message}`
            );
          }
          throw secondError;
        }
      } else {
        throw error;
      }
    }
  } else {
    // 在非 Windows 系统上直接创建
    await symlink(target, linkPath);
  }
}

// 创建 MCP 服务器实例
export const server = new McpServer({
  name: "filesystem-server",
  version: "0.1.0"
});

// 工具：移动文件
server.registerTool(
  "move-file",
  {
    title: "移动文件",
    description: "将文件从源路径移动到目标路径",
    inputSchema: {
      source: z.string().describe("源文件路径"),
      destination: z.string().describe("目标文件路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否创建目标目录").default(true)
    }
  },
  async ({ source, destination, overwrite, createDirs }) => {
    try {
      const resolvedSource = resolve(source);
      const resolvedDestination = resolve(destination);

      // 检查源文件是否存在
      try {
        await fs.access(resolvedSource);
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：源文件不存在 - ${resolvedSource}` 
          }],
          isError: true
        };
      }

      // 检查目标文件是否已存在
      if (!overwrite) {
        try {
          await fs.access(resolvedDestination);
          return {
            content: [{ 
              type: "text", 
              text: `错误：目标文件已存在，且未启用覆盖模式 - ${resolvedDestination}` 
            }],
            isError: true
          };
        } catch {
          // 目标文件不存在，可以继续
        }
      }

      // 如果需要，创建目标目录
      if (createDirs) {
        const targetDir = dirname(resolvedDestination);
        await fs.mkdir(targetDir, { recursive: true });
      }

      // 执行移动操作
      await fs.rename(resolvedSource, resolvedDestination);

      return {
        content: [{ 
          type: "text", 
          text: `✅ 文件移动成功：\n源文件：${resolvedSource}\n目标文件：${resolvedDestination}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 文件移动失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：复制文件
server.registerTool(
  "copy-file",
  {
    title: "复制文件",
    description: "将文件从源路径复制到目标路径",
    inputSchema: {
      source: z.string().describe("源文件路径"),
      destination: z.string().describe("目标文件路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否创建目标目录").default(true)
    }
  },
  async ({ source, destination, overwrite, createDirs }) => {
    try {
      const resolvedSource = resolve(source);
      const resolvedDestination = resolve(destination);

      // 检查源文件是否存在
      try {
        await fs.access(resolvedSource);
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：源文件不存在 - ${resolvedSource}` 
          }],
          isError: true
        };
      }

      // 检查目标文件是否已存在
      if (!overwrite) {
        try {
          await fs.access(resolvedDestination);
          return {
            content: [{ 
              type: "text", 
              text: `错误：目标文件已存在，且未启用覆盖模式 - ${resolvedDestination}` 
            }],
            isError: true
          };
        } catch {
          // 目标文件不存在，可以继续
        }
      }

      // 如果需要，创建目标目录
      if (createDirs) {
        const targetDir = dirname(resolvedDestination);
        await fs.mkdir(targetDir, { recursive: true });
      }

      // 执行复制操作
      await fs.copyFile(resolvedSource, resolvedDestination);

      return {
        content: [{ 
          type: "text", 
          text: `✅ 文件复制成功：\n源文件：${resolvedSource}\n目标文件：${resolvedDestination}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 文件复制失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：删除文件
server.registerTool(
  "delete-file",
  {
    title: "删除文件",
    description: "删除指定的文件",
    inputSchema: {
      path: z.string().describe("要删除的文件路径"),
      force: z.boolean().optional().describe("强制删除，不进行确认").default(false)
    }
  },
  async ({ path, force }) => {
    try {
      const resolvedPath = resolve(path);

      // 检查文件是否存在
      try {
        await fs.access(resolvedPath);
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：文件不存在 - ${resolvedPath}` 
          }],
          isError: true
        };
      }

      // 检查是否为目录
      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        return {
          content: [{ 
            type: "text", 
            text: `错误：指定路径是目录，请使用目录删除工具 - ${resolvedPath}` 
          }],
          isError: true
        };
      }

      // 删除文件
      await fs.unlink(resolvedPath);

      return {
        content: [{ 
          type: "text", 
          text: `✅ 文件删除成功：${resolvedPath}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 文件删除失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：列出目录内容
server.registerTool(
  "list-directory",
  {
    title: "列出目录内容",
    description: "列出指定目录中的文件和子目录",
    inputSchema: {
      path: z.string().describe("目录路径"),
      showHidden: z.boolean().optional().describe("是否显示隐藏文件").default(false),
      details: z.boolean().optional().describe("是否显示详细信息（大小、修改时间等）").default(false)
    }
  },
  async ({ path, showHidden, details }) => {
    try {
      const resolvedPath = resolve(path);

      // 检查目录是否存在
      try {
        await fs.access(resolvedPath);
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：目录不存在 - ${resolvedPath}` 
          }],
          isError: true
        };
      }

      // 检查是否为目录
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return {
          content: [{ 
            type: "text", 
            text: `错误：指定路径不是目录 - ${resolvedPath}` 
          }],
          isError: true
        };
      }

      // 读取目录内容
      const entries = await fs.readdir(resolvedPath);
      let filteredEntries = entries;

      // 过滤隐藏文件
      if (!showHidden) {
        filteredEntries = entries.filter(entry => !entry.startsWith('.'));
      }

      if (filteredEntries.length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: `目录为空：${resolvedPath}` 
          }]
        };
      }

      // 生成输出
      let output = `📁 目录内容：${resolvedPath}\n\n`;

      if (details) {
        // 显示详细信息
        const entryDetails = await Promise.all(
          filteredEntries.map(async (entry) => {
            const entryPath = join(resolvedPath, entry);
            try {
              const entryStats = await stat(entryPath);
              const type = entryStats.isDirectory() ? '📁' : '📄';
              const size = entryStats.isDirectory() ? '' : ` (${entryStats.size} bytes)`;
              const modified = entryStats.mtime.toLocaleString();
              return `${type} ${entry}${size} - 修改时间: ${modified}`;
            } catch {
              return `❓ ${entry} - 无法获取详细信息`;
            }
          })
        );
        output += entryDetails.join('\n');
      } else {
        // 简单列表
        output += filteredEntries.map(entry => `• ${entry}`).join('\n');
      }

      return {
        content: [{ 
          type: "text", 
          text: output 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 列出目录内容失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：创建目录
server.registerTool(
  "create-directory",
  {
    title: "创建目录",
    description: "创建新目录，支持递归创建父目录",
    inputSchema: {
      path: z.string().describe("要创建的目录路径"),
      recursive: z.boolean().optional().describe("是否递归创建父目录").default(true)
    }
  },
  async ({ path, recursive }) => {
    try {
      const resolvedPath = resolve(path);

      // 检查目录是否已存在
      try {
        await fs.access(resolvedPath);
        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory()) {
          return {
            content: [{ 
              type: "text", 
              text: `目录已存在：${resolvedPath}` 
            }]
          };
        } else {
          return {
            content: [{ 
              type: "text", 
              text: `错误：路径已存在且不是目录 - ${resolvedPath}` 
            }],
            isError: true
          };
        }
      } catch {
        // 目录不存在，可以创建
      }

      // 创建目录
      await fs.mkdir(resolvedPath, { recursive });

      return {
        content: [{ 
          type: "text", 
          text: `✅ 目录创建成功：${resolvedPath}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 目录创建失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：获取文件信息
server.registerTool(
  "file-info",
  {
    title: "获取文件信息",
    description: "获取文件或目录的详细信息",
    inputSchema: {
      path: z.string().describe("文件或目录路径")
    }
  },
  async ({ path }) => {
    try {
      const resolvedPath = resolve(path);

      // 检查文件是否存在
      try {
        await fs.access(resolvedPath);
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：文件或目录不存在 - ${resolvedPath}` 
          }],
          isError: true
        };
      }

      // 获取文件信息
      const stats = await fs.stat(resolvedPath);
      const isDirectory = stats.isDirectory();
      const isFile = stats.isFile();

      let output = `📋 文件信息：${resolvedPath}\n\n`;
      output += `类型：${isDirectory ? '目录' : isFile ? '文件' : '其他'}\n`;
      output += `大小：${stats.size} 字节\n`;
      output += `创建时间：${stats.birthtime.toLocaleString()}\n`;
      output += `修改时间：${stats.mtime.toLocaleString()}\n`;
      output += `访问时间：${stats.atime.toLocaleString()}\n`;
      output += `权限：${stats.mode.toString(8)}\n`;

      if (isFile) {
        output += `扩展名：${extname(resolvedPath) || '无'}\n`;
        output += `基本名称：${basename(resolvedPath)}\n`;
      }

      return {
        content: [{ 
          type: "text", 
          text: output 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 获取文件信息失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：创建硬链接
server.registerTool(
  "create-hard-link",
  {
    title: "创建硬链接",
    description: "为现有文件创建硬链接",
    inputSchema: {
      source: z.string().describe("源文件路径"),
      destination: z.string().describe("硬链接目标路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否创建目标目录").default(true)
    }
  },
  async ({ source, destination, overwrite, createDirs }) => {
    try {
      const resolvedSource = resolve(source);
      const resolvedDestination = resolve(destination);

      // 检查源文件是否存在
      try {
        await fs.access(resolvedSource);
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：源文件不存在 - ${resolvedSource}` 
          }],
          isError: true
        };
      }

      // 检查源文件是否为目录（硬链接不能链接到目录）
      const sourceStats = await fs.stat(resolvedSource);
      if (sourceStats.isDirectory()) {
        return {
          content: [{ 
            type: "text", 
            text: `错误：硬链接不能链接到目录 - ${resolvedSource}` 
          }],
          isError: true
        };
      }

      // 检查目标文件是否已存在
      if (!overwrite) {
        try {
          await fs.access(resolvedDestination);
          return {
            content: [{ 
              type: "text", 
              text: `错误：目标文件已存在，且未启用覆盖模式 - ${resolvedDestination}` 
            }],
            isError: true
          };
        } catch {
          // 目标文件不存在，可以继续
        }
      }

      // 如果需要，创建目标目录
      if (createDirs) {
        const targetDir = dirname(resolvedDestination);
        await fs.mkdir(targetDir, { recursive: true });
      }

      // 如果目标文件存在且启用覆盖，先删除
      if (overwrite) {
        try {
          await fs.unlink(resolvedDestination);
        } catch {
          // 忽略删除错误，可能文件不存在
        }
      }

      // 创建硬链接
      await link(resolvedSource, resolvedDestination);

      return {
        content: [{ 
          type: "text", 
          text: `✅ 硬链接创建成功：\n源文件：${resolvedSource}\n硬链接：${resolvedDestination}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 硬链接创建失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：创建软链接
server.registerTool(
  "create-symlink",
  {
    title: "创建软链接",
    description: "创建符号链接（软链接）",
    inputSchema: {
      target: z.string().describe("链接目标路径"),
      linkPath: z.string().describe("软链接路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否创建目标目录").default(true)
    }
  },
  async ({ target, linkPath, overwrite, createDirs }) => {
    try {
      const resolvedTarget = resolve(target);
      const resolvedLinkPath = resolve(linkPath);

      // 检查目标是否存在（软链接可以链接到不存在的文件）
      let targetExists = true;
      try {
        await fs.access(resolvedTarget);
      } catch {
        targetExists = false;
      }

      // 检查链接路径是否已存在
      if (!overwrite) {
        try {
          await fs.access(resolvedLinkPath);
          return {
            content: [{ 
              type: "text", 
              text: `错误：链接路径已存在，且未启用覆盖模式 - ${resolvedLinkPath}` 
            }],
            isError: true
          };
        } catch {
          // 链接路径不存在，可以继续
        }
      }

      // 如果需要，创建目标目录
      if (createDirs) {
        const targetDir = dirname(resolvedLinkPath);
        await fs.mkdir(targetDir, { recursive: true });
      }

      // 如果链接路径存在且启用覆盖，先删除
      if (overwrite) {
        try {
          await fs.unlink(resolvedLinkPath);
        } catch {
          // 忽略删除错误，可能文件不存在
        }
      }

      // 创建软链接
      await createSymbolicLink(resolvedTarget, resolvedLinkPath);

      const targetStatus = targetExists ? "存在" : "不存在";
      return {
        content: [{ 
          type: "text", 
          text: `✅ 软链接创建成功：\n目标：${resolvedTarget} (${targetStatus})\n软链接：${resolvedLinkPath}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 软链接创建失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：读取软链接
server.registerTool(
  "read-symlink",
  {
    title: "读取软链接",
    description: "读取软链接的目标路径",
    inputSchema: {
      linkPath: z.string().describe("软链接路径")
    }
  },
  async ({ linkPath }) => {
    try {
      const resolvedLinkPath = resolve(linkPath);

      // 检查链接是否存在
      try {
        await fs.access(resolvedLinkPath);
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：链接不存在 - ${resolvedLinkPath}` 
          }],
          isError: true
        };
      }

      // 检查是否为软链接
      const stats = await lstat(resolvedLinkPath);
      if (!stats.isSymbolicLink()) {
        return {
          content: [{ 
            type: "text", 
            text: `错误：指定路径不是软链接 - ${resolvedLinkPath}` 
          }],
          isError: true
        };
      }

      // 读取软链接目标
      const target = await readlink(resolvedLinkPath);

      return {
        content: [{ 
          type: "text", 
          text: `🔗 软链接信息：\n链接路径：${resolvedLinkPath}\n目标路径：${target}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 读取软链接失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：重命名文件或目录
server.registerTool(
  "rename",
  {
    title: "重命名文件或目录",
    description: "重命名文件或目录",
    inputSchema: {
      oldPath: z.string().describe("原路径"),
      newPath: z.string().describe("新路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否创建目标目录").default(true)
    }
  },
  async ({ oldPath, newPath, overwrite, createDirs }) => {
    try {
      const resolvedOldPath = resolve(oldPath);
      const resolvedNewPath = resolve(newPath);

      // 检查原路径是否存在
      try {
        await fs.access(resolvedOldPath);
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：原路径不存在 - ${resolvedOldPath}` 
          }],
          isError: true
        };
      }

      // 检查新路径是否已存在
      if (!overwrite) {
        try {
          await fs.access(resolvedNewPath);
          return {
            content: [{ 
              type: "text", 
              text: `错误：新路径已存在，且未启用覆盖模式 - ${resolvedNewPath}` 
            }],
            isError: true
          };
        } catch {
          // 新路径不存在，可以继续
        }
      }

      // 如果需要，创建目标目录
      if (createDirs) {
        const targetDir = dirname(resolvedNewPath);
        await fs.mkdir(targetDir, { recursive: true });
      }

      // 如果新路径存在且启用覆盖，先删除
      if (overwrite) {
        try {
          const newStats = await fs.stat(resolvedNewPath);
          if (newStats.isDirectory()) {
            await fs.rmdir(resolvedNewPath);
          } else {
            await fs.unlink(resolvedNewPath);
          }
        } catch {
          // 忽略删除错误，可能文件不存在
        }
      }

      // 执行重命名
      await fs.rename(resolvedOldPath, resolvedNewPath);

      return {
        content: [{ 
          type: "text", 
          text: `✅ 重命名成功：\n原路径：${resolvedOldPath}\n新路径：${resolvedNewPath}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 重命名失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：修改文件权限
server.registerTool(
  "change-permissions",
  {
    title: "修改文件权限",
    description: "修改文件或目录的权限",
    inputSchema: {
      path: z.string().describe("文件或目录路径"),
      mode: z.string().describe("权限模式（八进制字符串，如 '755' 或 '644'）")
    }
  },
  async ({ path, mode }) => {
    try {
      const resolvedPath = resolve(path);

      // 检查文件是否存在
      try {
        await fs.access(resolvedPath);
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：文件或目录不存在 - ${resolvedPath}` 
          }],
          isError: true
        };
      }

      // 解析权限模式
      let numericMode: number;
      try {
        numericMode = parseInt(mode, 8);
        if (isNaN(numericMode) || numericMode < 0 || numericMode > 0o777) {
          throw new Error("无效的权限模式");
        }
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：无效的权限模式 '${mode}'，请使用八进制格式（如 '755', '644'）` 
          }],
          isError: true
        };
      }

      // 修改权限
      await chmod(resolvedPath, numericMode);

      return {
        content: [{ 
          type: "text", 
          text: `✅ 权限修改成功：\n路径：${resolvedPath}\n新权限：${mode} (${numericMode.toString(8)})` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 权限修改失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：批量移动文件
server.registerTool(
  "batch-move",
  {
    title: "批量移动文件",
    description: "批量移动多个文件或目录",
    inputSchema: {
      sources: z.array(z.string()).describe("源文件路径数组"),
      destination: z.string().describe("目标目录路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否创建目标目录").default(true)
    }
  },
  async ({ sources, destination, overwrite, createDirs }) => {
    try {
      const resolvedDestination = resolve(destination);
      const results: string[] = [];
      const errors: string[] = [];

      // 如果需要，创建目标目录
      if (createDirs) {
        await fs.mkdir(resolvedDestination, { recursive: true });
      }

      // 检查目标目录是否存在
      try {
        const destStats = await fs.stat(resolvedDestination);
        if (!destStats.isDirectory()) {
          return {
            content: [{ 
              type: "text", 
              text: `错误：目标路径不是目录 - ${resolvedDestination}` 
            }],
            isError: true
          };
        }
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：目标目录不存在 - ${resolvedDestination}` 
          }],
          isError: true
        };
      }

      // 批量处理每个源文件
      for (const source of sources) {
        try {
          const resolvedSource = resolve(source);
          const fileName = basename(resolvedSource);
          const targetPath = join(resolvedDestination, fileName);

          // 检查源文件是否存在
          try {
            await fs.access(resolvedSource);
          } catch {
            errors.push(`源文件不存在: ${resolvedSource}`);
            continue;
          }

          // 检查目标文件是否已存在
          if (!overwrite) {
            try {
              await fs.access(targetPath);
              errors.push(`目标文件已存在: ${targetPath}`);
              continue;
            } catch {
              // 目标文件不存在，可以继续
            }
          }

          // 如果目标文件存在且启用覆盖，先删除
          if (overwrite) {
            try {
              await fs.unlink(targetPath);
            } catch {
              // 忽略删除错误，可能文件不存在
            }
          }

          // 执行移动
          await fs.rename(resolvedSource, targetPath);
          results.push(`${resolvedSource} -> ${targetPath}`);
        } catch (error) {
          errors.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      let output = `📦 批量移动完成\n\n`;
      if (results.length > 0) {
        output += `✅ 成功移动 (${results.length} 个):\n`;
        output += results.map(r => `  • ${r}`).join('\n') + '\n\n';
      }
      if (errors.length > 0) {
        output += `❌ 失败 (${errors.length} 个):\n`;
        output += errors.map(e => `  • ${e}`).join('\n');
      }

      return {
        content: [{ 
          type: "text", 
          text: output 
        }],
        isError: errors.length > 0 && results.length === 0
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 批量移动失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：批量复制文件
server.registerTool(
  "batch-copy",
  {
    title: "批量复制文件",
    description: "批量复制多个文件或目录",
    inputSchema: {
      sources: z.array(z.string()).describe("源文件路径数组"),
      destination: z.string().describe("目标目录路径"),
      overwrite: z.boolean().optional().describe("是否覆盖已存在的文件").default(false),
      createDirs: z.boolean().optional().describe("是否创建目标目录").default(true)
    }
  },
  async ({ sources, destination, overwrite, createDirs }) => {
    try {
      const resolvedDestination = resolve(destination);
      const results: string[] = [];
      const errors: string[] = [];

      // 如果需要，创建目标目录
      if (createDirs) {
        await fs.mkdir(resolvedDestination, { recursive: true });
      }

      // 检查目标目录是否存在
      try {
        const destStats = await fs.stat(resolvedDestination);
        if (!destStats.isDirectory()) {
          return {
            content: [{ 
              type: "text", 
              text: `错误：目标路径不是目录 - ${resolvedDestination}` 
            }],
            isError: true
          };
        }
      } catch {
        return {
          content: [{ 
            type: "text", 
            text: `错误：目标目录不存在 - ${resolvedDestination}` 
          }],
          isError: true
        };
      }

      // 批量处理每个源文件
      for (const source of sources) {
        try {
          const resolvedSource = resolve(source);
          const fileName = basename(resolvedSource);
          const targetPath = join(resolvedDestination, fileName);

          // 检查源文件是否存在
          try {
            await fs.access(resolvedSource);
          } catch {
            errors.push(`源文件不存在: ${resolvedSource}`);
            continue;
          }

          // 检查目标文件是否已存在
          if (!overwrite) {
            try {
              await fs.access(targetPath);
              errors.push(`目标文件已存在: ${targetPath}`);
              continue;
            } catch {
              // 目标文件不存在，可以继续
            }
          }

          // 执行复制
          await fs.copyFile(resolvedSource, targetPath);
          results.push(`${resolvedSource} -> ${targetPath}`);
        } catch (error) {
          errors.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      let output = `📦 批量复制完成\n\n`;
      if (results.length > 0) {
        output += `✅ 成功复制 (${results.length} 个):\n`;
        output += results.map(r => `  • ${r}`).join('\n') + '\n\n';
      }
      if (errors.length > 0) {
        output += `❌ 失败 (${errors.length} 个):\n`;
        output += errors.map(e => `  • ${e}`).join('\n');
      }

      return {
        content: [{ 
          type: "text", 
          text: output 
        }],
        isError: errors.length > 0 && results.length === 0
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 批量复制失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具：批量删除文件
server.registerTool(
  "batch-delete",
  {
    title: "批量删除文件",
    description: "批量删除多个文件或目录",
    inputSchema: {
      paths: z.array(z.string()).describe("要删除的文件路径数组"),
      force: z.boolean().optional().describe("强制删除，不进行确认").default(false)
    }
  },
  async ({ paths, force }) => {
    try {
      const results: string[] = [];
      const errors: string[] = [];

      // 批量处理每个文件
      for (const path of paths) {
        try {
          const resolvedPath = resolve(path);

          // 检查文件是否存在
          try {
            await fs.access(resolvedPath);
          } catch {
            errors.push(`文件不存在: ${resolvedPath}`);
            continue;
          }

          // 获取文件信息
          const stats = await fs.stat(resolvedPath);
          
          if (stats.isDirectory()) {
            // 删除目录
            await fs.rmdir(resolvedPath);
            results.push(`目录已删除: ${resolvedPath}`);
          } else {
            // 删除文件
            await fs.unlink(resolvedPath);
            results.push(`文件已删除: ${resolvedPath}`);
          }
        } catch (error) {
          errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      let output = `🗑️ 批量删除完成\n\n`;
      if (results.length > 0) {
        output += `✅ 成功删除 (${results.length} 个):\n`;
        output += results.map(r => `  • ${r}`).join('\n') + '\n\n';
      }
      if (errors.length > 0) {
        output += `❌ 失败 (${errors.length} 个):\n`;
        output += errors.map(e => `  • ${e}`).join('\n');
      }

      return {
        content: [{ 
          type: "text", 
          text: output 
        }],
        isError: errors.length > 0 && results.length === 0
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `❌ 批量删除失败：${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 主函数：启动MCP服务器
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🚀 MCP文件系统服务器已启动");
  } catch (error) {
    console.error("❌ 服务器启动失败:", error);
    process.exit(1);
  }
}

// 如果直接运行此文件，启动服务器
if (import.meta.main) {
  main().catch((error) => {
    console.error("启动失败:", error);
    process.exit(1);
  });
}
