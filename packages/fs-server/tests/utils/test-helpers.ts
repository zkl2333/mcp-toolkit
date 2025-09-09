/**
 * 测试辅助工具函数
 * 提供通用的测试设置和断言功能
 */

import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

/**
 * 创建临时测试目录
 */
export async function createTempDir(
  prefix: string = "fs-test-"
): Promise<string> {
  const tempName = `${prefix}${randomBytes(8).toString("hex")}`;
  const tempPath = join(tmpdir(), tempName);
  await fs.mkdir(tempPath, { recursive: true });
  return tempPath;
}

/**
 * 清理临时目录
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    // 忽略清理错误
    console.warn(`Failed to cleanup temp dir ${dirPath}:`, error);
  }
}

/**
 * 创建测试文件
 */
export async function createTestFile(
  baseDir: string,
  fileName: string,
  content: string = "test content"
): Promise<string> {
  const filePath = join(baseDir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

/**
 * 创建测试目录
 */
export async function createTestDir(
  baseDir: string,
  dirName: string
): Promise<string> {
  const dirPath = join(baseDir, dirName);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取文件内容
 */
export async function readTestFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf8");
}

/**
 * 获取文件统计信息
 */
export async function getFileStats(filePath: string) {
  return await fs.stat(filePath);
}

/**
 * 创建具有指定权限的文件
 */
export async function createFileWithPermissions(
  filePath: string,
  content: string,
  mode: number
): Promise<string> {
  await fs.writeFile(filePath, content, "utf8");
  await fs.chmod(filePath, mode);
  return filePath;
}

/**
 * 验证路径规范化结果
 */
export function assertNormalizedPath(actual: string, expected: string): void {
  const normalizedActual = resolve(actual);
  const normalizedExpected = resolve(expected);

  if (normalizedActual !== normalizedExpected) {
    throw new Error(
      `Path normalization failed: expected "${normalizedExpected}", got "${normalizedActual}"`
    );
  }
}

/**
 * 安全断言：检查操作是否抛出特定错误
 */
export async function assertThrowsAsync<T extends Error>(
  fn: () => Promise<any>,
  expectedErrorType?: new (...args: any[]) => T,
  expectedMessage?: string
): Promise<T> {
  try {
    await fn();
    throw new Error("Expected function to throw, but it did not");
  } catch (error) {
    if (expectedErrorType && !(error instanceof expectedErrorType)) {
      throw new Error(
        `Expected error of type ${expectedErrorType.name}, but got ${error.constructor.name}: ${error.message}`
      );
    }

    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(
        `Expected error message to contain "${expectedMessage}", but got: ${error.message}`
      );
    }

    return error as T;
  }
}

/**
 * 批量创建测试文件
 */
export async function createTestFiles(
  baseDir: string,
  fileSpecs: Array<{ name: string; content?: string }>
): Promise<string[]> {
  const createdFiles: string[] = [];

  for (const spec of fileSpecs) {
    const filePath = await createTestFile(
      baseDir,
      spec.name,
      spec.content || "test content"
    );
    createdFiles.push(filePath);
  }

  return createdFiles;
}

/**
 * 模拟安全配置
 */
export interface MockSecurityConfig {
  allowedDirectories: string[];
  enablePathTraversalProtection: boolean;
  allowForceDelete: boolean;
  forceDeleteRequiresConfirmation: boolean;
}

/**
 * 创建测试安全配置
 */
export function createTestSecurityConfig(
  baseDir: string,
  overrides: Partial<MockSecurityConfig> = {}
): MockSecurityConfig {
  return {
    allowedDirectories: [baseDir],
    enablePathTraversalProtection: true,
    allowForceDelete: true,
    forceDeleteRequiresConfirmation: false,
    ...overrides,
  };
}

/**
 * Windows 兼容性助手
 */
export const isWindows = process.platform === "win32";

/**
 * 跳过需要特殊权限的测试（Windows符号链接）
 */
export function skipIfNoSymlinkPermission(description: string = ""): void {
  if (isWindows) {
    console.log(
      `Skipping test that requires symlink permissions on Windows: ${description}`
    );
    // 在实际的测试中，这里应该使用测试框架的skip功能
  }
}

/**
 * 创建测试场景数据
 */
export interface TestScenario {
  name: string;
  setup: () => Promise<any>;
  cleanup?: () => Promise<void>;
}

/**
 * 批量运行测试场景
 */
export async function runTestScenarios(
  scenarios: TestScenario[]
): Promise<void> {
  for (const scenario of scenarios) {
    try {
      console.log(`Running scenario: ${scenario.name}`);
      await scenario.setup();
    } finally {
      if (scenario.cleanup) {
        await scenario.cleanup();
      }
    }
  }
}
