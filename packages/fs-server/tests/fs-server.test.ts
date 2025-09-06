import {
  test,
  expect,
  describe,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { MCPServerTester, TestHelpers } from "@mcp/test-utils";
import path from "path";
import fs from "fs";

// 测试配置
const TEST_CONFIG = {
  serverPath: path.join(__dirname, "..", "dist", "index.js"),
  timeout: 15000,
};

// 全局测试状态
let tester: MCPServerTester;
let tempDir: string;
let testFilesDir: string;

describe("FileSystem MCP Server Tests", () => {
  beforeAll(async () => {
    // 创建临时测试目录
    tempDir = TestHelpers.createTempDir(__dirname, "fs-test-");
    testFilesDir = path.join(tempDir, "testfiles");
    fs.mkdirSync(testFilesDir, { recursive: true });

    // 启动测试器
    tester = new MCPServerTester(TEST_CONFIG);
    await tester.startServer();
    await tester.createClient();
  });

  afterAll(async () => {
    await tester.cleanup();
    TestHelpers.cleanupTempDir(tempDir);
  });

  beforeEach(async () => {
    // 清理测试文件目录，但保留目录本身
    if (fs.existsSync(testFilesDir)) {
      const files = fs.readdirSync(testFilesDir);
      for (const file of files) {
        const filePath = path.join(testFilesDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
    }
  });

  test("服务器应该成功初始化", async () => {
    expect(tester.isServerRunning()).toBe(true);

    const client = tester.getClient();
    const toolsResponse = await client.listTools();

    expect(toolsResponse.result).toBeDefined();
    expect(toolsResponse.result.tools).toBeArray();
    expect(toolsResponse.result.tools.length).toBeGreaterThan(0);
  });

  test("应该返回正确的工具列表", async () => {
    const client = tester.getClient();
    const response = await client.listTools();

    expect(response.result).toBeDefined();
    const tools = response.result.tools;
    const toolNames = tools.map((tool: any) => tool.name);

    expect(toolNames).toContain("move-file");
    expect(toolNames).toContain("copy-file");
    expect(toolNames).toContain("delete-file");
    expect(toolNames).toContain("list-directory");
    expect(toolNames).toContain("create-directory");
    expect(toolNames).toContain("file-info");

    // 验证工具描述
    const moveFileTool = tools.find((tool: any) => tool.name === "move-file");
    expect(moveFileTool).toBeDefined();
    expect(moveFileTool.description).toContain("移动");
  });

  describe("文件操作测试", () => {
    test("应该能创建文件并获取文件信息", async () => {
      const client = tester.getClient();
      const testFile = path.join(testFilesDir, "test.txt");

      // 创建测试文件
      TestHelpers.createTestFile(testFile, "Hello World");
      expect(TestHelpers.fileExists(testFile)).toBe(true);

      // 获取文件信息
      const response = await client.callTool("file-info", { path: testFile });

      TestHelpers.validateMCPResponse(response);
      const infoText = TestHelpers.extractTextFromResponse(response);

      expect(infoText).toContain("文件信息");
      expect(infoText).toContain("类型：文件");
      expect(infoText).toContain("大小：11 字节");
      expect(infoText).toContain("test.txt");
    });

    test("应该能复制文件", async () => {
      const client = tester.getClient();
      const sourceFile = path.join(testFilesDir, "source.txt");
      const destFile = path.join(testFilesDir, "copy.txt");

      // 创建源文件
      TestHelpers.createTestFile(sourceFile, "Source content");

      // 复制文件
      const response = await client.callTool("copy-file", {
        source: sourceFile,
        destination: destFile,
        overwrite: false,
        createDirs: true,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);
      expect(responseText).toContain("文件复制成功");

      // 验证复制结果
      expect(TestHelpers.fileExists(destFile)).toBe(true);
      expect(TestHelpers.readFile(destFile)).toBe("Source content");
      expect(TestHelpers.fileExists(sourceFile)).toBe(true); // 源文件应该还在
    });

    test("应该能移动文件", async () => {
      const client = tester.getClient();
      const sourceFile = path.join(testFilesDir, "move-source.txt");
      const destFile = path.join(testFilesDir, "moved.txt");

      // 创建源文件
      TestHelpers.createTestFile(sourceFile, "Move me");

      // 移动文件
      const response = await client.callTool("move-file", {
        source: sourceFile,
        destination: destFile,
        overwrite: false,
        createDirs: true,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);
      expect(responseText).toContain("文件移动成功");

      // 验证移动结果
      expect(TestHelpers.fileExists(destFile)).toBe(true);
      expect(TestHelpers.readFile(destFile)).toBe("Move me");
      expect(TestHelpers.fileExists(sourceFile)).toBe(false); // 源文件应该不在了
    });

    test("应该能删除文件", async () => {
      const client = tester.getClient();
      const testFile = path.join(testFilesDir, "delete-me.txt");

      // 创建测试文件
      TestHelpers.createTestFile(testFile, "Delete this");
      expect(TestHelpers.fileExists(testFile)).toBe(true);

      // 删除文件
      const response = await client.callTool("delete-file", {
        path: testFile,
        force: false,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);
      expect(responseText).toContain("文件删除成功");

      // 验证删除结果
      expect(TestHelpers.fileExists(testFile)).toBe(false);
    });

    test("应该正确处理文件不存在的错误", async () => {
      const client = tester.getClient();
      const nonExistentFile = path.join(testFilesDir, "does-not-exist.txt");

      // 尝试获取不存在文件的信息
      const response = await client.callTool("file-info", {
        path: nonExistentFile,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);
      expect(TestHelpers.responseHasError(response)).toBe(true);
      expect(responseText).toMatch(/错误.*不存在/);
    });

    test("应该正确处理覆盖保护", async () => {
      const client = tester.getClient();
      const sourceFile = path.join(testFilesDir, "source.txt");
      const existingFile = path.join(testFilesDir, "existing.txt");

      // 创建文件
      TestHelpers.createTestFile(sourceFile, "Source");
      TestHelpers.createTestFile(existingFile, "Existing");

      // 尝试复制到已存在的文件，不覆盖
      const response = await client.callTool("copy-file", {
        source: sourceFile,
        destination: existingFile,
        overwrite: false,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);
      expect(TestHelpers.responseHasError(response)).toBe(true);
      expect(responseText).toMatch(/错误.*已存在/);

      // 验证原文件内容未改变
      expect(TestHelpers.readFile(existingFile)).toBe("Existing");
    });
  });

  describe("目录操作测试", () => {
    test("应该能创建目录", async () => {
      const client = tester.getClient();
      const newDir = path.join(testFilesDir, "new-directory");

      // 创建目录
      const response = await client.callTool("create-directory", {
        path: newDir,
        recursive: true,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);
      expect(responseText).toContain("目录创建成功");

      // 验证目录存在
      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.statSync(newDir).isDirectory()).toBe(true);
    });

    test("应该能创建嵌套目录", async () => {
      const client = tester.getClient();
      const nestedDir = path.join(testFilesDir, "level1", "level2", "level3");

      // 创建嵌套目录
      const response = await client.callTool("create-directory", {
        path: nestedDir,
        recursive: true,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);
      expect(responseText).toContain("目录创建成功");

      // 验证嵌套目录存在
      expect(fs.existsSync(nestedDir)).toBe(true);
      expect(fs.statSync(nestedDir).isDirectory()).toBe(true);
    });

    test("应该能列出目录内容", async () => {
      const client = tester.getClient();
      const testDir = path.join(testFilesDir, "list-test");

      // 创建测试目录和文件
      fs.mkdirSync(testDir);
      TestHelpers.createTestFile(path.join(testDir, "file1.txt"), "File 1");
      TestHelpers.createTestFile(path.join(testDir, "file2.txt"), "File 2");
      fs.mkdirSync(path.join(testDir, "subdir"));

      // 列出目录内容
      const response = await client.callTool("list-directory", {
        path: testDir,
        showHidden: false,
        details: true,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);

      expect(responseText).toContain("目录内容");
      expect(responseText).toContain("file1.txt");
      expect(responseText).toContain("file2.txt");
      expect(responseText).toContain("subdir");
      expect(responseText).toContain("📁"); // 目录图标
      expect(responseText).toContain("📄"); // 文件图标
    });

    test("应该能列出空目录", async () => {
      const client = tester.getClient();
      const emptyDir = path.join(testFilesDir, "empty-dir");

      // 创建空目录
      fs.mkdirSync(emptyDir);

      // 列出空目录内容
      const response = await client.callTool("list-directory", {
        path: emptyDir,
        showHidden: false,
        details: false,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);
      expect(responseText).toContain("目录为空");
    });

    test("应该能获取目录信息", async () => {
      const client = tester.getClient();

      // 获取测试目录信息
      const response = await client.callTool("file-info", {
        path: testFilesDir,
      });

      TestHelpers.validateMCPResponse(response);
      const infoText = TestHelpers.extractTextFromResponse(response);

      expect(infoText).toContain("文件信息");
      expect(infoText).toContain("类型：目录");
      expect(infoText).toContain("大小：");
      expect(infoText).toContain("创建时间：");
      expect(infoText).toContain("修改时间：");
    });

    test("应该正确处理非目录路径的列表请求", async () => {
      const client = tester.getClient();
      const testFile = path.join(testFilesDir, "not-a-dir.txt");

      // 创建文件
      TestHelpers.createTestFile(testFile, "I am a file");

      // 尝试列出文件内容（应该失败）
      const response = await client.callTool("list-directory", {
        path: testFile,
      });

      TestHelpers.validateMCPResponse(response);
      const responseText = TestHelpers.extractTextFromResponse(response);
      expect(TestHelpers.responseHasError(response)).toBe(true);
      expect(responseText).toMatch(/错误.*不是目录/);
    });
  });

  describe("复杂场景测试", () => {
    test("应该能处理带有特殊字符的文件名", async () => {
      const client = tester.getClient();
      const specialFile = path.join(
        testFilesDir,
        "special file with spaces & symbols!.txt"
      );

      // 创建带特殊字符的文件
      TestHelpers.createTestFile(specialFile, "Special content");

      // 获取文件信息
      const response = await client.callTool("file-info", {
        path: specialFile,
      });

      TestHelpers.validateMCPResponse(response);
      const infoText = TestHelpers.extractTextFromResponse(response);
      expect(infoText).toContain("special file with spaces & symbols!.txt");
    });

    test("应该能处理深层目录结构", async () => {
      const client = tester.getClient();
      const deepDir = path.join(testFilesDir, "a", "b", "c", "d", "e");
      const deepFile = path.join(deepDir, "deep-file.txt");

      // 创建深层目录
      await client.callTool("create-directory", {
        path: deepDir,
        recursive: true,
      });

      // 在深层目录中创建文件
      TestHelpers.createTestFile(deepFile, "Deep content");

      // 移动深层文件
      const moveTarget = path.join(testFilesDir, "moved-from-deep.txt");
      const moveResponse = await client.callTool("move-file", {
        source: deepFile,
        destination: moveTarget,
      });

      TestHelpers.validateMCPResponse(moveResponse);
      expect(TestHelpers.fileExists(moveTarget)).toBe(true);
      expect(TestHelpers.fileExists(deepFile)).toBe(false);
    });

    test("应该能批量处理多个文件操作", async () => {
      const client = tester.getClient();
      const batchDir = path.join(testFilesDir, "batch");

      // 创建批处理目录
      await client.callTool("create-directory", {
        path: batchDir,
        recursive: true,
      });

      // 创建多个文件
      const files = ["file1.txt", "file2.txt", "file3.txt"];
      for (const fileName of files) {
        TestHelpers.createTestFile(
          path.join(batchDir, fileName),
          `Content of ${fileName}`
        );
      }

      // 列出所有文件
      const listResponse = await client.callTool("list-directory", {
        path: batchDir,
        details: true,
      });

      TestHelpers.validateMCPResponse(listResponse);
      const listText = TestHelpers.extractTextFromResponse(listResponse);

      for (const fileName of files) {
        expect(listText).toContain(fileName);
      }

      // 复制所有文件到新位置
      const copyDir = path.join(testFilesDir, "copied");
      await client.callTool("create-directory", {
        path: copyDir,
        recursive: true,
      });

      for (const fileName of files) {
        const copyResponse = await client.callTool("copy-file", {
          source: path.join(batchDir, fileName),
          destination: path.join(copyDir, fileName),
        });
        TestHelpers.validateMCPResponse(copyResponse);
      }

      // 验证所有文件都被复制
      for (const fileName of files) {
        expect(TestHelpers.fileExists(path.join(copyDir, fileName))).toBe(true);
      }
    });
  });
});
