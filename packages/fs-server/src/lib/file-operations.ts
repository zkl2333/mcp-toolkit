/**
 * 文件操作模块
 * 提供安全的文件系统操作，基于官方MCP服务器的最佳实践
 * 包含原子操作、错误处理、批量处理等功能
 */

import { promises as fs } from "node:fs";
import { stat, link, symlink, readlink, chmod, lstat } from "node:fs/promises";
import { resolve, dirname, join, relative, basename, extname } from "node:path";
import { platform } from "node:os";
import {
  FileInfo,
  FileOperationOptions,
  BatchOperationResult,
  FileSystemError,
  FileSystemErrorType,
  OperationResult,
} from "../types/index.js";
import { validatePath, generateSecureTempFileName, validateForceDeleteOperation } from "./security.js";

/**
 * 检查文件是否为敏感文件
 */
function isSensitiveFile(filePath: string): boolean {
  const sensitivePatterns = [
    // 系统文件
    /(?:^|[\/\\])(?:System32|SysWOW64|Windows|Program Files|Applications)[\/\\]/i,
    // 配置文件
    /\.(?:ini|cfg|conf|config|json|xml|yaml|yml)$/i,
    // 可执行文件
    /\.(?:exe|dll|sys|bat|cmd|ps1|sh|bash)$/i,
    // 数据库文件
    /\.(?:db|sqlite|mdb|accdb)$/i,
    // 密钥和证书文件
    /\.(?:key|pem|crt|cert|p12|pfx)$/i,
    // 系统关键目录
    /(?:^|[\/\\])(?:etc|bin|sbin|usr\/bin|usr\/sbin)[\/\\]/i,
  ];

  return sensitivePatterns.some(pattern => pattern.test(filePath));
}

/**
 * 检查文件是否为只读文件
 */
function isReadOnlyFile(stats: any): boolean {
  // 检查文件权限，判断是否为只读
  const mode = stats.mode;
  const isWindows = platform() === "win32";
  
  if (isWindows) {
    // Windows 系统检查只读属性
    return (stats.mode & 0o200) === 0; // 写权限位为0
  } else {
    // Unix/Linux 系统检查用户写权限
    return (mode & 0o200) === 0; // 用户写权限位为0
  }
}

/**
 * 格式化文件大小显示
 */
export function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";

  // 处理负数
  if (bytes < 0) return `${bytes} B`;

  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  if (i <= 0) {
    // 对于字节级别，始终显示两位小数
    return `${bytes.toFixed(2)} ${units[0]}`;
  }

  const unitIndex = Math.min(i, units.length - 1);
  return `${(bytes / Math.pow(1024, unitIndex)).toFixed(2)} ${
    units[unitIndex]
  }`;
}

/**
 * 创建符号链接的辅助函数
 * 在 Windows 上处理权限问题
 */
export async function createSymbolicLink(
  target: string,
  linkPath: string
): Promise<void> {
  const isWindows = platform() === "win32";

  if (isWindows) {
    try {
      // 在 Windows 上，首先尝试使用相对路径
      const relativeTarget = relative(dirname(linkPath), target);
      await symlink(relativeTarget, linkPath);
    } catch (error: any) {
      if (error.code === "EPERM" || error.code === "EACCES") {
        // 如果权限不足，尝试使用绝对路径
        try {
          await symlink(target, linkPath);
        } catch (secondError: any) {
          if (secondError.code === "EPERM" || secondError.code === "EACCES") {
            // 如果仍然权限不足，提供更详细的错误信息
            throw new FileSystemError(
              FileSystemErrorType.PERMISSION_DENIED,
              `在 Windows 上创建符号链接需要特殊权限。请尝试以下解决方案：\n` +
                `1. 以管理员身份运行程序\n` +
                `2. 启用开发者模式（Windows 10/11）\n` +
                `3. 使用 mklink 命令手动创建链接`,
              { target, linkPath, originalError: secondError }
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

/**
 * 原子文件写入操作
 * 基于官方实现，使用临时文件+重命名确保原子性
 */
export async function atomicWriteFile(
  filePath: string,
  content: string | Buffer
): Promise<void> {
  const tempPath = generateSecureTempFileName(filePath);

  try {
    // 写入临时文件
    await fs.writeFile(tempPath, content);

    // 原子重命名
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // 清理临时文件
    try {
      await fs.unlink(tempPath);
    } catch {
      // 忽略清理错误
    }

    throw new FileSystemError(
      FileSystemErrorType.OPERATION_FAILED,
      `原子写入失败: ${error instanceof Error ? error.message : String(error)}`,
      { filePath, tempPath, originalError: error }
    );
  }
}

/**
 * 获取文件详细信息
 */
export async function getFileInfo(filePath: string): Promise<FileInfo> {
  const validatedPath = await validatePath(filePath);

  try {
    const stats = await stat(validatedPath);

    return {
      path: validatedPath,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      accessedAt: stats.atime,
      permissions: stats.mode.toString(8).slice(-3),
      extension: stats.isFile()
        ? extname(validatedPath) || undefined
        : undefined,
      basename: basename(validatedPath),
    };
  } catch (error) {
    throw new FileSystemError(
      FileSystemErrorType.OPERATION_FAILED,
      `获取文件信息失败: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { filePath: validatedPath, originalError: error }
    );
  }
}

/**
 * 移动文件操作
 */
export async function moveFile(
  source: string,
  destination: string,
  options: FileOperationOptions = {}
): Promise<OperationResult> {
  const { overwrite = false, createDirs = true } = options;

  try {
    const validatedSource = await validatePath(source);
    const validatedDestination = await validatePath(destination);

    // 检查源文件是否存在
    try {
      await fs.access(validatedSource);
    } catch {
      throw new FileSystemError(
        FileSystemErrorType.FILE_NOT_FOUND,
        `源文件不存在: ${validatedSource}`
      );
    }

    // 检查目标文件是否已存在
    if (!overwrite) {
      try {
        await fs.access(validatedDestination);
        throw new FileSystemError(
          FileSystemErrorType.FILE_ALREADY_EXISTS,
          `目标文件已存在，且未启用覆盖模式: ${validatedDestination}`
        );
      } catch (error) {
        if (error instanceof FileSystemError) {
          throw error;
        }
        // 目标文件不存在，可以继续
      }
    }

    // 如果需要，创建目标目录
    if (createDirs) {
      const targetDir = dirname(validatedDestination);
      await fs.mkdir(targetDir, { recursive: true });
    }

    // 执行移动操作
    await fs.rename(validatedSource, validatedDestination);

    return {
      success: true,
      message: `✅ 文件移动成功：\n源文件：${validatedSource}\n目标文件：${validatedDestination}`,
    };
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    throw new FileSystemError(
      FileSystemErrorType.OPERATION_FAILED,
      `文件移动失败: ${error instanceof Error ? error.message : String(error)}`,
      { source, destination, options, originalError: error }
    );
  }
}

/**
 * 复制文件操作
 */
export async function copyFile(
  source: string,
  destination: string,
  options: FileOperationOptions = {}
): Promise<OperationResult> {
  const { overwrite = false, createDirs = true } = options;

  try {
    const validatedSource = await validatePath(source);
    const validatedDestination = await validatePath(destination);

    // 检查源文件是否存在
    try {
      await fs.access(validatedSource);
    } catch {
      throw new FileSystemError(
        FileSystemErrorType.FILE_NOT_FOUND,
        `源文件不存在: ${validatedSource}`
      );
    }

    // 检查目标文件是否已存在
    if (!overwrite) {
      try {
        await fs.access(validatedDestination);
        throw new FileSystemError(
          FileSystemErrorType.FILE_ALREADY_EXISTS,
          `目标文件已存在，且未启用覆盖模式: ${validatedDestination}`
        );
      } catch (error) {
        if (error instanceof FileSystemError) {
          throw error;
        }
        // 目标文件不存在，可以继续
      }
    }

    // 如果需要，创建目标目录
    if (createDirs) {
      const targetDir = dirname(validatedDestination);
      await fs.mkdir(targetDir, { recursive: true });
    }

    // 执行复制操作
    await fs.copyFile(validatedSource, validatedDestination);

    return {
      success: true,
      message: `✅ 文件复制成功：\n源文件：${validatedSource}\n目标文件：${validatedDestination}`,
    };
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    throw new FileSystemError(
      FileSystemErrorType.OPERATION_FAILED,
      `文件复制失败: ${error instanceof Error ? error.message : String(error)}`,
      { source, destination, options, originalError: error }
    );
  }
}

/**
 * 删除文件操作
 */
export async function deleteFile(
  filePath: string,
  options: FileOperationOptions = {}
): Promise<OperationResult> {
  const { force = false } = options;

  try {
    const validatedPath = await validatePath(filePath);

    // 检查文件是否存在
    try {
      await fs.access(validatedPath);
    } catch {
      throw new FileSystemError(
        FileSystemErrorType.FILE_NOT_FOUND,
        `文件不存在: ${validatedPath}`
      );
    }

    // 检查是否为目录
    const stats = await stat(validatedPath);
    if (stats.isDirectory()) {
      throw new FileSystemError(
        FileSystemErrorType.INVALID_OPERATION,
        `指定路径是目录，请使用目录删除工具: ${validatedPath}`
      );
    }

    // 敏感文件保护检查
    if (!force && isSensitiveFile(validatedPath)) {
      throw new FileSystemError(
        FileSystemErrorType.PERMISSION_DENIED,
        `检测到敏感文件，删除操作被阻止。如需强制删除，请设置 force=true: ${validatedPath}\n` +
        `⚠️  警告：强制删除敏感文件可能导致系统不稳定或数据丢失`
      );
    }

    // 只读文件保护检查
    if (!force && isReadOnlyFile(stats)) {
      throw new FileSystemError(
        FileSystemErrorType.PERMISSION_DENIED,
        `检测到只读文件，删除操作被阻止。如需强制删除，请设置 force=true: ${validatedPath}\n` +
        `⚠️  警告：删除只读文件可能包含重要数据`
      );
    }

    // 如果是force模式，验证并记录警告日志
    if (force) {
      await validateForceDeleteOperation(undefined, [validatedPath]);
      console.warn(`⚠️  强制删除文件: ${validatedPath}`);
    }

    // 删除文件
    await fs.unlink(validatedPath);

    return {
      success: true,
      message: `✅ 文件删除成功：${validatedPath}${force ? ' (强制模式)' : ''}`,
    };
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    throw new FileSystemError(
      FileSystemErrorType.OPERATION_FAILED,
      `文件删除失败: ${error instanceof Error ? error.message : String(error)}`,
      { filePath, options, originalError: error }
    );
  }
}

/**
 * 批量移动文件操作
 */
export async function batchMoveFiles(
  sources: string[],
  destination: string,
  options: FileOperationOptions = {}
): Promise<BatchOperationResult> {
  const { overwrite = false, createDirs = true } = options;
  const results: string[] = [];
  const errors: string[] = [];

  try {
    const validatedDestination = await validatePath(destination);

    // 检查目标路径是否存在
    try {
      const destStats = await stat(validatedDestination);
      if (!destStats.isDirectory()) {
        throw new FileSystemError(
          FileSystemErrorType.INVALID_OPERATION,
          `目标路径不是目录: ${validatedDestination}`
        );
      }
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      // 目标不存在，如果需要则创建目录
      if (createDirs) {
        try {
          await fs.mkdir(validatedDestination, { recursive: true });
        } catch (mkdirError) {
          throw new FileSystemError(
            FileSystemErrorType.INVALID_OPERATION,
            `无法创建目标目录: ${validatedDestination}`,
            { originalError: mkdirError }
          );
        }
      } else {
        throw new FileSystemError(
          FileSystemErrorType.FILE_NOT_FOUND,
          `目标目录不存在: ${validatedDestination}`
        );
      }
    }

    // 批量处理每个源文件
    for (const source of sources) {
      try {
        const validatedSource = await validatePath(source);
        const fileName = basename(validatedSource);
        const targetPath = join(validatedDestination, fileName);

        await moveFile(validatedSource, targetPath, { overwrite });
        results.push(`${validatedSource} -> ${targetPath}`);
      } catch (error) {
        const errorMessage =
          error instanceof FileSystemError
            ? error.message
            : `${source}: ${
                error instanceof Error ? error.message : String(error)
              }`;
        errors.push(errorMessage);
      }
    }

    return {
      results,
      errors,
      totalCount: sources.length,
      successCount: results.length,
      errorCount: errors.length,
    };
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    throw new FileSystemError(
      FileSystemErrorType.OPERATION_FAILED,
      `批量移动失败: ${error instanceof Error ? error.message : String(error)}`,
      { sources, destination, options, originalError: error }
    );
  }
}

/**
 * 批量复制文件操作
 */
export async function batchCopyFiles(
  sources: string[],
  destination: string,
  options: FileOperationOptions = {}
): Promise<BatchOperationResult> {
  const { overwrite = false, createDirs = true } = options;
  const results: string[] = [];
  const errors: string[] = [];

  try {
    const validatedDestination = await validatePath(destination);

    // 如果需要，创建目标目录
    if (createDirs) {
      await fs.mkdir(validatedDestination, { recursive: true });
    }

    // 检查目标目录是否存在且为目录
    try {
      const destStats = await stat(validatedDestination);
      if (!destStats.isDirectory()) {
        throw new FileSystemError(
          FileSystemErrorType.INVALID_OPERATION,
          `目标路径不是目录: ${validatedDestination}`
        );
      }
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      throw new FileSystemError(
        FileSystemErrorType.FILE_NOT_FOUND,
        `目标目录不存在: ${validatedDestination}`
      );
    }

    // 批量处理每个源文件
    for (const source of sources) {
      try {
        const validatedSource = await validatePath(source);
        const fileName = basename(validatedSource);
        const targetPath = join(validatedDestination, fileName);

        await copyFile(validatedSource, targetPath, { overwrite });
        results.push(`${validatedSource} -> ${targetPath}`);
      } catch (error) {
        const errorMessage =
          error instanceof FileSystemError
            ? error.message
            : `${source}: ${
                error instanceof Error ? error.message : String(error)
              }`;
        errors.push(errorMessage);
      }
    }

    return {
      results,
      errors,
      totalCount: sources.length,
      successCount: results.length,
      errorCount: errors.length,
    };
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    throw new FileSystemError(
      FileSystemErrorType.OPERATION_FAILED,
      `批量复制失败: ${error instanceof Error ? error.message : String(error)}`,
      { sources, destination, options, originalError: error }
    );
  }
}

/**
 * 批量删除文件操作
 */
export async function batchDeleteFiles(
  paths: string[],
  options: FileOperationOptions = {}
): Promise<BatchOperationResult> {
  const { force = false } = options;
  const results: string[] = [];
  const errors: string[] = [];

  // 如果是force模式，验证是否允许强制删除
  if (force) {
    await validateForceDeleteOperation(undefined, paths);
  }

  // 如果是批量删除且包含敏感文件，需要更严格的检查
  if (!force) {
    const sensitiveFiles: string[] = [];
    
    // 预检查每个路径是否为敏感文件
    for (const path of paths) {
      try {
        const validatedPath = await validatePath(path);
        if (isSensitiveFile(validatedPath)) {
          sensitiveFiles.push(path);
        }
      } catch {
        // 如果路径验证失败，忽略该文件的敏感性检查
        // 后续的具体处理会处理路径错误
      }
    }

    if (sensitiveFiles.length > 0) {
      throw new FileSystemError(
        FileSystemErrorType.PERMISSION_DENIED,
        `批量删除操作中检测到 ${sensitiveFiles.length} 个敏感文件，操作被阻止。\n` +
        `敏感文件列表: ${sensitiveFiles.slice(0, 5).join(', ')}${sensitiveFiles.length > 5 ? '...' : ''}\n` +
        `⚠️  如需强制删除，请设置 force=true 并谨慎操作`
      );
    }
  }

  // 批量处理每个文件
  for (const filePath of paths) {
    try {
      const validatedPath = await validatePath(filePath);

      // 检查文件是否存在
      try {
        await fs.access(validatedPath);
      } catch {
        errors.push(`文件不存在: ${validatedPath}`);
        continue;
      }

      // 获取文件信息
      const stats = await stat(validatedPath);

      // 敏感文件保护检查（单个文件级别）
      if (!force && isSensitiveFile(validatedPath)) {
        errors.push(`敏感文件删除被阻止: ${validatedPath}`);
        continue;
      }

      // 只读文件保护检查
      if (!force && isReadOnlyFile(stats)) {
        errors.push(`只读文件删除被阻止: ${validatedPath}`);
        continue;
      }

      // 如果是force模式，记录警告日志
      if (force && (isSensitiveFile(validatedPath) || isReadOnlyFile(stats))) {
        console.warn(`⚠️  强制删除文件: ${validatedPath}`);
      }

      if (stats.isDirectory()) {
        // 删除目录
        await fs.rmdir(validatedPath);
        results.push(`目录已删除: ${validatedPath}${force ? ' (强制模式)' : ''}`);
      } else {
        // 删除文件
        await fs.unlink(validatedPath);
        results.push(`文件已删除: ${validatedPath}${force ? ' (强制模式)' : ''}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof FileSystemError
          ? error.message
          : `${filePath}: ${
              error instanceof Error ? error.message : String(error)
            }`;
      errors.push(errorMessage);
    }
  }

  return {
    results,
    errors,
    totalCount: paths.length,
    successCount: results.length,
    errorCount: errors.length,
  };
}
