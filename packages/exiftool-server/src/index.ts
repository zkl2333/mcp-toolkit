import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exiftool, ExifDateTime } from "exiftool-vendored";
import path from "path";
import { existsSync, mkdirSync } from "fs";

// 辅助函数：验证文件路径
function validateFilePath(filePath: string): string {
  const resolvedPath = path.resolve(filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`文件不存在: ${resolvedPath}`);
  }

  return resolvedPath;
}

// 辅助函数：验证输出路径
function validateOutputPath(outputPath: string, overwrite: boolean): string {
  const resolvedPath = path.resolve(outputPath);

  // 确保父目录存在
  const dir = path.dirname(resolvedPath);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (e) {
      throw new Error(`无法创建输出目录: ${dir}`);
    }
  }

  if (existsSync(resolvedPath) && !overwrite) {
    throw new Error(
      `输出文件已存在: ${resolvedPath}。使用 overwrite: true 来覆盖`
    );
  }

  return resolvedPath;
}

// 辅助函数：格式化元数据输出
function formatMetadata(tags: any): any {
  const formatted: any = {};

  for (const [key, value] of Object.entries(tags)) {
    if (value === null || value === undefined) {
      continue;
    }

    // 处理日期时间对象
    if (value instanceof ExifDateTime) {
      formatted[key] = {
        rawValue: value.rawValue,
        toDate: value.toDate()?.toISOString(),
        zone: value.zone || "UnsetZone",
        year: value.year,
        month: value.month,
        day: value.day,
        hour: value.hour,
        minute: value.minute,
        second: value.second,
      };
    } else {
      formatted[key] = value;
    }
  }

  return formatted;
}

// 统一的错误返回
type McpTextContent = { type: "text"; text: string };
function errorResult(message: string): {
  content: McpTextContent[];
  isError: true;
} {
  const entry: McpTextContent = { type: "text", text: `错误: ${message}` };
  return { content: [entry], isError: true };
}

// 尝试进行二次确认（支持的客户端会弹出确认表单）
async function confirmSensitiveAction(message: string): Promise<boolean> {
  // 在未连接客户端、测试或不支持 elicitation 的环境下，不阻塞（直接放行）
  try {
    // @ts-ignore 访问底层 server 能力
    const elicit = (server as any)?.server?.elicitInput;
    if (typeof elicit !== "function") return true;

    const result = await elicit({
      message,
      requestedSchema: {
        type: "object",
        properties: {
          confirm: {
            type: "boolean",
            title: "确认执行",
            description: "这是敏感操作，将修改或写入文件。请勾选以继续。",
          },
        },
        required: ["confirm"],
      },
    });

    return result.action === "accept" && !!(result as any)?.content?.confirm;
  } catch {
    return true;
  }
}

// 创建 MCP 服务器
export const server = new McpServer(
  {
    name: "exiftool-server",
    version: "0.1.0",
  },
  {
    debouncedNotificationMethods: [
      "notifications/tools/list_changed",
      "notifications/resources/list_changed",
      "notifications/prompts/list_changed",
    ],
  }
);

// 注册工具：读取元数据
server.registerTool(
  "read-metadata",
  {
    title: "读取元数据",
    description:
      "读取图片或视频文件的元数据；亦支持文档与可执行文件（EXE/DLL/SYS 等 PE），覆盖 EXIF、IPTC、XMP 等标准，支持按标签筛选并返回结构化结果",
    inputSchema: {
      filePath: z.string().describe("要读取元数据的文件路径"),
      tags: z
        .array(z.string())
        .optional()
        .describe("要读取的特定标签列表（可选，默认读取所有）"),
    },
  },
  async ({ filePath, tags }) => {
    try {
      const validatedPath = validateFilePath(filePath);

      const metadata = await exiftool.read(validatedPath);
      const formatted = formatMetadata(metadata);

      // 如果指定了特定标签，只返回这些标签
      if (tags && tags.length > 0) {
        const filtered: any = {};
        tags.forEach((tag) => {
          if (tag in formatted) {
            filtered[tag] = formatted[tag];
          }
        });

        return {
          content: [
            {
              type: "text",
              text: `成功读取文件元数据: ${validatedPath}\n\n请求的标签:\n${JSON.stringify(
                filtered,
                null,
                2
              )}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `成功读取文件元数据: ${validatedPath}\n\n所有标签:\n${JSON.stringify(
              formatted,
              null,
              2
            )}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult(message);
    }
  }
);

// 注册工具：写入元数据
server.registerTool(
  "write-metadata",
  {
    title: "写入元数据",
    description:
      "写入或修改文件元数据（支持 EXIF/IPTC/XMP；部分非图片文件仅在可用键上生效）。建议先读取并校验标签后再写入，必要时结合 overwrite 策略",
    inputSchema: {
      filePath: z.string().describe("要写入元数据的文件路径"),
      metadata: z.record(z.any()).describe("要写入的元数据键值对"),
      overwrite: z.boolean().default(false).describe("是否覆盖现有元数据"),
    },
  },
  async ({ filePath, metadata, overwrite }) => {
    try {
      const validatedPath = validateFilePath(filePath);
      const shouldOverwrite = overwrite === true;
      // 二次确认
      const keys = Object.keys(metadata || {});
      const preview =
        keys.slice(0, 8).join(", ") + (keys.length > 8 ? "..." : "");
      const confirmed = await confirmSensitiveAction(
        `写入元数据到文件:\n${validatedPath}\n标签数: ${keys.length}${
          keys.length ? `\n标签: ${preview}` : ""
        }\n覆盖策略: ${
          shouldOverwrite ? "开启 (overwrite=true)" : "关闭 (overwrite=false)"
        }`
      );
      if (!confirmed) {
        return { content: [{ type: "text", text: "操作已取消" }] };
      }
      if (!shouldOverwrite) {
        try {
          const current = await exiftool.read(validatedPath);
          const conflicting = Object.keys(metadata || {}).filter(
            (k) => k in (current as Record<string, unknown>)
          );
          if (conflicting.length > 0) {
            return errorResult(
              `目标文件已存在以下标签，未启用 overwrite: ${conflicting.join(
                ", "
              )}`
            );
          }
        } catch {
          // 读取当前元数据失败时不阻断写入，仅在无法读取时忽略覆盖检查
        }
      }

      await exiftool.write(validatedPath, metadata);

      return {
        content: [
          {
            type: "text",
            text: `成功写入元数据到文件: ${validatedPath}\n\n写入的数据:\n${JSON.stringify(
              metadata,
              null,
              2
            )}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult(message);
    }
  }
);

// 注册工具：提取缩略图
server.registerTool(
  "extract-thumbnail",
  {
    title: "提取缩略图",
    description:
      "从图片或视频文件中提取嵌入的缩略图（若存在）。支持常见图片与部分视频容器",
    inputSchema: {
      filePath: z.string().describe("源文件路径"),
      outputPath: z.string().describe("缩略图输出路径"),
      overwrite: z.boolean().default(false).describe("是否覆盖现有文件"),
    },
  },
  async ({ filePath, outputPath, overwrite }) => {
    try {
      const validatedInputPath = validateFilePath(filePath);
      const validatedOutputPath = validateOutputPath(outputPath, overwrite);
      // 二次确认
      const confirmed = await confirmSensitiveAction(
        `提取缩略图\n源文件: ${validatedInputPath}\n输出文件: ${validatedOutputPath}\n覆盖策略: ${
          overwrite ? "开启" : "关闭"
        }`
      );
      if (!confirmed) {
        return { content: [{ type: "text", text: "操作已取消" }] };
      }

      await exiftool.extractThumbnail(validatedInputPath, validatedOutputPath);

      return {
        content: [
          {
            type: "text",
            text: `成功提取缩略图:\n源文件: ${validatedInputPath}\n输出文件: ${validatedOutputPath}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult(message);
    }
  }
);

// 注册工具：提取预览图
server.registerTool(
  "extract-preview",
  {
    title: "提取预览图",
    description:
      "从图片或视频文件中提取嵌入的预览图（通常比缩略图更大，若存在）",
    inputSchema: {
      filePath: z.string().describe("源文件路径"),
      outputPath: z.string().describe("预览图输出路径"),
      overwrite: z.boolean().default(false).describe("是否覆盖现有文件"),
    },
  },
  async ({ filePath, outputPath, overwrite }) => {
    try {
      const validatedInputPath = validateFilePath(filePath);
      const validatedOutputPath = validateOutputPath(outputPath, overwrite);
      // 二次确认
      const confirmed = await confirmSensitiveAction(
        `提取预览图\n源文件: ${validatedInputPath}\n输出文件: ${validatedOutputPath}\n覆盖策略: ${
          overwrite ? "开启" : "关闭"
        }`
      );
      if (!confirmed) {
        return { content: [{ type: "text", text: "操作已取消" }] };
      }

      await exiftool.extractPreview(validatedInputPath, validatedOutputPath);

      return {
        content: [
          {
            type: "text",
            text: `成功提取预览图:\n源文件: ${validatedInputPath}\n输出文件: ${validatedOutputPath}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult(message);
    }
  }
);

// 注册工具：删除元数据
server.registerTool(
  "delete-metadata",
  {
    title: "删除元数据",
    description:
      "删除文件中指定的元数据标签（通过将标签写为 null 实现）。对非图片文件仅在支持的键上生效",
    inputSchema: {
      filePath: z.string().describe("要删除元数据的文件路径"),
      tags: z.array(z.string()).describe("要删除的元数据标签列表"),
    },
  },
  async ({ filePath, tags }) => {
    try {
      const validatedPath = validateFilePath(filePath);

      // 构造删除操作的元数据对象（设置为 null 来删除）
      const deleteMetadata: Record<string, null> = {};
      tags.forEach((tag) => {
        deleteMetadata[tag] = null;
      });
      // 二次确认
      const preview =
        tags.slice(0, 12).join(", ") + (tags.length > 12 ? "..." : "");
      const confirmed = await confirmSensitiveAction(
        `删除元数据标签\n文件: ${validatedPath}\n标签数: ${tags.length}${
          tags.length ? `\n标签: ${preview}` : ""
        }`
      );
      if (!confirmed) {
        return { content: [{ type: "text", text: "操作已取消" }] };
      }

      await exiftool.write(validatedPath, deleteMetadata);

      return {
        content: [
          {
            type: "text",
            text: `成功删除元数据标签: ${validatedPath}\n\n删除的标签: ${tags.join(
              ", "
            )}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult(message);
    }
  }
);

// 注册工具：获取版本
server.registerTool(
  "get-version",
  {
    title: "获取版本信息",
    description: "获取 ExifTool 的版本信息",
    inputSchema: {},
  },
  async () => {
    try {
      const version = await exiftool.version();

      return {
        content: [
          {
            type: "text",
            text: `ExifTool 版本: ${version}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult(message);
    }
  }
);

// 优雅关闭处理
async function cleanup() {
  try {
    await exiftool.end();
  } catch (error) {
    console.error("清理 ExifTool 时出错:", error);
  }
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("beforeExit", cleanup);

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 确保 ExifTool 正常工作
  try {
    const version = await exiftool.version();
    console.error(`ExifTool MCP Server 启动成功，ExifTool 版本: ${version}`);
  } catch (error) {
    console.error("ExifTool 初始化失败:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("启动服务器时出错:", error);
    process.exit(1);
  });
}
