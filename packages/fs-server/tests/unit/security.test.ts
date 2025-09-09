/**
 * 安全模块单元测试
 * 测试路径验证、安全配置和权限检查功能
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join, resolve } from 'node:path';
import { promises as fs } from 'node:fs';

// 导入要测试的模块
import {
  initializeSecurity,
  getSecurityConfig,
  normalizePath,
  expandHome,
  isPathWithinAllowedDirectories,
  containsIllegalCharacters,
  validatePath,
  validatePaths,
  checkDirectoryPermissions,
  generateSecureTempFileName,
  validateForceDeleteOperation
} from '../../src/lib/security.js';

import { FileSystemError, FileSystemErrorType } from '../../src/types/index.js';

// 导入测试工具
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createTestDir,
  assertThrowsAsync,
  createTestSecurityConfig,
  isWindows
} from '../utils/test-helpers.js';

describe("安全模块单元测试", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('security-test-');
    
    // 初始化安全配置（使用测试目录）
    initializeSecurity([tempDir]);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("安全配置管理", () => {
    test("应该能获取安全配置", () => {
      const config = getSecurityConfig();

      expect(config.allowedDirectories).toContain(tempDir);
      expect(config.enablePathTraversalProtection).toBe(true);
      expect(config.allowForceDelete).toBe(true);
      expect(config.forceDeleteRequiresConfirmation).toBe(true);
    });

    test("应该正确初始化允许的目录", () => {
      const testDirs = ['/test/dir1', '/test/dir2'];
      initializeSecurity(testDirs);
      
      const config = getSecurityConfig();
      expect(config.allowedDirectories).toEqual(testDirs);
    });
  });

  describe("路径规范化", () => {
    test("应该正确规范化各种路径格式", () => {
      const testCases = [
        { input: './test/../file.txt', expected: 'file.txt' },
        { input: 'dir/./file.txt', expected: join('dir', 'file.txt') },
        { input: 'dir//file.txt', expected: join('dir', 'file.txt') }
      ];

      for (const { input, expected } of testCases) {
        const result = normalizePath(input);
        expect(result).toContain(expected);
      }
    });

    test("应该处理空路径", () => {
      expect(normalizePath('')).toBe('');
      expect(normalizePath('   ')).toContain('   '); // 保留空格
    });

    test("应该在不同平台上正确处理路径分隔符", () => {
      const input = 'dir/subdir\\file.txt';
      const result = normalizePath(input);
      
      if (isWindows) {
        expect(result).toContain('\\');
      } else {
        expect(result).toContain('/');
        expect(result).not.toContain('\\');
      }
    });
  });

  describe("用户主目录展开", () => {
    test("应该展开波浪号路径", () => {
      const testCases = ['~', '~/documents', '~\\documents'];
      
      for (const input of testCases) {
        const result = expandHome(input);
        expect(result).not.toContain('~');
        expect(result).toContain(require('os').homedir());
      }
    });

    test("不应该修改非波浪号路径", () => {
      const testCases = ['/absolute/path', 'relative/path', 'not~home'];
      
      for (const input of testCases) {
        const result = expandHome(input);
        expect(result).toBe(input);
      }
    });
  });

  describe("路径权限验证", () => {
    test("应该允许位于允许目录内的路径", () => {
      const allowedDirs = [tempDir];
      const testPath = join(tempDir, 'subdir', 'file.txt');
      
      expect(isPathWithinAllowedDirectories(testPath, allowedDirs)).toBe(true);
    });

    test("应该拒绝位于允许目录外的路径", () => {
      const allowedDirs = [tempDir];
      const testPath = join('/other/directory', 'file.txt');
      
      expect(isPathWithinAllowedDirectories(testPath, allowedDirs)).toBe(false);
    });

    test("应该防止路径遍历攻击", () => {
      const allowedDirs = [join(tempDir, 'safe')];
      const maliciousPath = join(tempDir, 'safe', '..', '..', 'etc', 'passwd');
      
      expect(isPathWithinAllowedDirectories(maliciousPath, allowedDirs)).toBe(false);
    });

    test("应该正确处理符号链接路径", async () => {
      const allowedDirs = [tempDir];
      const safePath = join(tempDir, 'safe.txt');
      await createTestFile(tempDir, 'safe.txt', 'safe content');
      
      expect(isPathWithinAllowedDirectories(safePath, allowedDirs)).toBe(true);
    });

    test("应该处理空的允许目录列表", () => {
      const testPath = join(tempDir, 'file.txt');
      
      expect(isPathWithinAllowedDirectories(testPath, [])).toBe(false);
    });

    test("应该处理相对路径和绝对路径的混合", () => {
      const allowedDirs = [resolve(tempDir)];
      const relativePath = join('.', 'relative', 'path.txt');
      
      // 相对路径在当前工作目录下的情况
      expect(isPathWithinAllowedDirectories(relativePath, allowedDirs)).toBe(false);
    });
  });

  describe("非法字符检测", () => {
    test("应该检测空字节", () => {
      const pathWithNullByte = 'file\0.txt';
      expect(containsIllegalCharacters(pathWithNullByte)).toBe(true);
    });

    test("应该在Windows上检测非法字符", () => {
      if (isWindows) {
        const illegalChars = ['<', '>', ':', '"', '|', '?', '*'];
        
        for (const char of illegalChars) {
          const pathWithIllegalChar = `file${char}.txt`;
          expect(containsIllegalCharacters(pathWithIllegalChar)).toBe(true);
        }
      }
    });

    test("应该允许正常的文件名字符", () => {
      const validPaths = [
        'normal-file.txt',
        'file_with_underscores.txt',
        'file with spaces.txt',
        '中文文件名.txt'
      ];

      for (const path of validPaths) {
        expect(containsIllegalCharacters(path)).toBe(false);
      }
    });
  });



  describe("路径验证集成测试", () => {
    test("应该验证有效路径", async () => {
      const validFile = await createTestFile(tempDir, 'valid.txt', 'content');
      
      const validatedPath = await validatePath(validFile);
      expect(validatedPath).toBe(resolve(validFile));
    });

    test("应该拒绝空路径", async () => {
      await assertThrowsAsync(
        () => validatePath(''),
        FileSystemError,
        '路径不能为空'
      );
    });


    test("应该拒绝包含非法字符的路径", async () => {
      const illegalPath = 'file\0.txt';
      
      await assertThrowsAsync(
        () => validatePath(illegalPath),
        FileSystemError,
        '路径包含非法字符'
      );
    });

    test("应该拒绝不在允许目录内的路径", async () => {
      const outsidePath = '/etc/passwd';
      
      await assertThrowsAsync(
        () => validatePath(outsidePath),
        FileSystemError,
        '访问被拒绝'
      );
    });

    test("应该验证不存在文件的父目录", async () => {
      const newFile = join(tempDir, 'subdir', 'new-file.txt');
      
      // 创建父目录
      await createTestDir(tempDir, 'subdir');
      
      const validatedPath = await validatePath(newFile);
      expect(validatedPath).toBe(resolve(newFile));
    });

    test("应该拒绝父目录不存在的路径", async () => {
      // 创建一个不在允许目录内的路径
      const invalidPath = join(tempDir, '..', 'outside-allowed', 'file.txt');
      
      await assertThrowsAsync(
        () => validatePath(invalidPath),
        FileSystemError,
        '路径超出允许范围'
      );
    });
  });

  describe("批量路径验证", () => {
    test("应该验证多个有效路径", async () => {
      const file1 = await createTestFile(tempDir, 'file1.txt', 'content1');
      const file2 = await createTestFile(tempDir, 'file2.txt', 'content2');
      
      const validatedPaths = await validatePaths([file1, file2]);
      
      expect(validatedPaths).toHaveLength(2);
      expect(validatedPaths[0]).toBe(resolve(file1));
      expect(validatedPaths[1]).toBe(resolve(file2));
    });

    test("应该在任何路径无效时失败", async () => {
      const validFile = await createTestFile(tempDir, 'valid.txt', 'content');
      const invalidPath = '/etc/passwd';
      
      await assertThrowsAsync(
        () => validatePaths([validFile, invalidPath]),
        FileSystemError,
        '访问被拒绝'
      );
    });
  });

  describe("目录权限检查", () => {
    test("应该验证可读写目录的权限", async () => {
      // 不应该抛出错误
      await checkDirectoryPermissions(tempDir);
    });

    test("应该拒绝不存在的目录", async () => {
      const nonExistentDir = join(tempDir, 'non-existent');
      
      await assertThrowsAsync(
        () => checkDirectoryPermissions(nonExistentDir),
        FileSystemError,
        '目录权限不足'
      );
    });
  });

  describe("安全临时文件名生成", () => {
    test("应该生成唯一的临时文件名", () => {
      const originalPath = join(tempDir, 'file.txt');
      
      const tempName1 = generateSecureTempFileName(originalPath);
      const tempName2 = generateSecureTempFileName(originalPath);
      
      expect(tempName1).not.toBe(tempName2);
      expect(tempName1).toContain(originalPath);
      expect(tempName1).toContain('.tmp');
      expect(tempName2).toContain(originalPath);
      expect(tempName2).toContain('.tmp');
    });

    test("临时文件名应该包含时间戳和随机数", () => {
      const originalPath = join(tempDir, 'file.txt');
      const tempName = generateSecureTempFileName(originalPath);
      
      // 应该包含原始路径
      expect(tempName).toContain('file.txt');
      
      // 应该包含时间戳（数字）
      expect(tempName).toMatch(/\.\d+\./);
      
      // 应该以.tmp结尾
      expect(tempName).toEndWith('.tmp');
    });
  });


  describe("force删除操作验证", () => {
    test("应该在没有elicitInput支持时拒绝执行", async () => {
      // 应该抛出错误，因为无法进行确认
      await assertThrowsAsync(
        () => validateForceDeleteOperation(),
        FileSystemError,
        '用户取消了强制删除操作'
      );
    });
  });

  describe("边界条件测试", () => {
    test("应该处理包含Unicode字符的路径", async () => {
      const unicodeFile = await createTestFile(tempDir, '测试文件🚀.txt', 'Unicode content');
      
      const validatedPath = await validatePath(unicodeFile);
      expect(validatedPath).toBe(resolve(unicodeFile));
    });

    test("应该处理大量的允许目录", () => {
      const manyDirs = Array.from({ length: 1000 }, (_, i) => `/dir${i}`);
      const testPath = join(manyDirs[500], 'file.txt');
      
      const result = isPathWithinAllowedDirectories(testPath, manyDirs);
      expect(result).toBe(true);
    });
  });
});
