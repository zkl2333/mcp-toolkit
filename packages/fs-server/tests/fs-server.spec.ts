import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join } from 'path';
import { 
  createTempTestDir, 
  cleanupTempDir, 
  createTestFile
} from '@zkl2333/mcp-test-utils';
import { MockMcpServer } from '@zkl2333/mcp-test-utils';

// 导入 MCP 服务器（现在使用模拟的 SDK）
import { server } from '../src/index.js';

// 测试助手函数
function createMcpTestHelper(server: MockMcpServer) {
  return {
    async callTool(toolName: string, args: Record<string, any> = {}) {
      return await server.callTool(toolName, args);
    },
    getRegisteredTools(): string[] {
      return server.getRegisteredTools();
    },
    isToolRegistered(toolName: string): boolean {
      return server.isToolRegistered(toolName);
    },
    getToolConfig(toolName: string) {
      return server.getToolConfig(toolName);
    },
    getServerInfo() {
      return server.getServerInfo();
    }
  };
}

// 期望匹配器
const expectToolCall = {
  toSucceed(result: any) {
    if (result.isError) {
      throw new Error(`Expected tool call to succeed, but it failed with: ${result.content[0]?.text}`);
    }
  },
  toFail(result: any) {
    if (!result.isError) {
      throw new Error(`Expected tool call to fail, but it succeeded with: ${result.content[0]?.text}`);
    }
  },
  toContain(result: any, text: string) {
    const content = result.content[0]?.text || '';
    if (!content.includes(text)) {
      throw new Error(`Expected tool call result to contain "${text}", but got: ${content}`);
    }
  }
};

describe("FS Server Tests", () => {
  let tempTestDir: string;
  let mcpHelper: ReturnType<typeof createMcpTestHelper>;

  beforeEach(async () => {
    tempTestDir = await createTempTestDir('fs-server-test-');
    mcpHelper = createMcpTestHelper(server as unknown as MockMcpServer);
  });

  afterEach(async () => {
    await cleanupTempDir(tempTestDir);
  });

  describe("工具注册验证", () => {
    test("应该注册所有预期的工具", () => {
      const tools = mcpHelper.getRegisteredTools();
      
      // 基础文件操作
      expect(tools).toContain('move-file');
      expect(tools).toContain('copy-file');
      expect(tools).toContain('delete-file');
      expect(tools).toContain('rename');
      
      // 目录操作
      expect(tools).toContain('list-directory');
      expect(tools).toContain('create-directory');
      
      // 文件信息
      expect(tools).toContain('file-info');
      
      // 链接操作
      expect(tools).toContain('create-hard-link');
      expect(tools).toContain('create-symlink');
      expect(tools).toContain('read-symlink');
      
      // 权限管理
      expect(tools).toContain('change-permissions');
      
      // 批量操作
      expect(tools).toContain('batch-move');
      expect(tools).toContain('batch-copy');
      expect(tools).toContain('batch-delete');
    });

    test("所有工具应该是启用状态", () => {
      const tools = [
        'move-file', 'copy-file', 'delete-file', 'rename',
        'list-directory', 'create-directory', 'file-info',
        'create-hard-link', 'create-symlink', 'read-symlink',
        'change-permissions', 'batch-move', 'batch-copy', 'batch-delete'
      ];
      
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

  describe("高级文件操作测试", () => {
    describe("重命名功能", () => {
      test("rename 工具 - 应该能重命名文件", async () => {
        const originalFile = await createTestFile(tempTestDir, 'original.txt', 'test content');
        const newFile = join(tempTestDir, 'renamed.txt');
        
        const result = await mcpHelper.callTool("rename", {
          oldPath: originalFile,
          newPath: newFile,
          overwrite: false,
          createDirs: true
        });
        
        expectToolCall.toSucceed(result);
        expectToolCall.toContain(result, '重命名成功');
        
        // 验证文件已重命名
        expect(await Bun.file(originalFile).exists()).toBe(false);
        expect(await Bun.file(newFile).text()).toBe('test content');
      });

      test("rename 工具 - 应该能重命名目录", async () => {
        const { promises: fs } = require('fs');
        const originalDir = join(tempTestDir, 'original-dir');
        const newDir = join(tempTestDir, 'renamed-dir');
        await fs.mkdir(originalDir);
        
        const result = await mcpHelper.callTool("rename", {
          oldPath: originalDir,
          newPath: newDir,
          overwrite: false,
          createDirs: true
        });
        
        expectToolCall.toSucceed(result);
        expectToolCall.toContain(result, '重命名成功');
        
        // 验证目录已重命名
        const stats = await fs.stat(newDir);
        expect(stats.isDirectory()).toBe(true);
      });
    });

    describe("硬链接功能", () => {
      test("create-hard-link 工具 - 应该能创建硬链接", async () => {
        const originalFile = await createTestFile(tempTestDir, 'original.txt', 'test content');
        const hardLinkFile = join(tempTestDir, 'hardlink.txt');
        
        const result = await mcpHelper.callTool("create-hard-link", {
          source: originalFile,
          destination: hardLinkFile,
          overwrite: false,
          createDirs: true
        });
        
        expectToolCall.toSucceed(result);
        expectToolCall.toContain(result, '硬链接创建成功');
        
        // 验证硬链接已创建
        expect(await Bun.file(hardLinkFile).text()).toBe('test content');
      });

      test("create-hard-link 工具 - 应该拒绝为目录创建硬链接", async () => {
        const { promises: fs } = require('fs');
        const originalDir = join(tempTestDir, 'original-dir');
        const hardLinkFile = join(tempTestDir, 'hardlink.txt');
        await fs.mkdir(originalDir);
        
        const result = await mcpHelper.callTool("create-hard-link", {
          source: originalDir,
          destination: hardLinkFile,
          overwrite: false,
          createDirs: true
        });
        
        expectToolCall.toFail(result);
        expectToolCall.toContain(result, '硬链接不能链接到目录');
      });
    });

    describe("软链接功能", () => {
      test("create-symlink 工具 - 应该能创建软链接", async () => {
        const targetFile = await createTestFile(tempTestDir, 'target.txt', 'target content');
        const symlinkFile = join(tempTestDir, 'symlink.txt');
        
        const result = await mcpHelper.callTool("create-symlink", {
          target: targetFile,
          linkPath: symlinkFile,
          overwrite: false,
          createDirs: true
        });
        
        // 在 Windows 上，软链接可能需要特殊权限
        if (result.isError && result.content[0]?.text.includes('Windows 上创建符号链接需要特殊权限')) {
          // 这是预期的 Windows 权限问题，跳过测试
          console.log('跳过软链接测试：需要 Windows 管理员权限或开发者模式');
          return;
        }
        
        expectToolCall.toSucceed(result);
        expectToolCall.toContain(result, '软链接创建成功');
      });

      test("read-symlink 工具 - 应该能读取软链接", async () => {
        const { promises: fs } = require('fs');
        const targetFile = await createTestFile(tempTestDir, 'target.txt', 'target content');
        const symlinkFile = join(tempTestDir, 'symlink.txt');
        
        try {
          // 先创建软链接
          await fs.symlink(targetFile, symlinkFile);
        } catch (error: any) {
          if (error.code === 'EPERM' || error.code === 'EACCES') {
            // 在 Windows 上权限不足，跳过测试
            console.log('跳过软链接读取测试：需要 Windows 管理员权限或开发者模式');
            return;
          }
          throw error;
        }
        
        const result = await mcpHelper.callTool("read-symlink", {
          linkPath: symlinkFile
        });
        
        expectToolCall.toSucceed(result);
        expectToolCall.toContain(result, '软链接信息');
        expectToolCall.toContain(result, targetFile);
      });

      test("read-symlink 工具 - 应该正确处理非软链接文件", async () => {
        const regularFile = await createTestFile(tempTestDir, 'regular.txt', 'regular content');
        
        const result = await mcpHelper.callTool("read-symlink", {
          linkPath: regularFile
        });
        
        expectToolCall.toFail(result);
        expectToolCall.toContain(result, '不是软链接');
      });
    });

    describe("权限管理功能", () => {
      test("change-permissions 工具 - 应该能修改文件权限", async () => {
        const testFile = await createTestFile(tempTestDir, 'permission-test.txt', 'test content');
        
        const result = await mcpHelper.callTool("change-permissions", {
          path: testFile,
          mode: '644'
        });
        
        expectToolCall.toSucceed(result);
        expectToolCall.toContain(result, '权限修改成功');
      });

      test("change-permissions 工具 - 应该拒绝无效的权限模式", async () => {
        const testFile = await createTestFile(tempTestDir, 'permission-test.txt', 'test content');
        
        const result = await mcpHelper.callTool("change-permissions", {
          path: testFile,
          mode: '999'
        });
        
        expectToolCall.toFail(result);
        expectToolCall.toContain(result, '无效的权限模式');
      });
    });

    describe("批量操作功能", () => {
      test("batch-move 工具 - 应该能批量移动文件", async () => {
        const file1 = await createTestFile(tempTestDir, 'file1.txt', 'content1');
        const file2 = await createTestFile(tempTestDir, 'file2.txt', 'content2');
        const destDir = join(tempTestDir, 'destination');
        
        const result = await mcpHelper.callTool("batch-move", {
          sources: [file1, file2],
          destination: destDir,
          overwrite: false,
          createDirs: true
        });
        
        expectToolCall.toSucceed(result);
        expectToolCall.toContain(result, '批量移动完成');
        expectToolCall.toContain(result, '成功移动 (2 个)');
        
        // 验证文件已移动
        expect(await Bun.file(file1).exists()).toBe(false);
        expect(await Bun.file(file2).exists()).toBe(false);
        expect(await Bun.file(join(destDir, 'file1.txt')).text()).toBe('content1');
        expect(await Bun.file(join(destDir, 'file2.txt')).text()).toBe('content2');
      });

      test("batch-copy 工具 - 应该能批量复制文件", async () => {
        const file1 = await createTestFile(tempTestDir, 'file1.txt', 'content1');
        const file2 = await createTestFile(tempTestDir, 'file2.txt', 'content2');
        const destDir = join(tempTestDir, 'backup');
        
        const result = await mcpHelper.callTool("batch-copy", {
          sources: [file1, file2],
          destination: destDir,
          overwrite: false,
          createDirs: true
        });
        
        expectToolCall.toSucceed(result);
        expectToolCall.toContain(result, '批量复制完成');
        expectToolCall.toContain(result, '成功复制 (2 个)');
        
        // 验证文件已复制
        expect(await Bun.file(file1).text()).toBe('content1');
        expect(await Bun.file(file2).text()).toBe('content2');
        expect(await Bun.file(join(destDir, 'file1.txt')).text()).toBe('content1');
        expect(await Bun.file(join(destDir, 'file2.txt')).text()).toBe('content2');
      });

      test("batch-delete 工具 - 应该能批量删除文件", async () => {
        const file1 = await createTestFile(tempTestDir, 'file1.txt', 'content1');
        const file2 = await createTestFile(tempTestDir, 'file2.txt', 'content2');
        const { promises: fs } = require('fs');
        const dir = join(tempTestDir, 'dir-to-delete');
        await fs.mkdir(dir);
        
        const result = await mcpHelper.callTool("batch-delete", {
          paths: [file1, file2, dir],
          force: false
        });
        
        expectToolCall.toSucceed(result);
        expectToolCall.toContain(result, '批量删除完成');
        expectToolCall.toContain(result, '成功删除 (3 个)');
        
        // 验证文件已删除
        expect(await Bun.file(file1).exists()).toBe(false);
        expect(await Bun.file(file2).exists()).toBe(false);
        try {
          await fs.stat(dir);
          expect(true).toBe(false); // 不应该到达这里
        } catch {
          // 目录应该已被删除
        }
      });

      test("批量操作 - 应该正确处理部分失败的情况", async () => {
        const existingFile = await createTestFile(tempTestDir, 'existing.txt', 'content');
        const nonExistentFile = join(tempTestDir, 'non-existent.txt');
        const destDir = join(tempTestDir, 'destination');
        
        const result = await mcpHelper.callTool("batch-move", {
          sources: [existingFile, nonExistentFile],
          destination: destDir,
          overwrite: false,
          createDirs: true
        });
        
        expectToolCall.toSucceed(result); // 部分成功不算完全失败
        expectToolCall.toContain(result, '成功移动 (1 个)');
        expectToolCall.toContain(result, '失败 (1 个)');
        expectToolCall.toContain(result, '源文件不存在');
      });
    });
  });
});
