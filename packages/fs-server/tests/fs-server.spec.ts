import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join } from 'path';
import { 
  createTempTestDir, 
  cleanupTempDir, 
  createTestFile,
  createMcpTestHelper,
  expectToolCall
} from '@mcp/test-utils';

// 导入 MCP 服务器（现在使用模拟的 SDK）
import { server } from '../src/index.js';

describe("FS Server Tests", () => {
  let tempTestDir: string;
  let mcpHelper: ReturnType<typeof createMcpTestHelper>;

  beforeEach(async () => {
    tempTestDir = await createTempTestDir('fs-server-test-');
    mcpHelper = createMcpTestHelper(server);
  });

  afterEach(async () => {
    await cleanupTempDir(tempTestDir);
  });

  describe("工具注册验证", () => {
    test("应该注册所有预期的工具", () => {
      const tools = mcpHelper.getRegisteredTools();
      
      expect(tools).toContain('move-file');
      expect(tools).toContain('copy-file');
      expect(tools).toContain('delete-file');
      expect(tools).toContain('list-directory');
      expect(tools).toContain('create-directory');
      expect(tools).toContain('file-info');
    });

    test("所有工具应该是启用状态", () => {
      const tools = ['move-file', 'copy-file', 'delete-file', 'list-directory', 'create-directory', 'file-info'];
      
      for (const toolName of tools) {
        expect(mcpHelper.isToolRegistered(toolName)).toBe(true);
      }
    });

    test("工具应该有正确的描述信息", () => {
      const moveFileConfig = mcpHelper.getToolConfig('move-file');
      expect(moveFileConfig?.title).toBe('移动文件');
      expect(moveFileConfig?.description).toContain('移动');

      const copyFileConfig = mcpHelper.getToolConfig('copy-file');
      expect(copyFileConfig?.title).toBe('复制文件');
      expect(copyFileConfig?.description).toContain('复制');

      const deleteFileConfig = mcpHelper.getToolConfig('delete-file');
      expect(deleteFileConfig?.title).toBe('删除文件');
      expect(deleteFileConfig?.description).toContain('删除');
    });
  });

  describe("服务器配置验证", () => {
    test("服务器应该有正确的名称和版本", () => {
      const serverInfo = mcpHelper.getServerInfo();
      expect(serverInfo.name).toBe('filesystem-server');
      expect(serverInfo.version).toBe('0.1.0');
    });
  });

  describe("MCP 工具调用测试", () => {
    test("move-file 工具 - 应该能移动文件", async () => {
      const sourceFile = await createTestFile(tempTestDir, 'source.txt', 'test content');
      const destFile = join(tempTestDir, 'dest.txt');
      
      const result = await mcpHelper.callTool("move-file", {
        source: sourceFile,
        destination: destFile,
        overwrite: false,
        createDirs: true
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, '文件移动成功');
      
      // 验证文件已移动
      expect(await Bun.file(sourceFile).exists()).toBe(false);
      expect(await Bun.file(destFile).text()).toBe('test content');
    });

    test("copy-file 工具 - 应该能复制文件", async () => {
      const sourceFile = await createTestFile(tempTestDir, 'source.txt', 'test content');
      const destFile = join(tempTestDir, 'copy.txt');
      
      const result = await mcpHelper.callTool("copy-file", {
        source: sourceFile,
        destination: destFile,
        overwrite: false,
        createDirs: true
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, '文件复制成功');
      
      // 验证文件已复制
      expect(await Bun.file(sourceFile).text()).toBe('test content');
      expect(await Bun.file(destFile).text()).toBe('test content');
    });

    test("delete-file 工具 - 应该能删除文件", async () => {
      const testFile = await createTestFile(tempTestDir, 'delete-me.txt', 'test content');
      
      const result = await mcpHelper.callTool("delete-file", {
        path: testFile
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, '文件删除成功');
      
      // 验证文件已删除
      expect(await Bun.file(testFile).exists()).toBe(false);
    });

    test("create-directory 工具 - 应该能创建目录", async () => {
      const newDir = join(tempTestDir, 'new-directory');
      
      const result = await mcpHelper.callTool("create-directory", {
        path: newDir,
        recursive: true
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, '目录创建成功');
      
      // 验证目录已创建
      const { promises: fs } = require('fs');
      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });

    test("list-directory 工具 - 应该能列出目录内容", async () => {
      // 创建一些测试文件
      await createTestFile(tempTestDir, 'file1.txt', 'content1');
      await createTestFile(tempTestDir, 'file2.txt', 'content2');
      const { promises: fs } = require('fs');
      await fs.mkdir(join(tempTestDir, 'subdir'));
      
      const result = await mcpHelper.callTool("list-directory", {
        path: tempTestDir
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, 'file1.txt');
      expectToolCall.toContain(result, 'file2.txt'); 
      expectToolCall.toContain(result, 'subdir');
    });

    test("file-info 工具 - 应该能获取文件信息", async () => {
      const testFile = await createTestFile(tempTestDir, 'info-test.txt', 'test content for info');
      
      const result = await mcpHelper.callTool("file-info", {
        path: testFile
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, testFile);
      expectToolCall.toContain(result, '大小');
    });
  });

  describe("错误处理测试", () => {
    test("move-file - 应该正确处理文件不存在的错误", async () => {
      const nonExistentFile = join(tempTestDir, 'non-existent.txt');
      const destFile = join(tempTestDir, 'dest.txt');
      
      const result = await mcpHelper.callTool("move-file", {
        source: nonExistentFile,
        destination: destFile
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '源文件不存在');
    });

    test("copy-file - 应该正确处理文件不存在的错误", async () => {
      const nonExistentFile = join(tempTestDir, 'non-existent.txt');
      const destFile = join(tempTestDir, 'dest.txt');
      
      const result = await mcpHelper.callTool("copy-file", {
        source: nonExistentFile,
        destination: destFile
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '源文件不存在');
    });

    test("delete-file - 应该正确处理文件不存在的错误", async () => {
      const nonExistentFile = join(tempTestDir, 'non-existent.txt');
      
      const result = await mcpHelper.callTool("delete-file", {
        path: nonExistentFile
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '文件不存在');
    });

    test("copy-file - 应该正确处理目标文件已存在的错误", async () => {
      const sourceFile = await createTestFile(tempTestDir, 'source.txt', 'source content');
      const destFile = await createTestFile(tempTestDir, 'dest.txt', 'dest content');
      
      const result = await mcpHelper.callTool("copy-file", {
        source: sourceFile,
        destination: destFile,
        overwrite: false
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '目标文件已存在');
    });
  });

  describe("覆盖模式测试", () => {
    test("copy-file - 应该能在覆盖模式下复制文件", async () => {
      const sourceFile = await createTestFile(tempTestDir, 'source.txt', 'new content');
      const destFile = await createTestFile(tempTestDir, 'dest.txt', 'old content');
      
      const result = await mcpHelper.callTool("copy-file", {
        source: sourceFile,
        destination: destFile,
        overwrite: true
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, '文件复制成功');
      expect(await Bun.file(destFile).text()).toBe('new content');
    });

    test("move-file - 应该能在覆盖模式下移动文件", async () => {
      const sourceFile = await createTestFile(tempTestDir, 'source.txt', 'new content');
      const destFile = await createTestFile(tempTestDir, 'dest.txt', 'old content');
      
      const result = await mcpHelper.callTool("move-file", {
        source: sourceFile,
        destination: destFile,
        overwrite: true
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, '文件移动成功');
      expect(await Bun.file(destFile).text()).toBe('new content');
      expect(await Bun.file(sourceFile).exists()).toBe(false);
    });
  });

  describe("参数验证测试", () => {
    test("应该正确处理可选参数", async () => {
      const sourceFile = await createTestFile(tempTestDir, 'source.txt', 'test content');
      const destFile = join(tempTestDir, 'nested', 'dest.txt');
      
      // 测试自动创建目录功能
      const result = await mcpHelper.callTool("copy-file", {
        source: sourceFile,
        destination: destFile,
        createDirs: true  // 明确设置为 true
      });
      
      expectToolCall.toSucceed(result);
      expect(await Bun.file(destFile).text()).toBe('test content');
    });
  });

  describe("边界情况测试", () => {
    test("应该正确处理特殊字符文件名", async () => {
      const specialFile = await createTestFile(tempTestDir, '特殊文件名-测试.txt', 'special content');
      
      const result = await mcpHelper.callTool("file-info", {
        path: specialFile
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, '特殊文件名-测试.txt');
    });

    test("应该正确处理空目录", async () => {
      const emptyDir = join(tempTestDir, 'empty-dir');
      const { promises: fs } = require('fs');
      await fs.mkdir(emptyDir);
      
      const result = await mcpHelper.callTool("list-directory", {
        path: emptyDir
      });
      
      expectToolCall.toSucceed(result);
      expectToolCall.toContain(result, '目录为空');
    });
  });
});
