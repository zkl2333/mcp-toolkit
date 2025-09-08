/**
 * 测试配置文件
 * 统一管理测试环境配置和通用设置
 */

export const TEST_CONFIG = {
  // 测试超时设置
  timeouts: {
    unit: 5000,          // 单元测试：5秒
    integration: 30000,  // 集成测试：30秒
    performance: 60000,  // 性能测试：60秒
    security: 30000      // 安全测试：30秒
  },

  // 性能测试基准
  performance: {
    maxFileInfoTime: 50,     // 单次文件信息获取最大时间（毫秒）
    maxFileCopyTime: 100,    // 单次文件复制最大时间（毫秒）
    minOpsPerSecond: 40,     // 最小操作频率（操作/秒）
    maxMemoryGrowth: 50,     // 最大内存增长（MB）
    maxBatchTime: 15000,     // 批量操作最大时间（毫秒）
    maxConcurrentTime: 10000 // 并发操作最大时间（毫秒）
  },

  // 测试文件大小设置
  fileSizes: {
    small: 1024,             // 1KB
    medium: 10 * 1024,       // 10KB
    large: 1024 * 1024,      // 1MB
    veryLarge: 5 * 1024 * 1024, // 5MB
    testLimit: 10 * 1024 * 1024  // 10MB（测试文件大小限制）
  },

  // 批量测试设置
  batch: {
    smallBatch: 10,
    mediumBatch: 50,
    largeBatch: 100,
    stressBatch: 500
  },

  // 并发测试设置
  concurrent: {
    lowConcurrency: 5,
    mediumConcurrency: 20,
    highConcurrency: 50,
    stressConcurrency: 200
  },

  // 安全测试设置
  security: {
    maxFileSize: 1024,        // 安全测试中的文件大小限制（1KB）
    restrictedExtensions: ['.exe', '.bat', '.sh', '.cmd'],
    // 常见的路径遍历攻击向量
    pathTraversalVectors: [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'file\0../../../etc/passwd',
      '%252E%252E%252F%252E%252E%252F',
      '..\u002E\u002F..\u002F..'
    ],
    // Windows特定攻击向量
    windowsAttackVectors: [
      'C:\\Windows\\System32\\config\\SAM',
      'C:\\Users\\Administrator\\Desktop\\sensitive.txt',
      '\\\\server\\share\\file.txt',
      '\\\\localhost\\c$\\Windows\\System32'
    ]
  },

  // 边界测试设置
  boundaries: {
    maxPathDepth: 30,         // 最大路径深度
    maxFileNameLength: 200,   // 最大文件名长度
    largeDirectorySize: 1000, // 大目录中的文件数量
    longPathSize: 10000       // 超长路径长度
  }
};

/**
 * 获取环境特定的配置
 */
export function getEnvironmentConfig() {
  const isCI = process.env.CI === 'true';
  const isWindows = process.platform === 'win32';
  
  return {
    isCI,
    isWindows,
    // 在CI环境中使用更宽松的性能要求
    performanceMultiplier: isCI ? 2 : 1,
    // Windows上某些测试需要跳过
    skipSymlinkTests: isWindows,
    // CI环境可能需要更多时间
    timeoutMultiplier: isCI ? 1.5 : 1
  };
}

/**
 * 生成测试用的随机文件名
 */
export function generateTestFileName(prefix: string = 'test', suffix: string = '.txt'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}${suffix}`;
}

/**
 * 生成指定大小的测试内容
 */
export function generateTestContent(size: number): string {
  const chunk = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const chunkCount = Math.ceil(size / chunk.length);
  return chunk.repeat(chunkCount).substring(0, size);
}

/**
 * 测试断言辅助函数
 */
export const assertions = {
  /**
   * 断言操作在指定时间内完成
   */
  assertWithinTime<T>(operation: () => Promise<T>, maxTime: number): Promise<{ result: T; duration: number }> {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      
      try {
        const result = await operation();
        const duration = Date.now() - startTime;
        
        if (duration > maxTime) {
          reject(new Error(`Operation took ${duration}ms, expected less than ${maxTime}ms`));
        } else {
          resolve({ result, duration });
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * 断言内存使用在合理范围内
   */
  assertMemoryUsage(beforeMemory: NodeJS.MemoryUsage, afterMemory: NodeJS.MemoryUsage, maxGrowthMB: number): void {
    const growthBytes = afterMemory.heapUsed - beforeMemory.heapUsed;
    const growthMB = growthBytes / (1024 * 1024);
    
    if (growthMB > maxGrowthMB) {
      throw new Error(`Memory growth ${growthMB.toFixed(2)}MB exceeds limit ${maxGrowthMB}MB`);
    }
  },

  /**
   * 断言批量操作结果符合预期
   */
  assertBatchResult(result: any, expectedSuccess: number, expectedFailures: number): void {
    const successText = result.content[0]?.text || '';
    
    if (expectedSuccess > 0) {
      if (!successText.includes(`成功`) || !successText.includes(`(${expectedSuccess} 个)`)) {
        throw new Error(`Expected ${expectedSuccess} successes, but result was: ${successText}`);
      }
    }
    
    if (expectedFailures > 0) {
      if (!successText.includes(`失败`) || !successText.includes(`(${expectedFailures} 个)`)) {
        throw new Error(`Expected ${expectedFailures} failures, but result was: ${successText}`);
      }
    }
  }
};

/**
 * 特殊文件名测试用例
 */
export const SPECIAL_FILENAMES = [
  // Unicode文件名
  '测试文件.txt',
  'файл.txt', 
  'αρχείο.txt',
  'ファイル.txt',
  
  // Emoji文件名
  '🚀🎉💯.txt',
  
  // 特殊字符
  'file with spaces.txt',
  'file-with-dashes.txt',
  'file_with_underscores.txt',
  'file.with.dots.txt',
  
  // 边界情况
  'a'.repeat(100) + '.txt', // 长文件名
  '.hidden-file.txt',       // 隐藏文件
  'UPPERCASE.TXT',          // 大写文件名
  'MixedCase.Txt'           // 混合大小写
];

export default TEST_CONFIG;
