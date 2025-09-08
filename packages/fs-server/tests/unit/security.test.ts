/**
 * 安全模块单元测试
 * 测试路径验证、安全配置和权限检查功能
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join, resolve } from 'node:path';
import { promises as fs } from 'node:fs';

// 导入要测试的模块
import {
  setSecurityConfig,
  getSecurityConfig,
  normalizePath,
  expandHome,
  isPathWithinAllowedDirectories,
  containsIllegalCharacters,
  isRestrictedExtension,
  validateFileSize,
  validateSymlinkSecurity,
  validatePath,
  validatePaths,
  checkDirectoryPermissions,
  generateSecureTempFileName
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
    
    // 设置测试安全配置
    const config = createTestSecurityConfig(tempDir);
    setSecurityConfig(config);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("安全配置管理", () => {
    test("应该能设置和获取安全配置", () => {
      const testConfig = {
        allowedDirectories: ['/test/dir'],
        maxFileSize: 5000,
        restrictedExtensions: ['.test'],
        enableSymlinkValidation: false,
        enablePathTraversalProtection: true
      };

      setSecurityConfig(testConfig);
      const retrievedConfig = getSecurityConfig();

      expect(retrievedConfig.allowedDirectories).toContain('/test/dir');
      expect(retrievedConfig.maxFileSize).toBe(5000);
      expect(retrievedConfig.restrictedExtensions).toContain('.test');
      expect(retrievedConfig.enableSymlinkValidation).toBe(false);
      expect(retrievedConfig.enablePathTraversalProtection).toBe(true);
    });

    test("应该支持部分配置更新", () => {
      const initialConfig = createTestSecurityConfig(tempDir, {
        maxFileSize: 1000,
        restrictedExtensions: ['.old']
      });
      setSecurityConfig(initialConfig);

      // 部分更新
      setSecurityConfig({
        maxFileSize: 2000,
        restrictedExtensions: ['.new']
      });

      const config = getSecurityConfig();
      expect(config.maxFileSize).toBe(2000);
      expect(config.restrictedExtensions).toContain('.new');
      // 应该保留其他设置
      expect(config.allowedDirectories).toEqual(initialConfig.allowedDirectories);
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

  describe("文件扩展名限制", () => {
    test("应该检测受限制的文件扩展名", () => {
      const restrictedFiles = [
        'malware.exe',
        'script.bat',
        'PROGRAM.EXE', // 测试大小写不敏感
      ];

      for (const file of restrictedFiles) {
        expect(isRestrictedExtension(file)).toBe(true);
      }
    });

    test("应该允许安全的文件扩展名", () => {
      const safeFiles = [
        'document.txt',
        'image.jpg',
        'data.json',
        'script.js',
        'no-extension'
      ];

      for (const file of safeFiles) {
        expect(isRestrictedExtension(file)).toBe(false);
      }
    });
  });

  describe("文件大小验证", () => {
    test("应该允许小于限制的文件", async () => {
      const smallFile = await createTestFile(tempDir, 'small.txt', 'small');
      
      // 不应该抛出错误
      await validateFileSize(smallFile);
    });

    test("应该拒绝超过大小限制的文件", async () => {
      // 设置很小的大小限制
      setSecurityConfig({ maxFileSize: 10 });
      
      const largeContent = 'x'.repeat(100);
      const largeFile = await createTestFile(tempDir, 'large.txt', largeContent);
      
      await assertThrowsAsync(
        () => validateFileSize(largeFile),
        FileSystemError,
        '文件大小超过限制'
      );
    });

    test("应该优雅地处理不存在的文件", async () => {
      const nonExistentFile = join(tempDir, 'non-existent.txt');
      
      // 不应该抛出错误（跳过大小检查）
      await validateFileSize(nonExistentFile);
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

    test("应该拒绝受限制扩展名的文件", async () => {
      const restrictedPath = join(tempDir, 'malware.exe');
      
      await assertThrowsAsync(
        () => validatePath(restrictedPath),
        FileSystemError,
        '不允许访问此类型的文件'
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

  describe("符号链接安全验证", () => {
    test("应该在禁用验证时跳过符号链接检查", async () => {
      setSecurityConfig({ enableSymlinkValidation: false });
      
      const testPath = join(tempDir, 'test.txt');
      const result = await validateSymlinkSecurity(testPath);
      
      expect(result).toBe(testPath);
    });

    test("应该验证不存在的符号链接", async () => {
      if (isWindows) {
        console.log('Skipping symlink test on Windows');
        return;
      }

      const nonExistentLink = join(tempDir, 'broken-link');
      
      await assertThrowsAsync(
        () => validateSymlinkSecurity(nonExistentLink),
        FileSystemError,
        '无法解析符号链接'
      );
    });
  });

  describe("边界条件测试", () => {
    test("应该处理非常长的路径", async () => {
      const longFileName = 'a'.repeat(100) + '.txt';
      const longPath = join(tempDir, longFileName);
      
      try {
        await createTestFile(tempDir, longFileName, 'content');
        const validatedPath = await validatePath(longPath);
        expect(validatedPath).toBe(resolve(longPath));
      } catch (error) {
        // 某些文件系统可能不支持很长的文件名
        if (error.code === 'ENAMETOOLONG') {
          console.log('Skipping long path test due to filesystem limitations');
        } else {
          throw error;
        }
      }
    });

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
