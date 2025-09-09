/**
 * 工具函数模块单元测试
 * 测试响应格式化、异步处理和文件操作辅助功能
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { promises as fs } from "node:fs";

// 导入要测试的模块
import {
  createSuccessResponse,
  createErrorResponse,
  handleAsyncOperation,
  listDirectory,
  createDirectory,
  getFileInfoDescription,
  createHardLink,
  createSoftLink,
  readSoftLink,
  renameFileOrDirectory,
  changeFilePermissions,
  formatBatchOperationResult,
} from "../../src/lib/utils.js";

import {
  FileSystemError,
  FileSystemErrorType,
  BatchOperationResult,
} from "../../src/types/index.js";
import { initializeSecurity } from "../../src/lib/security.js";

// 导入测试工具
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createTestDir,
  fileExists,
  readTestFile,
  assertThrowsAsync,
  createTestSecurityConfig,
  createTestFiles,
  isWindows,
} from "../utils/test-helpers.js";

describe("工具函数模块单元测试", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("utils-test-");

    // 初始化安全配置（使用测试目录）
    initializeSecurity([tempDir]);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("响应格式化", () => {
    describe("createSuccessResponse", () => {
      test("应该创建正确的成功响应", () => {
        const message = "操作成功完成";
        const response = createSuccessResponse(message);

        expect(response.content).toHaveLength(1);
        expect(response.content[0].type).toBe("text");
        expect(response.content[0].text).toBe(message);
        expect(response.isError).toBe(false);
      });

      test("应该处理空消息", () => {
        const response = createSuccessResponse("");

        expect(response.content[0].text).toBe("");
        expect(response.isError).toBe(false);
      });

      test("应该处理包含特殊字符的消息", () => {
        const message = "成功！🎉 文件已创建 \n路径: /test/file.txt";
        const response = createSuccessResponse(message);

        expect(response.content[0].text).toBe(message);
        expect(response.isError).toBe(false);
      });
    });

    describe("createErrorResponse", () => {
      test("应该从Error对象创建错误响应", () => {
        const error = new Error("Something went wrong");
        const response = createErrorResponse(error);

        expect(response.content).toHaveLength(1);
        expect(response.content[0].type).toBe("text");
        expect(response.content[0].text).toBe("❌ Something went wrong");
        expect(response.isError).toBe(true);
      });

      test("应该从字符串创建错误响应", () => {
        const errorMessage = "操作失败";
        const response = createErrorResponse(errorMessage);

        expect(response.content[0].text).toBe("❌ 操作失败");
        expect(response.isError).toBe(true);
      });

      test("应该处理FileSystemError", () => {
        const error = new FileSystemError(
          FileSystemErrorType.FILE_NOT_FOUND,
          "文件不存在"
        );
        const response = createErrorResponse(error);

        expect(response.content[0].text).toBe("❌ 文件不存在");
        expect(response.isError).toBe(true);
      });
    });
  });

  describe("异步操作处理", () => {
    describe("handleAsyncOperation", () => {
      test("应该处理成功的异步操作", async () => {
        const successOperation = async () => "操作成功";

        const response = await handleAsyncOperation(successOperation);

        expect(response.content[0].text).toBe("操作成功");
        expect(response.isError).toBeFalsy();
      });

      test("应该处理带自定义成功消息的操作", async () => {
        const operation = async () => ({ data: "some data" });
        const successMessage = "自定义成功消息";

        const response = await handleAsyncOperation(operation, successMessage);

        expect(response.content[0].text).toBe(successMessage);
        expect(response.isError).toBeFalsy();
      });

      test("应该处理返回对象的操作", async () => {
        const operation = async () => ({ result: "success", count: 42 });

        const response = await handleAsyncOperation(operation);

        const responseText = response.content[0].text;
        expect(responseText).toContain('"result"');
        expect(responseText).toContain('"success"');
        expect(responseText).toContain('"count"');
        expect(responseText).toContain("42");
        expect(response.isError).toBeFalsy();
      });

      test("应该处理抛出错误的操作", async () => {
        const errorOperation = async () => {
          throw new Error("操作失败");
        };

        const response = await handleAsyncOperation(errorOperation);

        expect(response.content[0].text).toBe("❌ 操作失败");
        expect(response.isError).toBe(true);
      });

      test("应该处理抛出字符串的操作", async () => {
        const errorOperation = async () => {
          throw "字符串错误";
        };

        const response = await handleAsyncOperation(errorOperation);

        expect(response.content[0].text).toBe("❌ 字符串错误");
        expect(response.isError).toBe(true);
      });

      test("应该处理FileSystemError", async () => {
        const errorOperation = async () => {
          throw new FileSystemError(
            FileSystemErrorType.PERMISSION_DENIED,
            "权限被拒绝"
          );
        };

        const response = await handleAsyncOperation(errorOperation);

        expect(response.content[0].text).toBe("❌ 权限被拒绝");
        expect(response.isError).toBe(true);
      });
    });
  });

  describe("目录操作", () => {
    describe("listDirectory", () => {
      test("应该列出目录内容", async () => {
        await createTestFiles(tempDir, [
          { name: "file1.txt" },
          { name: "file2.txt" },
        ]);
        await createTestDir(tempDir, "subdir");

        const result = await listDirectory(tempDir);

        expect(result).toContain("📁 目录内容");
        expect(result).toContain("file1.txt");
        expect(result).toContain("file2.txt");
        expect(result).toContain("subdir");
      });

      test("应该显示详细信息", async () => {
        await createTestFile(tempDir, "test.txt", "content");

        const result = await listDirectory(tempDir, false, true);

        expect(result).toContain("📁 目录内容");
        expect(result).toContain("test.txt");
        expect(result).toContain("修改时间");
        expect(
          result.includes("bytes") ||
          result.includes("B") ||
          result.includes("KB")
        ).toBe(true);
      });

      test("应该显示隐藏文件", async () => {
        await createTestFile(tempDir, ".hidden-file", "hidden");
        await createTestFile(tempDir, "visible-file.txt", "visible");

        const resultWithHidden = await listDirectory(tempDir, true);
        const resultWithoutHidden = await listDirectory(tempDir, false);

        expect(resultWithHidden).toContain(".hidden-file");
        expect(resultWithHidden).toContain("visible-file.txt");
        expect(resultWithoutHidden).not.toContain(".hidden-file");
        expect(resultWithoutHidden).toContain("visible-file.txt");
      });

      test("应该处理空目录", async () => {
        const emptyDir = await createTestDir(tempDir, "empty");

        const result = await listDirectory(emptyDir);

        expect(result).toContain("目录为空");
      });

      test("应该在目录不存在时抛出错误", async () => {
        const nonExistentDir = join(tempDir, "non-existent");

        await assertThrowsAsync(
          () => listDirectory(nonExistentDir),
          FileSystemError,
          "目录不存在"
        );
      });

      test("应该在路径不是目录时抛出错误", async () => {
        const file = await createTestFile(tempDir, "not-a-dir.txt", "content");

        await assertThrowsAsync(
          () => listDirectory(file),
          FileSystemError,
          "指定路径不是目录"
        );
      });
    });

    describe("createDirectory", () => {
      test("应该创建新目录", async () => {
        const newDir = join(tempDir, "new-directory");

        const result = await createDirectory(newDir);

        expect(result).toContain("✅ 目录创建成功");
        expect(await fileExists(newDir)).toBe(true);
      });

      test("应该递归创建父目录", async () => {
        const nestedDir = join(tempDir, "level1", "level2", "level3");

        const result = await createDirectory(nestedDir, true);

        expect(result).toContain("✅ 目录创建成功");
        expect(await fileExists(nestedDir)).toBe(true);
      });

      test("应该处理已存在的目录", async () => {
        const existingDir = await createTestDir(tempDir, "existing");

        const result = await createDirectory(existingDir);

        expect(result).toContain("目录已存在");
      });

      test("应该在路径已存在且不是目录时抛出错误", async () => {
        const file = await createTestFile(tempDir, "not-a-dir.txt", "content");

        await assertThrowsAsync(
          () => createDirectory(file),
          FileSystemError,
          "路径已存在且不是目录"
        );
      });
    });
  });

  describe("文件信息", () => {
    describe("getFileInfoDescription", () => {
      test("应该获取文件的详细描述", async () => {
        const testFile = await createTestFile(
          tempDir,
          "info-test.txt",
          "test content"
        );

        const result = await getFileInfoDescription(testFile);

        expect(result).toContain("📋 文件信息");
        expect(result).toContain("类型：文件");
        expect(result).toContain("大小：");
        expect(result).toContain("创建时间：");
        expect(result).toContain("修改时间：");
        expect(result).toContain("访问时间：");
        expect(result).toContain("权限：");
        expect(result).toContain("扩展名：.txt");
        expect(result).toContain("基本名称：info-test.txt");
      });

      test("应该获取目录的详细描述", async () => {
        const testDir = await createTestDir(tempDir, "info-dir");

        const result = await getFileInfoDescription(testDir);

        expect(result).toContain("📋 文件信息");
        expect(result).toContain("类型：目录");
        expect(result).not.toContain("扩展名：");
        expect(result).not.toContain("基本名称：");
      });

      test("应该处理没有扩展名的文件", async () => {
        const noExtFile = await createTestFile(
          tempDir,
          "no-extension",
          "content"
        );

        const result = await getFileInfoDescription(noExtFile);

        expect(result).toContain("扩展名：无");
        expect(result).toContain("基本名称：no-extension");
      });

      test("应该在文件不存在时抛出错误", async () => {
        const nonExistentFile = join(tempDir, "non-existent.txt");

        await assertThrowsAsync(
          () => getFileInfoDescription(nonExistentFile),
          FileSystemError,
          "文件或目录不存在"
        );
      });
    });
  });

  describe("链接操作", () => {
    describe("createHardLink", () => {
      test("应该创建硬链接", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "link content"
        );
        const linkPath = join(tempDir, "hardlink.txt");

        const result = await createHardLink(sourceFile, linkPath);

        expect(result).toContain("✅ 硬链接创建成功");
        expect(await fileExists(linkPath)).toBe(true);
        expect(await readTestFile(linkPath)).toBe("link content");
      });

      test("应该在源文件不存在时抛出错误", async () => {
        const nonExistentFile = join(tempDir, "non-existent.txt");
        const linkPath = join(tempDir, "link.txt");

        await assertThrowsAsync(
          () => createHardLink(nonExistentFile, linkPath),
          FileSystemError,
          "源文件不存在"
        );
      });

      test("应该拒绝为目录创建硬链接", async () => {
        const sourceDir = await createTestDir(tempDir, "source-dir");
        const linkPath = join(tempDir, "link.txt");

        await assertThrowsAsync(
          () => createHardLink(sourceDir, linkPath),
          FileSystemError,
          "硬链接不能链接到目录"
        );
      });

      test("应该在目标文件已存在且未启用覆盖时抛出错误", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "content"
        );
        const existingFile = await createTestFile(
          tempDir,
          "existing.txt",
          "existing"
        );

        await assertThrowsAsync(
          () => createHardLink(sourceFile, existingFile, false),
          FileSystemError,
          "目标文件已存在"
        );
      });

      test("应该支持覆盖模式", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "new content"
        );
        const existingFile = await createTestFile(
          tempDir,
          "existing.txt",
          "old content"
        );

        const result = await createHardLink(sourceFile, existingFile, true);

        expect(result).toContain("✅ 硬链接创建成功");
        expect(await readTestFile(existingFile)).toBe("new content");
      });
    });

    describe("createSoftLink", () => {
      test("应该创建软链接", async () => {
        if (isWindows) {
          console.log("Skipping Unix symlink test on Windows");
          return;
        }

        const targetFile = await createTestFile(
          tempDir,
          "target.txt",
          "target content"
        );
        const linkPath = join(tempDir, "symlink.txt");

        const result = await createSoftLink(targetFile, linkPath);

        expect(result).toContain("✅ 软链接创建成功");
        expect(result).toContain("存在");
      });

      test("应该处理Windows上的权限问题", async () => {
        if (!isWindows) {
          console.log("Skipping Windows symlink test on Unix");
          return;
        }

        const targetFile = await createTestFile(
          tempDir,
          "target.txt",
          "content"
        );
        const linkPath = join(tempDir, "symlink.txt");

        try {
          const result = await createSoftLink(targetFile, linkPath);
          expect(result).toContain("✅ 软链接创建成功");
        } catch (error) {
          expect(error.message).toContain("Windows 上创建符号链接需要特殊权限");
        }
      });

      test("应该允许链接到不存在的文件", async () => {
        if (isWindows) {
          console.log("Skipping symlink test on Windows");
          return;
        }

        const nonExistentTarget = join(tempDir, "non-existent.txt");
        const linkPath = join(tempDir, "symlink.txt");

        const result = await createSoftLink(nonExistentTarget, linkPath);

        expect(result).toContain("✅ 软链接创建成功");
        expect(result).toContain("不存在");
      });
    });

    describe("readSoftLink", () => {
      test("应该读取软链接信息", async () => {
        if (isWindows) {
          console.log("Skipping symlink test on Windows");
          return;
        }

        const targetFile = await createTestFile(
          tempDir,
          "target.txt",
          "content"
        );
        const linkPath = join(tempDir, "symlink.txt");

        // 手动创建软链接
        await fs.symlink(targetFile, linkPath);

        const result = await readSoftLink(linkPath);

        expect(result).toContain("🔗 软链接信息");
        expect(result).toContain("链接路径");
        expect(result).toContain("目标路径");
      });

      test("应该在链接不存在时抛出错误", async () => {
        const nonExistentLink = join(tempDir, "non-existent-link");

        await assertThrowsAsync(
          () => readSoftLink(nonExistentLink),
          FileSystemError,
          "链接不存在"
        );
      });

      test("应该在路径不是软链接时抛出错误", async () => {
        const regularFile = await createTestFile(
          tempDir,
          "regular.txt",
          "content"
        );

        await assertThrowsAsync(
          () => readSoftLink(regularFile),
          FileSystemError,
          "指定路径不是软链接"
        );
      });
    });
  });

  describe("文件系统操作", () => {
    describe("renameFileOrDirectory", () => {
      test("应该重命名文件", async () => {
        const originalFile = await createTestFile(
          tempDir,
          "original.txt",
          "content"
        );
        const newPath = join(tempDir, "renamed.txt");

        const result = await renameFileOrDirectory(originalFile, newPath);

        expect(result).toContain("✅ 重命名成功");
        expect(await fileExists(originalFile)).toBe(false);
        expect(await fileExists(newPath)).toBe(true);
        expect(await readTestFile(newPath)).toBe("content");
      });

      test("应该重命名目录", async () => {
        const originalDir = await createTestDir(tempDir, "original-dir");
        const newPath = join(tempDir, "renamed-dir");

        const result = await renameFileOrDirectory(originalDir, newPath);

        expect(result).toContain("✅ 重命名成功");
        expect(await fileExists(originalDir)).toBe(false);
        expect(await fileExists(newPath)).toBe(true);
      });

      test("应该在原路径不存在时抛出错误", async () => {
        const nonExistentPath = join(tempDir, "non-existent.txt");
        const newPath = join(tempDir, "new.txt");

        await assertThrowsAsync(
          () => renameFileOrDirectory(nonExistentPath, newPath),
          FileSystemError,
          "原路径不存在"
        );
      });

      test("应该支持覆盖模式", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "new content"
        );
        const targetFile = await createTestFile(
          tempDir,
          "target.txt",
          "old content"
        );

        const result = await renameFileOrDirectory(
          sourceFile,
          targetFile,
          true
        );

        expect(result).toContain("✅ 重命名成功");
        expect(await readTestFile(targetFile)).toBe("new content");
      });
    });

    describe("changeFilePermissions", () => {
      test("应该修改文件权限", async () => {
        const testFile = await createTestFile(
          tempDir,
          "perm-test.txt",
          "content"
        );

        const result = await changeFilePermissions(testFile, "644");

        expect(result).toContain("✅ 权限修改成功");
        expect(result).toContain("644");
      });

      test("应该在文件不存在时抛出错误", async () => {
        const nonExistentFile = join(tempDir, "non-existent.txt");

        await assertThrowsAsync(
          () => changeFilePermissions(nonExistentFile, "644"),
          FileSystemError,
          "文件或目录不存在"
        );
      });

      test("应该在权限模式无效时抛出错误", async () => {
        const testFile = await createTestFile(
          tempDir,
          "perm-test.txt",
          "content"
        );

        await assertThrowsAsync(
          () => changeFilePermissions(testFile, "999"),
          FileSystemError,
          "无效的权限模式"
        );

        await assertThrowsAsync(
          () => changeFilePermissions(testFile, "invalid"),
          FileSystemError,
          "无效的权限模式"
        );
      });
    });
  });

  describe("批量操作结果格式化", () => {
    describe("formatBatchOperationResult", () => {
      test("应该格式化成功的批量操作结果", () => {
        const result: BatchOperationResult = {
          results: [
            "file1.txt -> dest/file1.txt",
            "file2.txt -> dest/file2.txt",
          ],
          errors: [],
          totalCount: 2,
          successCount: 2,
          errorCount: 0,
        };

        const formatted = formatBatchOperationResult(result, "复制");

        expect(formatted).toContain("📦 批量复制完成");
        expect(formatted).toContain("✅ 成功 (2 个)");
        expect(formatted).toContain("file1.txt -> dest/file1.txt");
        expect(formatted).toContain("file2.txt -> dest/file2.txt");
        expect(formatted).not.toContain("❌ 失败");
      });

      test("应该格式化有错误的批量操作结果", () => {
        const result: BatchOperationResult = {
          results: ["file1.txt -> dest/file1.txt"],
          errors: ["文件不存在: file2.txt", "权限被拒绝: file3.txt"],
          totalCount: 3,
          successCount: 1,
          errorCount: 2,
        };

        const formatted = formatBatchOperationResult(result, "移动");

        expect(formatted).toContain("📦 批量移动完成");
        expect(formatted).toContain("✅ 成功 (1 个)");
        expect(formatted).toContain("❌ 失败 (2 个)");
        expect(formatted).toContain("文件不存在: file2.txt");
        expect(formatted).toContain("权限被拒绝: file3.txt");
      });

      test("应该格式化完全失败的批量操作结果", () => {
        const result: BatchOperationResult = {
          results: [],
          errors: ["操作失败1", "操作失败2"],
          totalCount: 2,
          successCount: 0,
          errorCount: 2,
        };

        const formatted = formatBatchOperationResult(result, "删除");

        expect(formatted).toContain("📦 批量删除完成");
        expect(formatted).not.toContain("✅ 成功");
        expect(formatted).toContain("❌ 失败 (2 个)");
      });

      test("应该格式化完全成功的批量操作结果", () => {
        const result: BatchOperationResult = {
          results: ["操作成功1", "操作成功2"],
          errors: [],
          totalCount: 2,
          successCount: 2,
          errorCount: 0,
        };

        const formatted = formatBatchOperationResult(result, "处理");

        expect(formatted).toContain("📦 批量处理完成");
        expect(formatted).toContain("✅ 成功 (2 个)");
        expect(formatted).not.toContain("❌ 失败");
      });
    });
  });

  describe("边界条件", () => {
    test("应该处理极长的路径", async () => {
      const longPath = "a".repeat(200) + ".txt";

      try {
        const testFile = await createTestFile(tempDir, longPath, "content");
        const result = await getFileInfoDescription(testFile);
        expect(result).toContain("📋 文件信息");
      } catch (error) {
        if (error.code === "ENAMETOOLONG") {
          console.log("Skipping long path test due to filesystem limitations");
        } else {
          throw error;
        }
      }
    });

    test("应该处理包含特殊字符的文件名", async () => {
      const specialChars = [
        "space file.txt",
        "file-with-dashes.txt",
        "file_with_underscores.txt",
      ];

      for (const fileName of specialChars) {
        const testFile = await createTestFile(tempDir, fileName, "content");
        const result = await getFileInfoDescription(testFile);
        expect(result).toContain(fileName);
      }
    });

    test("应该处理Unicode文件名", async () => {
      const unicodeFile = await createTestFile(
        tempDir,
        "测试文件🚀.txt",
        "Unicode content"
      );

      const result = await getFileInfoDescription(unicodeFile);
      expect(result).toContain("测试文件🚀.txt");
      expect(result).toContain("Unicode content".length.toString());
    });

    test("应该处理大量文件的目录列表", async () => {
      // 创建大量文件
      const fileCount = 100;
      const files = Array.from({ length: fileCount }, (_, i) => ({
        name: `file${i.toString().padStart(3, "0")}.txt`,
        content: `content${i}`,
      }));

      await createTestFiles(tempDir, files);

      const result = await listDirectory(tempDir);

      expect(result).toContain("📁 目录内容");
      // 验证包含了一些文件
      expect(result).toContain("file000.txt");
      expect(result).toContain("file050.txt");
      expect(result).toContain("file099.txt");
    });
  });
});
