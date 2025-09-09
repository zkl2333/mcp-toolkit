/**
 * 文件系统服务器类型定义
 */

// 文件操作结果类型
export interface OperationResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

// 批量操作结果类型
export interface BatchOperationResult {
  results: string[];
  errors: string[];
  totalCount: number;
  successCount: number;
  errorCount: number;
}

// 文件信息类型
export interface FileInfo {
  path: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  createdAt: Date;
  modifiedAt: Date;
  accessedAt: Date;
  permissions: string;
  extension?: string;
  basename?: string;
}

// 安全配置类型
export interface SecurityConfig {
  allowedDirectories: string[];
  enablePathTraversalProtection: boolean;
  allowForceDelete: boolean; // 是否允许force删除操作
  forceDeleteRequiresConfirmation: boolean; // force删除是否需要额外确认
}

// 文件操作选项类型
export interface FileOperationOptions {
  overwrite?: boolean;
  createDirs?: boolean;
  force?: boolean;
  recursive?: boolean;
}

// 错误类型枚举
export enum FileSystemErrorType {
  PATH_NOT_ALLOWED = "PATH_NOT_ALLOWED",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_ALREADY_EXISTS = "FILE_ALREADY_EXISTS",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  SYMLINK_TARGET_INVALID = "SYMLINK_TARGET_INVALID",
  DIRECTORY_NOT_EMPTY = "DIRECTORY_NOT_EMPTY",
  INVALID_OPERATION = "INVALID_OPERATION",
  OPERATION_FAILED = "OPERATION_FAILED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

// 自定义错误类
export class FileSystemError extends Error {
  constructor(
    public type: FileSystemErrorType,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "FileSystemError";
  }
}

// 工具参数类型（手动定义以避免循环依赖）
export interface MoveFileArgs {
  source: string;
  destination: string;
  overwrite?: boolean;
  createDirs?: boolean;
}

export interface CopyFileArgs {
  source: string;
  destination: string;
  overwrite?: boolean;
  createDirs?: boolean;
}

export interface DeleteFileArgs {
  path: string;
  force?: boolean;
}

export interface ListDirectoryArgs {
  path: string;
  showHidden?: boolean;
  details?: boolean;
}

export interface CreateDirectoryArgs {
  path: string;
  recursive?: boolean;
}

export interface FileInfoArgs {
  path: string;
}

export interface CreateHardLinkArgs {
  source: string;
  destination: string;
  overwrite?: boolean;
  createDirs?: boolean;
}

export interface CreateSymlinkArgs {
  target: string;
  linkPath: string;
  overwrite?: boolean;
  createDirs?: boolean;
}

export interface ReadSymlinkArgs {
  linkPath: string;
}

export interface RenameArgs {
  oldPath: string;
  newPath: string;
  overwrite?: boolean;
  createDirs?: boolean;
}

export interface ChangePermissionsArgs {
  path: string;
  mode: string;
}

export interface BatchMoveArgs {
  sources: string[];
  destination: string;
  overwrite?: boolean;
  createDirs?: boolean;
}

export interface BatchCopyArgs {
  sources: string[];
  destination: string;
  overwrite?: boolean;
  createDirs?: boolean;
}

export interface BatchDeleteArgs {
  paths: string[];
  force?: boolean;
}
