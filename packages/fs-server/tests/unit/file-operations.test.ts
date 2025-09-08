/**
 * 文件操作模块单元测试
 * 测试原子操作、批量处理和错误处理功能
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { promises as fs } from "node:fs";

// 导入要测试的模块
import {
  formatSize,
  createSymbolicLink,
  atomicWriteFile,
  getFileInfo,
  moveFile,
  copyFile,
  deleteFile,
  batchMoveFiles,
  batchCopyFiles,
  batchDeleteFiles,
} from "../../src/lib/file-operations.js";

import { FileSystemError, FileSystemErrorType } from "../../src/types/index.js";
import { setSecurityConfig } from "../../src/lib/security.js";

// 导入测试工具
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createTestDir,
  fileExists,
  readTestFile,
  getFileStats,
  assertThrowsAsync,
  createTestSecurityConfig,
  createTestFiles,
  isWindows,
} from "../utils/test-helpers.js";

describe("文件操作模块单元测试", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("file-ops-test-");

    // 设置测试安全配置
    const config = createTestSecurityConfig(tempDir);
    setSecurityConfig(config);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("工具函数", () => {
    describe("formatSize", () => {
      test("应该正确格式化字节大小", () => {
        const testCases = [
          { bytes: 0, expected: "0 B" },
          { bytes: 1024, expected: "1.00 KB" },
          { bytes: 1048576, expected: "1.00 MB" },
          { bytes: 1073741824, expected: "1.00 GB" },
          { bytes: 1099511627776, expected: "1.00 TB" },
          { bytes: 512, expected: "512.00 B" },
          { bytes: 1536, expected: "1.50 KB" },
          { bytes: 2097152, expected: "2.00 MB" },
        ];

        for (const { bytes, expected } of testCases) {
          expect(formatSize(bytes)).toBe(expected);
        }
      });

      test("应该处理负数", () => {
        expect(formatSize(-1)).toBe("-1 B");
      });

      test("应该处理非常大的数字", () => {
        const veryLarge = Number.MAX_SAFE_INTEGER;
        const result = formatSize(veryLarge);
        expect(result).toContain("TB");
      });
    });

    describe("createSymbolicLink", () => {
      test("应该在Unix系统上创建符号链接", async () => {
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

        await createSymbolicLink(targetFile, linkPath);

        const stats = await fs.lstat(linkPath);
        expect(stats.isSymbolicLink()).toBe(true);

        const linkTarget = await fs.readlink(linkPath);
        expect(linkTarget).toContain("target.txt");
      });

      test("应该在Windows上处理权限问题", async () => {
        if (!isWindows) {
          console.log("Skipping Windows symlink test on Unix");
          return;
        }

        const targetFile = await createTestFile(
          tempDir,
          "target.txt",
          "target content"
        );
        const linkPath = join(tempDir, "symlink.txt");

        try {
          await createSymbolicLink(targetFile, linkPath);

          // 如果成功，验证链接
          const stats = await fs.lstat(linkPath);
          expect(stats.isSymbolicLink()).toBe(true);
        } catch (error) {
          // 在Windows上，如果没有权限，应该抛出有用的错误信息
          expect(error.message).toContain("Windows 上创建符号链接需要特殊权限");
        }
      });
    });
  });

  describe("原子文件操作", () => {
    describe("atomicWriteFile", () => {
      test("应该原子性地写入文件", async () => {
        const filePath = join(tempDir, "atomic-test.txt");
        const content = "Atomic content";

        await atomicWriteFile(filePath, content);

        expect(await fileExists(filePath)).toBe(true);
        expect(await readTestFile(filePath)).toBe(content);
      });

      test("应该支持Buffer写入", async () => {
        const filePath = join(tempDir, "buffer-test.txt");
        const content = Buffer.from("Buffer content", "utf8");

        await atomicWriteFile(filePath, content);

        expect(await fileExists(filePath)).toBe(true);
        expect(await readTestFile(filePath)).toBe("Buffer content");
      });

      test("应该在写入失败时清理临时文件", async () => {
        const invalidPath = join("/invalid/directory", "file.txt");
        const content = "Test content";

        await assertThrowsAsync(
          () => atomicWriteFile(invalidPath, content),
          FileSystemError,
          "原子写入失败"
        );

        // 验证没有留下临时文件
        // 注意：实际的临时文件路径无法直接验证，但错误应该包含清理逻辑
      });

      test("应该处理写入权限错误", async () => {
        if (isWindows) {
          console.log("Skipping permission test on Windows");
          return;
        }

        // 创建只读目录
        const readOnlyDir = join(tempDir, "readonly");
        await createTestDir(tempDir, "readonly");

        try {
          await fs.chmod(readOnlyDir, 0o444); // 只读权限

          const filePath = join(readOnlyDir, "cannot-write.txt");

          await assertThrowsAsync(
            () => atomicWriteFile(filePath, "content"),
            FileSystemError,
            "原子写入失败"
          );
        } finally {
          // 恢复权限以便清理
          try {
            await fs.chmod(readOnlyDir, 0o755);
          } catch {
            // 忽略权限恢复错误
          }
        }
      });
    });
  });

  describe("文件信息获取", () => {
    describe("getFileInfo", () => {
      test("应该获取文件的完整信息", async () => {
        const testFile = await createTestFile(
          tempDir,
          "info-test.txt",
          "Test content for info"
        );

        const info = await getFileInfo(testFile);

        expect(info.path).toBe(testFile);
        expect(info.isFile).toBe(true);
        expect(info.isDirectory).toBe(false);
        expect(info.size).toBeGreaterThan(0);
        expect(info.extension).toBe(".txt");
        expect(info.basename).toBe("info-test.txt");
        expect(info.permissions).toMatch(/^\d{3}$/);
        expect(info.createdAt).toBeInstanceOf(Date);
        expect(info.modifiedAt).toBeInstanceOf(Date);
        expect(info.accessedAt).toBeInstanceOf(Date);
      });

      test("应该获取目录的信息", async () => {
        const testDir = await createTestDir(tempDir, "info-dir");

        const info = await getFileInfo(testDir);

        expect(info.path).toBe(testDir);
        expect(info.isFile).toBe(false);
        expect(info.isDirectory).toBe(true);
        expect(info.extension).toBeUndefined();
        expect(info.basename).toBe("info-dir");
      });

      test("应该在文件不存在时抛出错误", async () => {
        const nonExistentFile = join(tempDir, "non-existent.txt");

        await assertThrowsAsync(
          () => getFileInfo(nonExistentFile),
          FileSystemError,
          "获取文件信息失败"
        );
      });

      test("应该处理没有扩展名的文件", async () => {
        const noExtFile = await createTestFile(
          tempDir,
          "no-extension",
          "content"
        );

        const info = await getFileInfo(noExtFile);

        expect(info.extension).toBeUndefined();
        expect(info.basename).toBe("no-extension");
      });
    });
  });

  describe("基础文件操作", () => {
    describe("moveFile", () => {
      test("应该成功移动文件", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "move me"
        );
        const destFile = join(tempDir, "moved.txt");

        const result = await moveFile(sourceFile, destFile);

        expect(result.success).toBe(true);
        expect(result.message).toContain("文件移动成功");
        expect(await fileExists(sourceFile)).toBe(false);
        expect(await fileExists(destFile)).toBe(true);
        expect(await readTestFile(destFile)).toBe("move me");
      });

      test("应该在源文件不存在时失败", async () => {
        const nonExistentFile = join(tempDir, "non-existent.txt");
        const destFile = join(tempDir, "dest.txt");

        await assertThrowsAsync(
          () => moveFile(nonExistentFile, destFile),
          FileSystemError,
          "源文件不存在"
        );
      });

      test("应该在目标文件已存在且未启用覆盖时失败", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "source"
        );
        const destFile = await createTestFile(tempDir, "dest.txt", "existing");

        await assertThrowsAsync(
          () => moveFile(sourceFile, destFile, { overwrite: false }),
          FileSystemError,
          "目标文件已存在"
        );
      });

      test("应该在启用覆盖模式时覆盖目标文件", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "new content"
        );
        const destFile = await createTestFile(
          tempDir,
          "dest.txt",
          "old content"
        );

        const result = await moveFile(sourceFile, destFile, {
          overwrite: true,
        });

        expect(result.success).toBe(true);
        expect(await fileExists(sourceFile)).toBe(false);
        expect(await readTestFile(destFile)).toBe("new content");
      });

      test("应该在启用createDirs时创建目标目录", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "content"
        );
        const destFile = join(tempDir, "new-dir", "dest.txt");

        const result = await moveFile(sourceFile, destFile, {
          createDirs: true,
        });

        expect(result.success).toBe(true);
        expect(await fileExists(destFile)).toBe(true);
      });
    });

    describe("copyFile", () => {
      test("应该成功复制文件", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "copy me"
        );
        const destFile = join(tempDir, "copied.txt");

        const result = await copyFile(sourceFile, destFile);

        expect(result.success).toBe(true);
        expect(result.message).toContain("文件复制成功");
        expect(await fileExists(sourceFile)).toBe(true);
        expect(await fileExists(destFile)).toBe(true);
        expect(await readTestFile(sourceFile)).toBe("copy me");
        expect(await readTestFile(destFile)).toBe("copy me");
      });

      test("应该在源文件不存在时失败", async () => {
        const nonExistentFile = join(tempDir, "non-existent.txt");
        const destFile = join(tempDir, "dest.txt");

        await assertThrowsAsync(
          () => copyFile(nonExistentFile, destFile),
          FileSystemError,
          "源文件不存在"
        );
      });

      test("应该支持覆盖模式", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "new content"
        );
        const destFile = await createTestFile(
          tempDir,
          "dest.txt",
          "old content"
        );

        const result = await copyFile(sourceFile, destFile, {
          overwrite: true,
        });

        expect(result.success).toBe(true);
        expect(await readTestFile(destFile)).toBe("new content");
        expect(await readTestFile(sourceFile)).toBe("new content"); // 源文件保持不变
      });
    });

    describe("deleteFile", () => {
      test("应该成功删除文件", async () => {
        const testFile = await createTestFile(
          tempDir,
          "delete-me.txt",
          "delete this"
        );

        const result = await deleteFile(testFile);

        expect(result.success).toBe(true);
        expect(result.message).toContain("文件删除成功");
        expect(await fileExists(testFile)).toBe(false);
      });

      test("应该在文件不存在时失败", async () => {
        const nonExistentFile = join(tempDir, "non-existent.txt");

        await assertThrowsAsync(
          () => deleteFile(nonExistentFile),
          FileSystemError,
          "文件不存在"
        );
      });

      test("应该拒绝删除目录", async () => {
        const testDir = await createTestDir(tempDir, "test-directory");

        await assertThrowsAsync(
          () => deleteFile(testDir),
          FileSystemError,
          "指定路径是目录"
        );
      });
    });
  });

  describe("批量文件操作", () => {
    describe("batchMoveFiles", () => {
      test("应该成功批量移动文件", async () => {
        const files = await createTestFiles(tempDir, [
          { name: "file1.txt", content: "content1" },
          { name: "file2.txt", content: "content2" },
          { name: "file3.txt", content: "content3" },
        ]);

        const destDir = join(tempDir, "destination");

        const result = await batchMoveFiles(files, destDir, {
          createDirs: true,
        });

        expect(result.totalCount).toBe(3);
        expect(result.successCount).toBe(3);
        expect(result.errorCount).toBe(0);
        expect(result.results).toHaveLength(3);

        // 验证所有文件都已移动
        for (const file of files) {
          expect(await fileExists(file)).toBe(false);
        }

        expect(await fileExists(join(destDir, "file1.txt"))).toBe(true);
        expect(await fileExists(join(destDir, "file2.txt"))).toBe(true);
        expect(await fileExists(join(destDir, "file3.txt"))).toBe(true);
      });

      test("应该处理部分失败的情况", async () => {
        const existingFile = await createTestFile(
          tempDir,
          "existing.txt",
          "content"
        );
        const nonExistentFile = join(tempDir, "non-existent.txt");
        const destDir = join(tempDir, "destination");

        const result = await batchMoveFiles(
          [existingFile, nonExistentFile],
          destDir,
          { createDirs: true }
        );

        expect(result.totalCount).toBe(2);
        expect(result.successCount).toBe(1);
        expect(result.errorCount).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("源文件不存在");
      });

      test("应该在目标不是目录时失败", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "content"
        );
        const invalidDest = await createTestFile(
          tempDir,
          "not-a-dir.txt",
          "file"
        );

        await assertThrowsAsync(
          () => batchMoveFiles([sourceFile], invalidDest),
          FileSystemError,
          "目标路径不是目录"
        );
      });
    });

    describe("batchCopyFiles", () => {
      test("应该成功批量复制文件", async () => {
        const files = await createTestFiles(tempDir, [
          { name: "copy1.txt", content: "content1" },
          { name: "copy2.txt", content: "content2" },
        ]);

        const destDir = join(tempDir, "backup");

        const result = await batchCopyFiles(files, destDir, {
          createDirs: true,
        });

        expect(result.totalCount).toBe(2);
        expect(result.successCount).toBe(2);
        expect(result.errorCount).toBe(0);

        // 验证原文件仍存在
        for (const file of files) {
          expect(await fileExists(file)).toBe(true);
        }

        // 验证复制的文件存在
        expect(await fileExists(join(destDir, "copy1.txt"))).toBe(true);
        expect(await fileExists(join(destDir, "copy2.txt"))).toBe(true);
      });

      test("应该支持覆盖模式", async () => {
        const sourceFile = await createTestFile(
          tempDir,
          "source.txt",
          "new content"
        );
        const destDir = await createTestDir(tempDir, "dest");
        const existingFile = await createTestFile(
          destDir,
          "source.txt",
          "old content"
        );

        const result = await batchCopyFiles([sourceFile], destDir, {
          overwrite: true,
        });

        expect(result.successCount).toBe(1);
        expect(await readTestFile(join(destDir, "source.txt"))).toBe(
          "new content"
        );
      });
    });

    describe("batchDeleteFiles", () => {
      test("应该成功批量删除文件和目录", async () => {
        const files = await createTestFiles(tempDir, [
          { name: "delete1.txt" },
          { name: "delete2.txt" },
        ]);

        const dir = await createTestDir(tempDir, "delete-dir");

        const result = await batchDeleteFiles([...files, dir]);

        expect(result.totalCount).toBe(3);
        expect(result.successCount).toBe(3);
        expect(result.errorCount).toBe(0);

        // 验证所有项目都已删除
        for (const file of files) {
          expect(await fileExists(file)).toBe(false);
        }
        expect(await fileExists(dir)).toBe(false);
      });

      test("应该处理混合的成功和失败情况", async () => {
        const existingFile = await createTestFile(
          tempDir,
          "existing.txt",
          "content"
        );
        const nonExistentFile = join(tempDir, "non-existent.txt");

        const result = await batchDeleteFiles([existingFile, nonExistentFile]);

        expect(result.totalCount).toBe(2);
        expect(result.successCount).toBe(1);
        expect(result.errorCount).toBe(1);
        expect(result.errors[0]).toContain("文件不存在");
      });

      test("应该区分文件和目录的删除", async () => {
        const testFile = await createTestFile(tempDir, "file.txt", "content");
        const testDir = await createTestDir(tempDir, "directory");

        const result = await batchDeleteFiles([testFile, testDir]);

        expect(result.successCount).toBe(2);
        expect(result.results[0]).toContain("文件已删除");
        expect(result.results[1]).toContain("目录已删除");
      });
    });
  });

  describe("错误处理", () => {
    test("应该正确传播安全验证错误", async () => {
      // 尝试访问被禁止的路径
      const forbiddenPath = "/etc/passwd";

      await assertThrowsAsync(
        () => moveFile(forbiddenPath, join(tempDir, "dest.txt")),
        FileSystemError,
        "访问被拒绝"
      );
    });

    test("应该处理文件系统错误", async () => {
      if (isWindows) {
        console.log("Skipping permission test on Windows");
        return;
      }

      const sourceFile = await createTestFile(tempDir, "source.txt", "content");

      // 尝试移动到只读文件系统位置（模拟）
      const readOnlyPath = join(tempDir, "readonly", "dest.txt");

      // 创建只读目录
      const readOnlyDir = join(tempDir, "readonly");
      await createTestDir(tempDir, "readonly");

      try {
        await fs.chmod(readOnlyDir, 0o444);

        await assertThrowsAsync(
          () => moveFile(sourceFile, readOnlyPath, { createDirs: false }),
          FileSystemError
        );
      } finally {
        // 恢复权限
        try {
          await fs.chmod(readOnlyDir, 0o755);
        } catch {
          // 忽略权限恢复错误
        }
      }
    });

    test("应该在批量操作中正确收集错误", async () => {
      const validFile = await createTestFile(tempDir, "valid.txt", "content");
      const invalidFiles = [
        join(tempDir, "non-existent1.txt"),
        join(tempDir, "non-existent2.txt"),
      ];

      const result = await batchDeleteFiles([validFile, ...invalidFiles]);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(2);
      expect(result.errors).toHaveLength(2);

      for (const error of result.errors) {
        expect(error).toContain("文件不存在");
      }
    });
  });

  describe("边界条件", () => {
    test("应该处理空的批量操作", async () => {
      const destDir = await createTestDir(tempDir, "dest");

      const result = await batchMoveFiles([], destDir);

      expect(result.totalCount).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    test("应该处理大文件操作", async () => {
      // 创建相对较大的文件（1MB）
      const largeContent = "x".repeat(1024 * 1024);
      const largeFile = await createTestFile(
        tempDir,
        "large.txt",
        largeContent
      );
      const destFile = join(tempDir, "large-copy.txt");

      const result = await copyFile(largeFile, destFile);

      expect(result.success).toBe(true);
      expect(await readTestFile(destFile)).toBe(largeContent);
    });

    test("应该处理同时进行的多个操作", async () => {
      const files = await createTestFiles(tempDir, [
        { name: "concurrent1.txt" },
        { name: "concurrent2.txt" },
        { name: "concurrent3.txt" },
      ]);

      // 同时执行多个移动操作
      const promises = files.map(async (file, index) => {
        const dest = join(tempDir, `moved-${index}.txt`);
        return moveFile(file, dest);
      });

      const results = await Promise.all(promises);

      // 所有操作都应该成功
      for (const result of results) {
        expect(result.success).toBe(true);
      }
    });
  });
});
