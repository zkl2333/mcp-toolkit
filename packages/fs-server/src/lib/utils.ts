/**
 * 工具函数模块
 * 提供通用的辅助函数和格式化功能
 */

import { promises as fs } from 'node:fs';
import { stat, readlink, chmod, lstat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { 
  McpResponse, 
  FileSystemError, 
  FileSystemErrorType, 
  BatchOperationResult 
} from '../types/index.js';
import { validatePath } from './security.js';
import { createSymbolicLink, formatSize } from './file-operations.js';

/**
 * 创建成功响应
 */
export function createSuccessResponse(message: string): McpResponse {
  return {
    content: [{ type: "text", text: message }],
    isError: false
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(error: Error | string): McpResponse {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{ type: "text", text: `❌ ${message}` }],
    isError: true
  };
}

/**
 * 处理异步操作并返回MCP响应
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  successMessage?: string
): Promise<McpResponse> {
  try {
    const result = await operation();
    
    if (successMessage) {
      return createSuccessResponse(successMessage);
    }
    
    if (typeof result === 'string') {
      return createSuccessResponse(result);
    }
    
    return createSuccessResponse(JSON.stringify(result, null, 2));
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error : String(error));
  }
}

/**
 * 列出目录内容
 */
export async function listDirectory(
  dirPath: string, 
  showHidden: boolean = false, 
  details: boolean = false
): Promise<string> {
  const validatedPath = await validatePath(dirPath);
  
  // 检查目录是否存在
  try {
    await fs.access(validatedPath);
  } catch {
    throw new FileSystemError(
      FileSystemErrorType.FILE_NOT_FOUND,
      `目录不存在: ${validatedPath}`
    );
  }
  
  // 检查是否为目录
  const stats = await stat(validatedPath);
  if (!stats.isDirectory()) {
    throw new FileSystemError(
      FileSystemErrorType.INVALID_OPERATION,
      `指定路径不是目录: ${validatedPath}`
    );
  }
  
  // 读取目录内容
  const entries = await fs.readdir(validatedPath);
  let filteredEntries = entries;
  
  // 过滤隐藏文件
  if (!showHidden) {
    filteredEntries = entries.filter(entry => !entry.startsWith('.'));
  }
  
  if (filteredEntries.length === 0) {
    return `目录为空：${validatedPath}`;
  }
  
  // 生成输出
  let output = `📁 目录内容：${validatedPath}\n\n`;
  
  if (details) {
    // 显示详细信息
    const entryDetails = await Promise.all(
      filteredEntries.map(async (entry) => {
        const entryPath = join(validatedPath, entry);
        try {
          const entryStats = await stat(entryPath);
          const type = entryStats.isDirectory() ? '📁' : '📄';
          const size = entryStats.isDirectory() ? '' : ` (${formatSize(entryStats.size)})`;
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
  
  return output;
}

/**
 * 创建目录
 */
export async function createDirectory(
  dirPath: string, 
  recursive: boolean = true
): Promise<string> {
  const validatedPath = await validatePath(dirPath);
  
  // 检查目录是否已存在
  try {
    await fs.access(validatedPath);
    const stats = await stat(validatedPath);
    if (stats.isDirectory()) {
      return `目录已存在：${validatedPath}`;
    } else {
      throw new FileSystemError(
        FileSystemErrorType.FILE_ALREADY_EXISTS,
        `路径已存在且不是目录: ${validatedPath}`
      );
    }
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }
    // 目录不存在，可以创建
  }
  
  // 创建目录
  await fs.mkdir(validatedPath, { recursive });
  
  return `✅ 目录创建成功：${validatedPath}`;
}

/**
 * 获取文件信息详细描述
 */
export async function getFileInfoDescription(filePath: string): Promise<string> {
  const validatedPath = await validatePath(filePath);
  
  // 检查文件是否存在
  try {
    await fs.access(validatedPath);
  } catch {
    throw new FileSystemError(
      FileSystemErrorType.FILE_NOT_FOUND,
      `文件或目录不存在: ${validatedPath}`
    );
  }
  
  // 获取文件信息
  const stats = await stat(validatedPath);
  const isDirectory = stats.isDirectory();
  const isFile = stats.isFile();
  
  let output = `📋 文件信息：${validatedPath}\n\n`;
  output += `类型：${isDirectory ? '目录' : isFile ? '文件' : '其他'}\n`;
  output += `大小：${formatSize(stats.size)}\n`;
  output += `创建时间：${stats.birthtime.toLocaleString()}\n`;
  output += `修改时间：${stats.mtime.toLocaleString()}\n`;
  output += `访问时间：${stats.atime.toLocaleString()}\n`;
  output += `权限：${stats.mode.toString(8)}\n`;
  
  if (isFile) {
    output += `扩展名：${extname(validatedPath) || '无'}\n`;
    output += `基本名称：${basename(validatedPath)}\n`;
  }
  
  return output;
}

/**
 * 创建硬链接
 */
export async function createHardLink(
  source: string, 
  destination: string, 
  overwrite: boolean = false, 
  createDirs: boolean = true
): Promise<string> {
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
  
  // 检查源文件是否为目录（硬链接不能链接到目录）
  const sourceStats = await stat(validatedSource);
  if (sourceStats.isDirectory()) {
    throw new FileSystemError(
      FileSystemErrorType.INVALID_OPERATION,
      `硬链接不能链接到目录: ${validatedSource}`
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
    const { dirname } = await import('node:path');
    const targetDir = dirname(validatedDestination);
    await fs.mkdir(targetDir, { recursive: true });
  }
  
  // 如果目标文件存在且启用覆盖，先删除
  if (overwrite) {
    try {
      await fs.unlink(validatedDestination);
    } catch {
      // 忽略删除错误，可能文件不存在
    }
  }
  
  // 创建硬链接
  const { link } = await import('node:fs/promises');
  await link(validatedSource, validatedDestination);
  
  return `✅ 硬链接创建成功：\n源文件：${validatedSource}\n硬链接：${validatedDestination}`;
}

/**
 * 创建软链接
 */
export async function createSoftLink(
  target: string, 
  linkPath: string, 
  overwrite: boolean = false, 
  createDirs: boolean = true
): Promise<string> {
  const validatedTarget = await validatePath(target);
  const validatedLinkPath = await validatePath(linkPath);
  
  // 检查目标是否存在（软链接可以链接到不存在的文件）
  let targetExists = true;
  try {
    await fs.access(validatedTarget);
  } catch {
    targetExists = false;
  }
  
  // 检查链接路径是否已存在
  if (!overwrite) {
    try {
      await fs.access(validatedLinkPath);
      throw new FileSystemError(
        FileSystemErrorType.FILE_ALREADY_EXISTS,
        `链接路径已存在，且未启用覆盖模式: ${validatedLinkPath}`
      );
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      // 链接路径不存在，可以继续
    }
  }
  
  // 如果需要，创建目标目录
  if (createDirs) {
    const { dirname } = await import('node:path');
    const targetDir = dirname(validatedLinkPath);
    await fs.mkdir(targetDir, { recursive: true });
  }
  
  // 如果链接路径存在且启用覆盖，先删除
  if (overwrite) {
    try {
      await fs.unlink(validatedLinkPath);
    } catch {
      // 忽略删除错误，可能文件不存在
    }
  }
  
  // 创建软链接
  await createSymbolicLink(validatedTarget, validatedLinkPath);
  
  const targetStatus = targetExists ? "存在" : "不存在";
  return `✅ 软链接创建成功：\n目标：${validatedTarget} (${targetStatus})\n软链接：${validatedLinkPath}`;
}

/**
 * 读取软链接
 */
export async function readSoftLink(linkPath: string): Promise<string> {
  const validatedLinkPath = await validatePath(linkPath);
  
  // 检查链接是否存在
  try {
    await fs.access(validatedLinkPath);
  } catch {
    throw new FileSystemError(
      FileSystemErrorType.FILE_NOT_FOUND,
      `链接不存在: ${validatedLinkPath}`
    );
  }
  
  // 检查是否为软链接
  const stats = await lstat(validatedLinkPath);
  if (!stats.isSymbolicLink()) {
    throw new FileSystemError(
      FileSystemErrorType.INVALID_OPERATION,
      `指定路径不是软链接: ${validatedLinkPath}`
    );
  }
  
  // 读取软链接目标
  const target = await readlink(validatedLinkPath);
  
  return `🔗 软链接信息：\n链接路径：${validatedLinkPath}\n目标路径：${target}`;
}

/**
 * 重命名文件或目录
 */
export async function renameFileOrDirectory(
  oldPath: string, 
  newPath: string, 
  overwrite: boolean = false, 
  createDirs: boolean = true
): Promise<string> {
  const validatedOldPath = await validatePath(oldPath);
  const validatedNewPath = await validatePath(newPath);
  
  // 检查原路径是否存在
  try {
    await fs.access(validatedOldPath);
  } catch {
    throw new FileSystemError(
      FileSystemErrorType.FILE_NOT_FOUND,
      `原路径不存在: ${validatedOldPath}`
    );
  }
  
  // 检查新路径是否已存在
  if (!overwrite) {
    try {
      await fs.access(validatedNewPath);
      throw new FileSystemError(
        FileSystemErrorType.FILE_ALREADY_EXISTS,
        `新路径已存在，且未启用覆盖模式: ${validatedNewPath}`
      );
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      // 新路径不存在，可以继续
    }
  }
  
  // 如果需要，创建目标目录
  if (createDirs) {
    const { dirname } = await import('node:path');
    const targetDir = dirname(validatedNewPath);
    await fs.mkdir(targetDir, { recursive: true });
  }
  
  // 如果新路径存在且启用覆盖，先删除
  if (overwrite) {
    try {
      const newStats = await stat(validatedNewPath);
      if (newStats.isDirectory()) {
        await fs.rmdir(validatedNewPath);
      } else {
        await fs.unlink(validatedNewPath);
      }
    } catch {
      // 忽略删除错误，可能文件不存在
    }
  }
  
  // 执行重命名
  await fs.rename(validatedOldPath, validatedNewPath);
  
  return `✅ 重命名成功：\n原路径：${validatedOldPath}\n新路径：${validatedNewPath}`;
}

/**
 * 修改文件权限
 */
export async function changeFilePermissions(filePath: string, mode: string): Promise<string> {
  const validatedPath = await validatePath(filePath);
  
  // 检查文件是否存在
  try {
    await fs.access(validatedPath);
  } catch {
    throw new FileSystemError(
      FileSystemErrorType.FILE_NOT_FOUND,
      `文件或目录不存在: ${validatedPath}`
    );
  }
  
  // 解析权限模式
  let numericMode: number;
  try {
    numericMode = parseInt(mode, 8);
    if (isNaN(numericMode) || numericMode < 0 || numericMode > 0o777) {
      throw new Error("无效的权限模式");
    }
  } catch {
    throw new FileSystemError(
      FileSystemErrorType.VALIDATION_ERROR,
      `无效的权限模式 '${mode}'，请使用八进制格式（如 '755', '644'）`
    );
  }
  
  // 修改权限
  await chmod(validatedPath, numericMode);
  
  return `✅ 权限修改成功：\n路径：${validatedPath}\n新权限：${mode} (${numericMode.toString(8)})`;
}

/**
 * 格式化批量操作结果
 */
export function formatBatchOperationResult(
  result: BatchOperationResult, 
  operationName: string
): string {
  let output = `📦 批量${operationName}完成\n\n`;
  
  if (result.results.length > 0) {
    output += `✅ 成功 (${result.successCount} 个):\n`;
    output += result.results.map(r => `  • ${r}`).join('\n') + '\n\n';
  }
  
  if (result.errors.length > 0) {
    output += `❌ 失败 (${result.errorCount} 个):\n`;
    output += result.errors.map(e => `  • ${e}`).join('\n');
  }
  
  return output;
}
