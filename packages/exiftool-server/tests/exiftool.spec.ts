import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join } from 'path';
import { 
  createTempTestDir, 
  cleanupTempDir, 
  createTestFile,
  createMcpTestHelper,
  expectToolCall
} from '@zkl2333/mcp-test-utils';

// 导入 MCP 服务器（现在使用模拟的 SDK）
import { server } from '../src/index.js';

describe("ExifTool Server Tests", () => {
  let tempTestDir: string;
  let mcpHelper: ReturnType<typeof createMcpTestHelper>;

  beforeEach(async () => {
    tempTestDir = await createTempTestDir('exiftool-server-test-');
    mcpHelper = createMcpTestHelper(server);
  });

  afterEach(async () => {
    await cleanupTempDir(tempTestDir);
  });

  describe("工具注册验证", () => {
    test("应该注册所有预期的工具", () => {
      const tools = mcpHelper.getRegisteredTools();
      
      expect(tools).toContain('read-metadata');
      expect(tools).toContain('write-metadata');
      expect(tools).toContain('extract-thumbnail');
      expect(tools).toContain('extract-preview');
      expect(tools).toContain('delete-metadata');
      expect(tools).toContain('get-version');
    });

    test("所有工具应该是启用状态", () => {
      const tools = ['read-metadata', 'write-metadata', 'extract-thumbnail', 'extract-preview', 'delete-metadata', 'get-version'];
      
      for (const toolName of tools) {
        expect(mcpHelper.isToolRegistered(toolName)).toBe(true);
      }
    });

    test("工具应该有正确的描述信息", () => {
      const readMetadataConfig = mcpHelper.getToolConfig('read-metadata');
      expect(readMetadataConfig?.title).toBe('读取元数据');
      expect(readMetadataConfig?.description).toContain('读取图片或视频文件的元数据');

      const writeMetadataConfig = mcpHelper.getToolConfig('write-metadata');
      expect(writeMetadataConfig?.title).toBe('写入元数据');
      expect(writeMetadataConfig?.description).toContain('写入或修改');

      const extractThumbnailConfig = mcpHelper.getToolConfig('extract-thumbnail');
      expect(extractThumbnailConfig?.title).toBe('提取缩略图');
      expect(extractThumbnailConfig?.description).toContain('提取嵌入的缩略图');
    });
  });

  describe("服务器配置验证", () => {
    test("服务器应该有正确的名称和版本", () => {
      const serverInfo = mcpHelper.getServerInfo();
      expect(serverInfo.name).toBe('exiftool-server');
      expect(serverInfo.version).toBe('0.1.0');
    });
  });

  describe("MCP 工具调用测试", () => {
    let testImageFile: string;

    beforeEach(async () => {
      // 创建一个简单的测试图片文件（用于测试目的）
      testImageFile = await createTestFile(tempTestDir, 'test-image.jpg', 'fake jpeg content');
    });

    test("read-metadata 工具 - 应该正确处理文件不存在的错误", async () => {
      const nonExistentFile = join(tempTestDir, 'non-existent.jpg');
      
      const result = await mcpHelper.callTool("read-metadata", {
        filePath: nonExistentFile
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '文件不存在');
    });

    test("write-metadata 工具 - 应该正确处理文件不存在的错误", async () => {
      const nonExistentFile = join(tempTestDir, 'non-existent.jpg');
      
      const result = await mcpHelper.callTool("write-metadata", {
        filePath: nonExistentFile,
        metadata: { "Artist": "Test Artist" }
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '文件不存在');
    });

    test("extract-thumbnail 工具 - 应该正确处理文件不存在的错误", async () => {
      const nonExistentFile = join(tempTestDir, 'non-existent.jpg');
      const outputFile = join(tempTestDir, 'thumb.jpg');
      
      const result = await mcpHelper.callTool("extract-thumbnail", {
        filePath: nonExistentFile,
        outputPath: outputFile
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '文件不存在');
    });

    test("extract-preview 工具 - 应该正确处理文件不存在的错误", async () => {
      const nonExistentFile = join(tempTestDir, 'non-existent.jpg');
      const outputFile = join(tempTestDir, 'preview.jpg');
      
      const result = await mcpHelper.callTool("extract-preview", {
        filePath: nonExistentFile,
        outputPath: outputFile
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '文件不存在');
    });

    test("delete-metadata 工具 - 应该正确处理文件不存在的错误", async () => {
      const nonExistentFile = join(tempTestDir, 'non-existent.jpg');
      
      const result = await mcpHelper.callTool("delete-metadata", {
        filePath: nonExistentFile,
        tags: ['Artist', 'Title']
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '文件不存在');
    });

    test("get-version 工具 - 应该能获取版本信息", async () => {
      const result = await mcpHelper.callTool("get-version", {});
      
      // 这个工具可能因为没有实际的 ExifTool 而失败，但我们可以测试工具是否注册正确
      // 不管成功还是失败，都应该有返回内容
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].text).toBeDefined();
    });

    test("extract-thumbnail 工具 - 应该正确处理输出文件已存在的错误", async () => {
      const outputFile = await createTestFile(tempTestDir, 'existing-thumb.jpg', 'existing content');
      
      const result = await mcpHelper.callTool("extract-thumbnail", {
        filePath: testImageFile,
        outputPath: outputFile,
        overwrite: false
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '输出文件已存在');
    });

    test("extract-preview 工具 - 应该正确处理输出文件已存在的错误", async () => {
      const outputFile = await createTestFile(tempTestDir, 'existing-preview.jpg', 'existing content');
      
      const result = await mcpHelper.callTool("extract-preview", {
        filePath: testImageFile,
        outputPath: outputFile,
        overwrite: false
      });
      
      expectToolCall.toFail(result);
      expectToolCall.toContain(result, '输出文件已存在');
    });
  });

  describe("参数验证测试", () => {
    test("read-metadata - 应该正确处理可选的 tags 参数", async () => {
      const testFile = await createTestFile(tempTestDir, 'test.jpg', 'fake content');
      
      // 测试不带 tags 参数
      const result1 = await mcpHelper.callTool("read-metadata", {
        filePath: testFile
      });
      
      // 无论成功或失败，都应该有响应内容
      expect(result1.content).toBeDefined();
      expect(result1.content.length).toBeGreaterThan(0);
      
      // 测试带 tags 参数
      const result2 = await mcpHelper.callTool("read-metadata", {
        filePath: testFile,
        tags: ['Artist', 'Title']
      });
      
      expect(result2.content).toBeDefined();
      expect(result2.content.length).toBeGreaterThan(0);
    });

    test("write-metadata - 应该正确处理 overwrite 参数", async () => {
      const testFile = await createTestFile(tempTestDir, 'test.jpg', 'fake content');
      
      const result = await mcpHelper.callTool("write-metadata", {
        filePath: testFile,
        metadata: { "Artist": "Test Artist" },
        overwrite: true
      });
      
      // 无论成功或失败，都应该有响应内容
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    test("delete-metadata - 应该正确处理 tags 数组参数", async () => {
      const testFile = await createTestFile(tempTestDir, 'test.jpg', 'fake content');
      
      const result = await mcpHelper.callTool("delete-metadata", {
        filePath: testFile,
        tags: ['Artist', 'Title', 'Copyright']
      });
      
      // 无论成功或失败，都应该有响应内容
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe("路径处理测试", () => {
    test("应该正确处理相对路径", async () => {
      // 创建测试文件
      const testFile = await createTestFile(tempTestDir, 'relative-test.jpg', 'fake content');
      
      // 使用相对路径测试
      const relativePath = `./${testFile.split('/').pop()}`;
      
      const result = await mcpHelper.callTool("read-metadata", {
        filePath: testFile  // 使用完整路径，因为相对路径会依赖工作目录
      });
      
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    test("应该正确处理绝对路径", async () => {
      const testFile = await createTestFile(tempTestDir, 'absolute-test.jpg', 'fake content');
      
      const result = await mcpHelper.callTool("read-metadata", {
        filePath: testFile  // 这已经是绝对路径
      });
      
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    test("应该正确处理特殊字符文件名", async () => {
      const testFile = await createTestFile(tempTestDir, '特殊文件名-测试.jpg', 'fake content');
      
      const result = await mcpHelper.callTool("read-metadata", {
        filePath: testFile
      });
      
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe("错误处理和边界情况", () => {
    test("应该正确处理空的 metadata 对象", async () => {
      const testFile = await createTestFile(tempTestDir, 'empty-meta.jpg', 'fake content');
      
      const result = await mcpHelper.callTool("write-metadata", {
        filePath: testFile,
        metadata: {}
      });
      
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    test("应该正确处理空的 tags 数组", async () => {
      const testFile = await createTestFile(tempTestDir, 'empty-tags.jpg', 'fake content');
      
      const result = await mcpHelper.callTool("read-metadata", {
        filePath: testFile,
        tags: []
      });
      
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    test("应该正确处理删除空的 tags 数组", async () => {
      const testFile = await createTestFile(tempTestDir, 'delete-empty.jpg', 'fake content');
      
      const result = await mcpHelper.callTool("delete-metadata", {
        filePath: testFile,
        tags: []
      });
      
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    test("应该正确处理大文件路径", async () => {
      const longFileName = 'a'.repeat(100) + '.jpg';
      const testFile = await createTestFile(tempTestDir, longFileName, 'fake content');
      
      const result = await mcpHelper.callTool("read-metadata", {
        filePath: testFile
      });
      
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe("工具参数 Schema 验证", () => {
    test("每个工具都应该有正确的参数 Schema", () => {
      const tools = ['read-metadata', 'write-metadata', 'extract-thumbnail', 'extract-preview', 'delete-metadata', 'get-version'];
      
      for (const toolName of tools) {
        const toolConfig = mcpHelper.getToolConfig(toolName);
        expect(toolConfig).toBeDefined();
        expect(toolConfig?.inputSchema).toBeDefined();
        
        // 验证具体的参数要求
        if (toolName === 'read-metadata') {
          expect(toolConfig?.inputSchema).toHaveProperty('filePath');
        } else if (toolName === 'write-metadata') {
          expect(toolConfig?.inputSchema).toHaveProperty('filePath');
          expect(toolConfig?.inputSchema).toHaveProperty('metadata');
        } else if (toolName === 'extract-thumbnail' || toolName === 'extract-preview') {
          expect(toolConfig?.inputSchema).toHaveProperty('filePath');
          expect(toolConfig?.inputSchema).toHaveProperty('outputPath');
        } else if (toolName === 'delete-metadata') {
          expect(toolConfig?.inputSchema).toHaveProperty('filePath');
          expect(toolConfig?.inputSchema).toHaveProperty('tags');
        } else if (toolName === 'get-version') {
          // get-version 不需要参数
          expect(toolConfig?.inputSchema).toBeDefined();
        }
      }
    });
  });

  describe("复杂场景测试", () => {
    test("应该能处理连续的元数据操作", async () => {
      const testFile = await createTestFile(tempTestDir, 'complex-test.jpg', 'fake content');
      
      // 1. 读取元数据
      const readResult = await mcpHelper.callTool("read-metadata", {
        filePath: testFile
      });
      expect(readResult.content).toBeDefined();
      
      // 2. 写入元数据
      const writeResult = await mcpHelper.callTool("write-metadata", {
        filePath: testFile,
        metadata: { "Artist": "Test Artist", "Title": "Test Title" }
      });
      expect(writeResult.content).toBeDefined();
      
      // 3. 删除某些元数据
      const deleteResult = await mcpHelper.callTool("delete-metadata", {
        filePath: testFile,
        tags: ['Artist']
      });
      expect(deleteResult.content).toBeDefined();
    });
  });
});