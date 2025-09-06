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
let testImagesDir: string;
let outputDir: string;
let testImagePath: string;

describe("ExifTool MCP Server Tests", () => {
  beforeAll(async () => {
    // 创建临时测试目录
    tempDir = TestHelpers.createTempDir(__dirname, "exif-test-");
    testImagesDir = path.join(tempDir, "images");
    outputDir = path.join(tempDir, "output");
    fs.mkdirSync(testImagesDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // 创建测试图片
    await createTestImages();

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
    // 清理输出目录
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      for (const file of files) {
        if (file !== ".gitkeep") {
          fs.unlinkSync(path.join(outputDir, file));
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

    expect(toolNames).toContain("read-metadata");
    expect(toolNames).toContain("write-metadata");
    expect(toolNames).toContain("extract-thumbnail");
    expect(toolNames).toContain("extract-preview");
    expect(toolNames).toContain("delete-metadata");
    expect(toolNames).toContain("get-version");

    // 验证工具描述
    const readTool = tools.find((tool: any) => tool.name === "read-metadata");
    expect(readTool).toBeDefined();
    expect(readTool.description).toContain("元数据");
  });

  test("应该能获取 ExifTool 版本", async () => {
    const client = tester.getClient();
    const response = await client.callTool("get-version");

    TestHelpers.validateMCPResponse(response);
    const versionText = TestHelpers.extractTextFromResponse(response);
    expect(versionText).toContain("ExifTool");
    expect(versionText).toMatch(/\d+\.\d+/); // 版本号格式
  });

  test("应该能读取图片的完整元数据", async () => {
    const client = tester.getClient();
    const response = await client.callTool("read-metadata", {
      filePath: testImagePath,
    });

    TestHelpers.validateMCPResponse(response);
    const metadataText = TestHelpers.extractTextFromResponse(response);

    expect(metadataText).toContain("成功读取文件元数据");
    expect(metadataText).toContain("ImageWidth");
    expect(metadataText).toContain("ImageHeight");
    expect(metadataText).toContain("FileSize");
    expect(metadataText).toContain("MIMEType");
  });

  test("应该能读取指定的元数据标签", async () => {
    const client = tester.getClient();
    const requestedTags = ["FileSize", "ImageWidth", "ImageHeight", "MIMEType"];

    const response = await client.callTool("read-metadata", {
      filePath: testImagePath,
      tags: requestedTags,
    });

    TestHelpers.validateMCPResponse(response);
    const metadataText = TestHelpers.extractTextFromResponse(response);
    expect(metadataText).toContain("请求的标签");

    // 验证包含所有请求的标签
    for (const tag of requestedTags) {
      expect(metadataText).toContain(tag);
    }
  });

  test("应该能写入元数据到图片", async () => {
    const client = tester.getClient();
    const testFile = path.join(outputDir, "test-write.jpg");
    fs.copyFileSync(testImagePath, testFile);

    const metadata = {
      XPComment: "Bun 测试评论",
      Copyright: "© 2024 Bun 测试",
      Keywords: ["bun", "test", "mcp", "exiftool"],
    };

    const response = await client.callTool("write-metadata", {
      filePath: testFile,
      metadata,
    });

    TestHelpers.validateMCPResponse(response);
    const writeText = TestHelpers.extractTextFromResponse(response);
    expect(writeText).toContain("成功写入元数据");
    expect(writeText).toContain(testFile);

    // 验证文件存在且可读
    expect(TestHelpers.fileExists(testFile)).toBe(true);

    // 读取回来验证写入成功
    const readResponse = await client.callTool("read-metadata", {
      filePath: testFile,
      tags: ["XPComment", "Copyright"],
    });

    const readText = TestHelpers.extractTextFromResponse(readResponse);
    expect(readText).toContain("Bun 测试评论");
    expect(readText).toContain("© 2024 Bun 测试");
  });

  test("应该能删除元数据标签", async () => {
    const client = tester.getClient();
    const testFile = path.join(outputDir, "test-delete.jpg");
    fs.copyFileSync(testImagePath, testFile);

    // 先添加一些元数据
    await client.callTool("write-metadata", {
      filePath: testFile,
      metadata: {
        XPComment: "待删除的评论",
        ImageDescription: "待删除的描述",
      },
    });

    // 删除元数据
    const response = await client.callTool("delete-metadata", {
      filePath: testFile,
      tags: ["XPComment", "ImageDescription"],
    });

    TestHelpers.validateMCPResponse(response);
    const deleteText = TestHelpers.extractTextFromResponse(response);
    expect(deleteText).toContain("成功删除元数据标签");
    expect(deleteText).toContain("XPComment");
    expect(deleteText).toContain("ImageDescription");
  });

  test("应该能提取缩略图（如果存在）", async () => {
    const client = tester.getClient();
    const outputFile = path.join(outputDir, "test-thumbnail.jpg");

    const response = await client.callTool("extract-thumbnail", {
      filePath: testImagePath,
      outputPath: outputFile,
      overwrite: true,
    });

    TestHelpers.validateMCPResponse(response);
    const extractText = TestHelpers.extractTextFromResponse(response);

    // 测试图片可能没有嵌入的缩略图，这是正常的
    if (extractText.includes("成功提取缩略图")) {
      expect(TestHelpers.fileExists(outputFile)).toBe(true);
    } else {
      // 如果没有缩略图，应该是合理的错误信息
      expect(TestHelpers.responseHasError(response)).toBe(true);
    }
  });

  test("应该能提取预览图（如果存在）", async () => {
    const client = tester.getClient();
    const outputFile = path.join(outputDir, "test-preview.jpg");

    const response = await client.callTool("extract-preview", {
      filePath: testImagePath,
      outputPath: outputFile,
      overwrite: true,
    });

    TestHelpers.validateMCPResponse(response);
    const extractText = TestHelpers.extractTextFromResponse(response);

    // 测试图片可能没有嵌入的预览图，这是正常的
    if (extractText.includes("成功提取预览图")) {
      expect(TestHelpers.fileExists(outputFile)).toBe(true);
    } else {
      // 如果没有预览图，应该是合理的错误信息
      expect(TestHelpers.responseHasError(response)).toBe(true);
    }
  });

  test("应该正确处理文件不存在的错误", async () => {
    const client = tester.getClient();
    const response = await client.callTool("read-metadata", {
      filePath: "/不存在的文件路径.jpg",
    });

    TestHelpers.validateMCPResponse(response);
    const errorText = TestHelpers.extractTextFromResponse(response);
    expect(TestHelpers.responseHasError(response)).toBe(true);
    expect(errorText.toLowerCase()).toMatch(/错误.*不存在|enoent|not found/i);
  });

  test("应该正确处理覆盖保护", async () => {
    const client = tester.getClient();
    const outputFile = path.join(outputDir, "test-overwrite.jpg");

    // 创建一个文件
    TestHelpers.createTestFile(outputFile, "dummy content");

    // 尝试不覆盖的提取操作
    const response = await client.callTool("extract-thumbnail", {
      filePath: testImagePath,
      outputPath: outputFile,
      overwrite: false,
    });

    const responseText = TestHelpers.extractTextFromResponse(response);
    // 应该报告文件已存在或提取失败
    expect(responseText).toMatch(/错误|已存在|failed/i);
  });

  test("读取的元数据应该包含正确的数据类型", async () => {
    const client = tester.getClient();
    const response = await client.callTool("read-metadata", {
      filePath: testImagePath,
      tags: ["ImageWidth", "ImageHeight", "FileSize", "FileModifyDate"],
    });

    const metadataText = TestHelpers.extractTextFromResponse(response);

    // 检查数据格式
    expect(metadataText).toContain("ImageWidth");
    expect(metadataText).toContain("ImageHeight");
    expect(metadataText).toContain("FileSize");

    // 检查日期时间对象的格式（应该包含结构化的日期信息）
    if (metadataText.includes("FileModifyDate")) {
      expect(metadataText).toMatch(/(rawValue|toDate|zone|year|month|day)/);
    }
  });

  describe("复杂场景测试", () => {
    test("应该能处理多种元数据标准", async () => {
      const client = tester.getClient();
      const testFile = path.join(outputDir, "multi-standard.jpg");
      fs.copyFileSync(testImagePath, testFile);

      // 写入基本元数据（使用更兼容的标签）
      const response = await client.callTool("write-metadata", {
        filePath: testFile,
        metadata: {
          XPComment: "测试评论",
          Copyright: "© 2024 测试版权",
          Keywords: ["关键词1", "关键词2"],
          ImageDescription: "测试图片描述",
        },
      });

      TestHelpers.validateMCPResponse(response);
      const writeText = TestHelpers.extractTextFromResponse(response);
      expect(writeText).toContain("成功写入元数据");

      // 读取验证
      const readResponse = await client.callTool("read-metadata", {
        filePath: testFile,
        tags: ["XPComment", "Copyright", "ImageDescription"],
      });

      const readText = TestHelpers.extractTextFromResponse(readResponse);
      expect(readText).toContain("测试评论");
      expect(readText).toContain("© 2024 测试版权");
      expect(readText).toContain("测试图片描述");
    });

    test("应该能批量处理多个元数据操作", async () => {
      const client = tester.getClient();
      const files = ["batch1.jpg", "batch2.jpg", "batch3.jpg"];

      // 创建多个测试文件
      for (const fileName of files) {
        const testFile = path.join(outputDir, fileName);
        fs.copyFileSync(testImagePath, testFile);

        // 为每个文件写入不同的元数据
        const writeResponse = await client.callTool("write-metadata", {
          filePath: testFile,
          metadata: {
            XPComment: `评论 for ${fileName}`,
            Copyright: `© 2024 ${fileName}`,
          },
        });

        TestHelpers.validateMCPResponse(writeResponse);
      }

      // 验证每个文件都有正确的元数据
      for (const fileName of files) {
        const testFile = path.join(outputDir, fileName);
        const readResponse = await client.callTool("read-metadata", {
          filePath: testFile,
          tags: ["XPComment", "Copyright"],
        });

        const readText = TestHelpers.extractTextFromResponse(readResponse);
        expect(readText).toContain(`评论 for ${fileName}`);
        expect(readText).toContain(`© 2024 ${fileName}`);
      }
    });
  });
});

// 辅助函数
async function createTestImages() {
  // 使用现有的图片创建脚本
  const createScript = path.join(__dirname, "create-test-image.js");
  if (fs.existsSync(createScript)) {
    await new Promise<void>((resolve, reject) => {
      const { spawn } = require("child_process");
      const proc = spawn("node", [createScript], {
        stdio: "inherit",
        cwd: __dirname,
      });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`创建测试图片失败，退出代码: ${code}`));
      });
    });

    // 设置测试图片路径
    testImagePath = path.join(
      __dirname,
      "fixtures",
      "test-image-with-exif.jpg"
    );
  } else {
    // 如果脚本不存在，创建一个简单的测试图片
    const testImageBase64 = `/9j/4AAQSkZJRgABAQEAyADIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAQABADASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAkKC//EACcQAAEDAwMEAQUAAAAAAAAAAAUGBwgBAgMJAAQRCg4SBxMVITY0ZP/EABUBAQEAAAAAAAAAAAAAAAAAAAQG/8QAHhEAAgICAwEBAAAAAAAAAAAAAQIDAAQRBRIhEzH/2gAMAwEAAhEDEQA/AMbvI6sN2cEbwSBHQ9DmjIMkuK3VlW6z5JAALCJnH4/U7JW61m5eqJCKJnOvlPWu1et6M1vRfRFH4gGdL1Cjme9X43rVKWpCy1PtJeYLG1MUJBgXKL4JMiuaD4tTvLrvBcY6V44kM7c5VV2VK1rl5c6qIoI0eL5TJ+trcqKtVFhOcKjjODo9qvHW7/WKUYNNWdM2Jl3VZsQ4OHKUTAuB5m7IeKrCqm4PJOFWOvE+LOiOQSgQ6Lz7Br0fGo1Q+y2LcjdQA7gZyfrJOBk/JxjPAO3Ax3PpucbHce30f/9k=`;

    const fixturesDir = path.join(__dirname, "fixtures");
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    testImagePath = path.join(fixturesDir, "test-image.jpg");
    const imageBuffer = Buffer.from(testImageBase64, "base64");
    fs.writeFileSync(testImagePath, imageBuffer);
  }
}
