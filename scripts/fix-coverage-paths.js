#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 将相对路径解析为相对于项目根目录的路径
 * @param {string} relativePath - 相对路径
 * @param {string} currentPackage - 当前包名
 * @returns {string|null} - 解析后的路径，如果无法解析则返回 null
 */
function resolveToProjectRoot(relativePath, currentPackage) {
  // 如果已经是 packages/ 开头，直接返回标准化的路径
  if (relativePath.includes('packages')) {
    return relativePath.split(path.sep).join('/');
  }
  
  // 模拟当前包目录，解析相对路径
  const currentPackageDir = path.join('packages', currentPackage);
  const resolvedPath = path.resolve(currentPackageDir, relativePath);
  
  // 提取相对于项目根目录的路径
  const projectRoot = path.resolve('.');
  const relativeTo = path.relative(projectRoot, resolvedPath);
  
  // 转换为 POSIX 格式（使用正斜杠）
  return relativeTo.split(path.sep).join('/');
}

/**
 * 修复 lcov.info 文件中的路径
 * @param {string} lcovPath - lcov.info 文件路径
 * @param {string} packageName - 包名称（如 fs-server, exiftool-server, test-utils）
 */
function fixCoveragePaths(lcovPath, packageName) {
  if (!fs.existsSync(lcovPath)) {
    console.log(`⏭️  跳过，覆盖率文件不存在: ${lcovPath}`);
    return;
  }

  console.log(`🔧 修复 ${packageName} 的覆盖率路径...`);
  
  let content = fs.readFileSync(lcovPath, 'utf8');
  const lines = content.split('\n');
  
  const fixedLines = lines.map(line => {
    if (!line.startsWith('SF:')) {
      return line;
    }
    
    // 提取 SF: 后的路径
    const filePath = line.substring(3);
    
    // 使用 path 模块规范化路径
    const normalizedPath = path.normalize(filePath);
    
    // 统一处理相对路径，转换为相对于项目根目录的绝对路径
    const resolvedPath = resolveToProjectRoot(normalizedPath, packageName);
    if (resolvedPath) {
      return `SF:${resolvedPath}`;
    }
    
    // 如果路径已经包含 packages/ 但使用了错误的分隔符，统一为正斜杠
    if (normalizedPath.includes('packages')) {
      const posixPath = normalizedPath.split(path.sep).join('/');
      return `SF:${posixPath}`;
    }
    
    return line;
  });
  
  fs.writeFileSync(lcovPath, fixedLines.join('\n'));
  console.log(`✅ ${packageName} 覆盖率路径修复完成`);
}

// 从命令行参数获取包名
const packageName = process.argv[2];
if (!packageName) {
  console.error('❌ 请提供包名参数: node fix-coverage-paths.js <package-name>');
  process.exit(1);
}

// 构建 lcov.info 文件路径
const lcovPath = path.join(process.cwd(), 'coverage', 'lcov.info');
fixCoveragePaths(lcovPath, packageName);
