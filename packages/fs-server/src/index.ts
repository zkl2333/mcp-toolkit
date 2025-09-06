#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { promises as fs } from 'node:fs';
import { resolve, dirname, join, relative, basename, extname } from 'node:path';
import { stat } from 'node:fs/promises';

/**
 * MCP 文件系统服务器
 * 提供文件系统操作工具，包括文件移动、复制、删除、读取等功能
 */

// 创建 MCP 服务器实例
const server = new McpServer({
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
