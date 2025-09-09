/**
 * 安全验证模块
 * 基于官方MCP文件系统服务器的安全最佳实践
 * 提供路径验证、权限检查、符号链接安全等功能
 */

import { promises as fs } from "node:fs";
import { resolve, dirname, relative, normalize, sep } from "node:path";
import { platform, homedir } from "node:os";
import {
  SecurityConfig,
  FileSystemError,
  FileSystemErrorType,
} from "../types/index.js";
import { server } from "../index.js";

// 安全配置常量
const SECURITY_CONFIG: SecurityConfig = {
  enablePathTraversalProtection: true,
  allowForceDelete: true, // 是否允许force删除操作
  forceDeleteRequiresConfirmation: true, // force删除是否需要额外确认
  allowedDirectories: [], // 将在初始化时设置
};

/**
 * 初始化安全配置
 * 根据命令行参数设置允许访问的目录
 */
export function initializeSecurity(allowedDirectories: string[]): void {
  // 直接修改配置对象（仅在启动时调用）
  SECURITY_CONFIG.allowedDirectories = allowedDirectories;
}

/**
 * 获取当前安全配置（只读）
 */
export function getSecurityConfig(): SecurityConfig {
  return SECURITY_CONFIG;
}

/**
 * 验证force删除操作是否被允许
 */
export async function validateForceDeleteOperation(
  requestContext?: any,
  filePaths?: string[]
): Promise<void> {
  if (!SECURITY_CONFIG.allowForceDelete) {
    throw new FileSystemError(
      FileSystemErrorType.PERMISSION_DENIED,
      "系统安全策略禁止执行强制删除操作"
    );
  }

  if (SECURITY_CONFIG.forceDeleteRequiresConfirmation) {
    const confirmed = await confirmSensitiveDeleteAction(filePaths);
    if (!confirmed) {
      throw new FileSystemError(
        FileSystemErrorType.PERMISSION_DENIED,
        "用户取消了强制删除操作"
      );
    }
  }
}

/**
 * 通过 elicitInput 进行敏感删除操作的二次确认
 */
async function confirmSensitiveDeleteAction(
  filePaths?: string[]
): Promise<boolean> {
  try {
    // 检查server实例是否可用
    if (!server || !server.server || !server.server.elicitInput) {
      console.warn("确认对话框出现错误，为安全起见拒绝执行: server实例不可用");
      return false;
    }

    const fileList = filePaths
      ? `\n要删除的文件:\n${filePaths
          .slice(0, 10)
          .map((f) => `• ${f}`)
          .join("\n")}${
          filePaths.length > 10
            ? `\n... 还有 ${filePaths.length - 10} 个文件`
            : ""
        }`
      : "";

    // 根据官方示例，直接调用 elicitInput
    const result = await server.server.elicitInput({
      message: `⚠️ 危险操作确认\n\n您即将执行强制删除操作，这将跳过所有安全保护措施，可能删除重要的系统文件、配置文件或只读文件。${fileList}\n\n此操作不可撤销，请谨慎确认！`,
      requestedSchema: {
        type: "object",
        properties: {
          confirm: {
            type: "boolean",
            title: "我理解风险并确认执行强制删除",
            description: "勾选此项表示您完全理解操作风险，并愿意承担所有后果",
          },
          acknowledged: {
            type: "boolean",
            title: "我已备份重要数据",
            description: "确认您已经备份了可能受影响的重要数据",
          },
        },
        required: ["confirm", "acknowledged"],
      },
    });

    // 根据官方示例的处理方式
    if (result.action === "accept") {
      return (
        result.content?.confirm === true &&
        result.content?.acknowledged === true
      );
    } else if (result.action === "decline") {
      return false;
    } else {
      // 其他情况（如错误）也拒绝执行
      return false;
    }
  } catch (error) {
    console.warn("确认对话框出现错误，为安全起见拒绝执行:", error);
    return false;
  }
}

/**
 * 路径规范化 - 处理跨平台路径差异
 */
export function normalizePath(inputPath: string): string {
  if (!inputPath) return "";

  // 处理 Windows 路径
  let normalizedPath = normalize(inputPath);

  // 在 Windows 上统一使用反斜杠，在 Unix 上使用正斜杠
  if (platform() === "win32") {
    normalizedPath = normalizedPath.replace(/\//g, "\\");
  } else {
    normalizedPath = normalizedPath.replace(/\\/g, "/");
  }

  return normalizedPath;
}

/**
 * 展开用户主目录路径
 */
export function expandHome(inputPath: string): string {
  if (!inputPath || inputPath[0] !== "~") {
    return inputPath;
  }

  if (
    inputPath === "~" ||
    inputPath.startsWith("~/") ||
    inputPath.startsWith("~\\")
  ) {
    return inputPath.replace("~", homedir());
  }

  return inputPath;
}

/**
 * 检查路径是否在允许的目录内
 * 基于官方实现，防止路径遍历攻击
 */
export function isPathWithinAllowedDirectories(
  requestedPath: string,
  allowedDirectories: string[]
): boolean {
  if (!requestedPath || allowedDirectories.length === 0) {
    return false;
  }

  // 规范化请求的路径
  const normalizedPath = normalizePath(resolve(expandHome(requestedPath)));

  // 检查每个允许的目录
  for (const allowedDir of allowedDirectories) {
    if (!allowedDir) continue;

    const normalizedAllowedDir = normalizePath(resolve(expandHome(allowedDir)));

    // 确保允许的目录以路径分隔符结尾，防止前缀攻击
    const allowedDirWithSep = normalizedAllowedDir.endsWith(sep)
      ? normalizedAllowedDir
      : normalizedAllowedDir + sep;

    // 检查是否是完全匹配或子路径
    if (
      normalizedPath === normalizedAllowedDir ||
      normalizedPath.startsWith(allowedDirWithSep)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 检查路径中是否包含非法字符
 */
export function containsIllegalCharacters(inputPath: string): boolean {
  // 检查空字节
  if (inputPath.includes("\0")) {
    return true;
  }

  // Windows 特定的非法字符
  if (platform() === "win32") {
    // 排除驱动器标识符中的冒号（如 C:）
    const drivePattern = /^[A-Za-z]:/;
    const pathWithoutDrive = inputPath.replace(drivePattern, "");
    const illegalChars = /[<>:"|?*]/;
    return illegalChars.test(pathWithoutDrive);
  }

  return false;
}

/**
 * 主要的路径验证函数
 * 基于官方实现，提供全面的安全检查
 */
export async function validatePath(requestedPath: string): Promise<string> {
  if (!requestedPath) {
    throw new FileSystemError(
      FileSystemErrorType.VALIDATION_ERROR,
      "路径不能为空"
    );
  }

  // 展开用户主目录
  const expandedPath = expandHome(requestedPath);

  // 转换为绝对路径
  const absolutePath = resolve(expandedPath);

  // 规范化路径
  const normalizedPath = normalizePath(absolutePath);

  // 检查非法字符
  if (containsIllegalCharacters(normalizedPath)) {
    throw new FileSystemError(
      FileSystemErrorType.VALIDATION_ERROR,
      `路径包含非法字符: ${normalizedPath}`
    );
  }

  // 检查路径遍历保护
  if (SECURITY_CONFIG.enablePathTraversalProtection) {
    if (
      !isPathWithinAllowedDirectories(
        normalizedPath,
        SECURITY_CONFIG.allowedDirectories
      )
    ) {
      throw new FileSystemError(
        FileSystemErrorType.PATH_NOT_ALLOWED,
        `访问被拒绝 - 路径超出允许范围: ${normalizedPath}`,
        {
          requestedPath,
          normalizedPath,
          allowedDirectories: SECURITY_CONFIG.allowedDirectories,
        }
      );
    }
  }

  // 验证路径或其父目录的存在性
  try {
    // 尝试访问路径
    await fs.access(normalizedPath);
    return normalizedPath;
  } catch (error) {
    // 文件不存在的情况，验证父目录
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return await validateNonExistentPath(normalizedPath);
    }

    throw new FileSystemError(
      FileSystemErrorType.OPERATION_FAILED,
      `路径验证失败: ${error instanceof Error ? error.message : String(error)}`,
      { path: normalizedPath, originalError: error }
    );
  }
}

/**
 * 验证不存在文件的路径
 * 通过检查父目录来确保路径在允许范围内
 */
async function validateNonExistentPath(
  normalizedPath: string
): Promise<string> {
  let currentDir = dirname(normalizedPath);

  // 递归向上查找存在的父目录
  while (currentDir && currentDir !== dirname(currentDir)) {
    try {
      const realParentPath = await fs.realpath(currentDir);
      const normalizedParent = normalizePath(realParentPath);

      if (
        !isPathWithinAllowedDirectories(
          normalizedParent,
          SECURITY_CONFIG.allowedDirectories
        )
      ) {
        throw new FileSystemError(
          FileSystemErrorType.PATH_NOT_ALLOWED,
          `父目录超出允许范围: ${normalizedParent}`,
          { parentDir: normalizedParent }
        );
      }

      return normalizedPath;
    } catch (parentError) {
      // 如果当前目录不存在，继续向上查找
      currentDir = dirname(currentDir);
    }
  }

  // 如果所有父目录都不存在，检查是否在允许的根目录内
  if (
    !isPathWithinAllowedDirectories(
      normalizedPath,
      SECURITY_CONFIG.allowedDirectories
    )
  ) {
    throw new FileSystemError(
      FileSystemErrorType.PATH_NOT_ALLOWED,
      `路径超出允许范围: ${normalizedPath}`,
      { path: normalizedPath }
    );
  }

  return normalizedPath;
}

/**
 * 批量验证路径
 */
export async function validatePaths(paths: string[]): Promise<string[]> {
  const validatedPaths: string[] = [];

  for (const path of paths) {
    const validatedPath = await validatePath(path);
    validatedPaths.push(validatedPath);
  }

  return validatedPaths;
}

/**
 * 检查目录权限
 */
export async function checkDirectoryPermissions(
  dirPath: string
): Promise<void> {
  try {
    await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    throw new FileSystemError(
      FileSystemErrorType.PERMISSION_DENIED,
      `目录权限不足: ${dirPath}`,
      { dirPath, originalError: error }
    );
  }
}

/**
 * 安全的临时文件名生成
 */
export function generateSecureTempFileName(originalPath: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${originalPath}.${timestamp}.${random}.tmp`;
}
