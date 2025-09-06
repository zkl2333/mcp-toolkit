/**
 * 测试设置工具
 * 
 * 为各个包的测试提供通用的环境配置和工具函数
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';

/**
 * 创建临时测试目录
 * @param prefix 目录前缀
 * @returns 临时目录路径
 */
export async function createTempTestDir(prefix: string = 'mcp-toolkit-test-'): Promise<string> {
  return await fs.mkdtemp(join(tmpdir(), prefix));
}

/**
 * 清理临时目录
 * @param dirPath 要清理的目录路径
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.warn(`清理临时目录失败: ${dirPath}`, error);
  }
}

/**
 * 创建测试文件
 * @param dirPath 目录路径
 * @param fileName 文件名
 * @param content 文件内容
 * @returns 完整文件路径
 */
export async function createTestFile(
  dirPath: string, 
  fileName: string, 
  content: string | Buffer
): Promise<string> {
  const filePath = join(dirPath, fileName);
  await fs.writeFile(filePath, content);
  return filePath;
}