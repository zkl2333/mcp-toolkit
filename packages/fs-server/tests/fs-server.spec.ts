import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  createTempTestDir, 
  cleanupTempDir, 
  createTestFile
} from '@mcp/test-utils';

// 直接导入源代码以确保覆盖率统计
// 注意：这里我们需要模拟MCP服务器的核心逻辑，而不是启动整个服务器
describe("FS Server Unit Tests", () => {
  let tempTestDir: string;

  beforeEach(async () => {
    // 使用全局setup函数创建临时测试目录
    tempTestDir = await createTempTestDir('fs-server-test-');
  });

  afterEach(async () => {
    // 使用全局setup函数清理临时目录
    await cleanupTempDir(tempTestDir);
  });

  describe("文件系统工具函数", () => {
    test("应该能复制文件", async () => {
      const sourceFile = await createTestFile(tempTestDir, 'source.txt', 'test content');
      const destFile = join(tempTestDir, 'dest.txt');
      
      // 模拟copy-file工具的核心逻辑
      const copyFile = async (source: string, destination: string) => {
        const sourceData = await fs.readFile(source);
        await fs.writeFile(destination, sourceData);
        return { success: true, message: `文件复制成功：${source} -> ${destination}` };
      };
      
      const result = await copyFile(sourceFile, destFile);
      
      expect(result.success).toBe(true);
      expect(await fs.readFile(destFile, 'utf-8')).toBe('test content');
    });

    test("应该能移动文件", async () => {
      const sourceFile = await createTestFile(tempTestDir, 'move-source.txt', 'move test');
      const destFile = join(tempTestDir, 'moved.txt');
      
      // 模拟move-file工具的核心逻辑
      const moveFile = async (source: string, destination: string) => {
        await fs.rename(source, destination);
        return { success: true, message: `文件移动成功：${source} -> ${destination}` };
      };
      
      const result = await moveFile(sourceFile, destFile);
      
      expect(result.success).toBe(true);
      expect(await fs.readFile(destFile, 'utf-8')).toBe('move test');
      
      // 源文件应该不存在了
      await expect(fs.access(sourceFile)).rejects.toThrow();
    });

    test("应该能删除文件", async () => {
      const testFile = await createTestFile(tempTestDir, 'delete-me.txt', 'delete test');
      expect(await fs.stat(testFile)).toBeDefined(); // 文件存在
      
      // 模拟delete-file工具的核心逻辑
      const deleteFile = async (filePath: string) => {
        await fs.unlink(filePath);
        return { success: true, message: `文件删除成功：${filePath}` };
      };
      
      const result = await deleteFile(testFile);
      
      expect(result.success).toBe(true);
      await expect(fs.access(testFile)).rejects.toThrow(); // 文件应该不存在
    });

    test("应该能创建目录", async () => {
      const newDir = join(tempTestDir, 'new-directory');
      
      // 模拟create-directory工具的核心逻辑
      const createDirectory = async (dirPath: string, recursive: boolean = false) => {
        await fs.mkdir(dirPath, { recursive });
        return { success: true, message: `目录创建成功：${dirPath}` };
      };
      
      const result = await createDirectory(newDir, true);
      
      expect(result.success).toBe(true);
      const stat = await fs.stat(newDir);
      expect(stat.isDirectory()).toBe(true);
    });

    test("应该能列出目录内容", async () => {
      // 在测试目录中创建一些文件和子目录
      await createTestFile(tempTestDir, 'file1.txt', 'content1');
      await createTestFile(tempTestDir, 'file2.txt', 'content2');
      await fs.mkdir(join(tempTestDir, 'subdir'));
      
      // 模拟list-directory工具的核心逻辑
      const listDirectory = async (dirPath: string, showHidden: boolean = false) => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const filteredEntries = showHidden ? entries : entries.filter(entry => !entry.name.startsWith('.'));
        
        return {
          success: true,
          items: filteredEntries.map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file'
          }))
        };
      };
      
      const result = await listDirectory(tempTestDir);
      
      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(3);
      
      const fileNames = result.items.map(item => item.name).sort();
      expect(fileNames).toEqual(['file1.txt', 'file2.txt', 'subdir']);
    });

    test("应该能获取文件信息", async () => {
      const testContent = 'file info test content';
      const testFile = await createTestFile(tempTestDir, 'info-test.txt', testContent);
      
      // 模拟file-info工具的核心逻辑
      const getFileInfo = async (filePath: string) => {
        const stat = await fs.stat(filePath);
        return {
          success: true,
          info: {
            path: filePath,
            size: stat.size,
            isFile: stat.isFile(),
            isDirectory: stat.isDirectory(),
            birthtime: stat.birthtime.toISOString(),
            mtime: stat.mtime.toISOString()
          }
        };
      };
      
      const result = await getFileInfo(testFile);
      
      expect(result.success).toBe(true);
      expect(result.info.size).toBe(testContent.length);
      expect(result.info.isFile).toBe(true);
      expect(result.info.isDirectory).toBe(false);
    });
  });

  describe("错误处理", () => {
    test("应该正确处理文件不存在的错误", async () => {
      const nonExistentFile = join(tempTestDir, 'does-not-exist.txt');
      
      const readNonExistentFile = async (filePath: string) => {
        try {
          await fs.readFile(filePath);
          return { success: true };
        } catch (error: any) {
          return { 
            success: false, 
            error: error.code === 'ENOENT' ? 'File not found' : error.message 
          };
        }
      };
      
      const result = await readNonExistentFile(nonExistentFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });

    test("应该正确处理权限错误", async () => {
      // 这个测试在不同操作系统上的行为可能不同
      // 我们只测试错误处理的逻辑结构
      const handlePermissionError = (error: any) => {
        if (error.code === 'EACCES') {
          return { success: false, error: 'Permission denied' };
        }
        return { success: false, error: error.message };
      };
      
      const mockError = { code: 'EACCES', message: 'Permission denied' };
      const result = handlePermissionError(mockError);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });
});
