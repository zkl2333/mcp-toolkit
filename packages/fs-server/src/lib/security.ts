/**
 * 安全验证模块
 * 基于官方MCP文件系统服务器的安全最佳实践
 * 提供路径验证、权限检查、符号链接安全等功能
 */

import { promises as fs } from 'node:fs';
import { resolve, dirname, relative, normalize, sep } from 'node:path';
import { platform, homedir } from 'node:os';
import { SecurityConfig, FileSystemError, FileSystemErrorType } from '../types/index.js';

// 默认安全配置
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowedDirectories: [],
  maxFileSize: 100 * 1024 * 1024, // 100MB
  restrictedExtensions: ['.exe', '.bat', '.cmd', '.com', '.scr'],
  enableSymlinkValidation: true,
  enablePathTraversalProtection: true
};

let securityConfig: SecurityConfig = { ...DEFAULT_SECURITY_CONFIG };

/**
 * 设置安全配置
 */
export function setSecurityConfig(config: Partial<SecurityConfig>): void {
  securityConfig = { ...securityConfig, ...config };
}

/**
 * 获取当前安全配置
 */
export function getSecurityConfig(): SecurityConfig {
  return { ...securityConfig };
}

/**
 * 路径规范化 - 处理跨平台路径差异
 */
export function normalizePath(inputPath: string): string {
  if (!inputPath) return '';
  
  // 处理 Windows 路径
  let normalizedPath = normalize(inputPath);
  
  // 在 Windows 上统一使用反斜杠，在 Unix 上使用正斜杠
  if (platform() === 'win32') {
    normalizedPath = normalizedPath.replace(/\//g, '\\');
  } else {
    normalizedPath = normalizedPath.replace(/\\/g, '/');
  }
  
  return normalizedPath;
}

/**
 * 展开用户主目录路径
 */
export function expandHome(inputPath: string): string {
  if (!inputPath || inputPath[0] !== '~') {
    return inputPath;
  }
  
  if (inputPath === '~' || inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
    return inputPath.replace('~', homedir());
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
    if (normalizedPath === normalizedAllowedDir || 
        normalizedPath.startsWith(allowedDirWithSep)) {
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
  if (inputPath.includes('\0')) {
    return true;
  }
  
  // Windows 特定的非法字符
  if (platform() === 'win32') {
    // 排除驱动器标识符中的冒号（如 C:）
    const drivePattern = /^[A-Za-z]:/;
    const pathWithoutDrive = inputPath.replace(drivePattern, '');
    const illegalChars = /[<>:"|?*]/;
    return illegalChars.test(pathWithoutDrive);
  }
  
  return false;
}

/**
 * 检查文件扩展名是否被限制
 */
export function isRestrictedExtension(filePath: string): boolean {
  const extension = filePath.toLowerCase().split('.').pop();
  if (!extension) return false;
  
  return securityConfig.restrictedExtensions.includes(`.${extension}`);
}

/**
 * 验证文件大小
 */
export async function validateFileSize(filePath: string): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > securityConfig.maxFileSize) {
      throw new FileSystemError(
        FileSystemErrorType.VALIDATION_ERROR,
        `文件大小超过限制：${stats.size} > ${securityConfig.maxFileSize}`
      );
    }
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }
    // 文件不存在等情况，跳过大小检查
  }
}

/**
 * 验证符号链接安全性
 * 基于官方实现，检查符号链接目标是否在允许范围内
 */
export async function validateSymlinkSecurity(linkPath: string): Promise<string> {
  if (!securityConfig.enableSymlinkValidation) {
    return linkPath;
  }
  
  try {
    const realPath = await fs.realpath(linkPath);
    const normalizedReal = normalizePath(realPath);
    
    if (!isPathWithinAllowedDirectories(normalizedReal, securityConfig.allowedDirectories)) {
      throw new FileSystemError(
        FileSystemErrorType.SYMLINK_TARGET_INVALID,
        `符号链接目标超出允许范围: ${realPath}`,
        { linkPath, realPath }
      );
    }
    
    return realPath;
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }
    throw new FileSystemError(
      FileSystemErrorType.SYMLINK_TARGET_INVALID,
      `无法解析符号链接: ${error instanceof Error ? error.message : String(error)}`,
      { linkPath }
    );
  }
}

/**
 * 主要的路径验证函数
 * 基于官方实现，提供全面的安全检查
 */
export async function validatePath(requestedPath: string): Promise<string> {
  if (!requestedPath) {
    throw new FileSystemError(
      FileSystemErrorType.VALIDATION_ERROR,
      '路径不能为空'
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
  if (securityConfig.enablePathTraversalProtection) {
    if (!isPathWithinAllowedDirectories(normalizedPath, securityConfig.allowedDirectories)) {
      throw new FileSystemError(
        FileSystemErrorType.PATH_NOT_ALLOWED,
        `访问被拒绝 - 路径超出允许范围: ${normalizedPath}`,
        { 
          requestedPath,
          normalizedPath, 
          allowedDirectories: securityConfig.allowedDirectories 
        }
      );
    }
  }
  
  // 检查文件扩展名限制
  if (isRestrictedExtension(normalizedPath)) {
    throw new FileSystemError(
      FileSystemErrorType.VALIDATION_ERROR,
      `不允许访问此类型的文件: ${normalizedPath}`
    );
  }
  
  // 符号链接安全检查
  try {
    // 尝试检查是否为符号链接
    const stats = await fs.lstat(normalizedPath);
    if (stats.isSymbolicLink()) {
      return await validateSymlinkSecurity(normalizedPath);
    }
    
    // 验证文件大小
    await validateFileSize(normalizedPath);
    
    return normalizedPath;
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }
    
    // 文件不存在的情况，验证父目录
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      let currentDir = dirname(normalizedPath);
      
      // 递归向上查找存在的父目录
      while (currentDir && currentDir !== dirname(currentDir)) {
        try {
          const realParentPath = await fs.realpath(currentDir);
          const normalizedParent = normalizePath(realParentPath);
          
          if (!isPathWithinAllowedDirectories(normalizedParent, securityConfig.allowedDirectories)) {
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
      if (!isPathWithinAllowedDirectories(normalizedPath, securityConfig.allowedDirectories)) {
        throw new FileSystemError(
          FileSystemErrorType.PATH_NOT_ALLOWED,
          `路径超出允许范围: ${normalizedPath}`,
          { path: normalizedPath }
        );
      }
      
      return normalizedPath;
    }
    
    throw new FileSystemError(
      FileSystemErrorType.OPERATION_FAILED,
      `路径验证失败: ${error instanceof Error ? error.message : String(error)}`,
      { path: normalizedPath, originalError: error }
    );
  }
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
export async function checkDirectoryPermissions(dirPath: string): Promise<void> {
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
