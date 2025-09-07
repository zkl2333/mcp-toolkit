import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// 获取项目根目录
const projectRoot = process.cwd();

// 获取所有包的名称
function getPackageNames() {
  const packagesDir = path.join(projectRoot, "packages");
  const packages = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const packageNames = [];

  for (const pkg of packages) {
    const packageJsonPath = path.join(packagesDir, pkg, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      if (packageJson.name) {
        packageNames.push(packageJson.name);
      }
    }
  }

  return packageNames;
}

// 获取从上次发布到现在的 commit 及其修改的文件
function getCommitsWithFiles() {
  try {
    // 获取最新的标签
    const lastTag = execSync("git describe --tags --abbrev=0", {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();

    // 获取从该标签到现在的所有 commit 及其修改的文件
    const commits = execSync(
      `git log ${lastTag}..HEAD --pretty=format:"%H|%s" --name-only`,
      {
        cwd: projectRoot,
        encoding: "utf8",
      }
    ).trim();

    return parseCommitsWithFiles(commits);
  } catch (error) {
    // 如果没有标签，获取所有 commit
    console.log("没有找到标签，获取所有 commit...");
    const commits = execSync(
      'git log --pretty=format:"%H|%s" --name-only',
      {
        cwd: projectRoot,
        encoding: "utf8",
      }
    ).trim();

    return parseCommitsWithFiles(commits);
  }
}

// 解析 commit 和文件信息
function parseCommitsWithFiles(commitsOutput) {
  if (!commitsOutput) return [];

  const commits = [];
  const lines = commitsOutput.split("\n");
  let currentCommit = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 检查是否是 commit 行 (包含 | 分隔符)
    if (trimmedLine.includes("|")) {
      if (currentCommit) {
        commits.push(currentCommit);
      }
      const [hash, message] = trimmedLine.split("|", 2);
      currentCommit = {
        hash: hash.trim(),
        message: message.trim(),
        files: [],
      };
    } else if (currentCommit) {
      // 这是文件路径
      currentCommit.files.push(trimmedLine);
    }
  }

  // 添加最后一个 commit
  if (currentCommit) {
    commits.push(currentCommit);
  }

  return commits;
}

// 根据文件路径确定影响的包
function getAffectedPackages(files, packageNames) {
  const affectedPackages = new Set();

  for (const file of files) {
    // 检查是否在 packages 目录下
    if (file.startsWith("packages/")) {
      const pathParts = file.split("/");
      if (pathParts.length >= 2) {
        const packageDir = pathParts[1];
        
        // 查找对应的包名
        for (const pkgName of packageNames) {
          // 从包名中提取目录名 (例如: @zkl2333/fs-mcp-server -> fs-server)
          const packageDirName = pkgName.split("/").pop();
          if (packageDirName === packageDir) {
            affectedPackages.add(pkgName);
            break;
          }
        }
      }
    } else {
      // 根目录的文件变更影响所有包
      for (const pkgName of packageNames) {
        affectedPackages.add(pkgName);
      }
    }
  }

  return Array.from(affectedPackages);
}

// 根据 commit 消息确定变更类型
function getChangeType(commitMessage) {
  const msg = commitMessage.toLowerCase();

  // 主要功能 (major)
  if (msg.includes("breaking") || msg.includes("!:") || msg.startsWith("!")) {
    return "major";
  }

  // 新功能 (minor)
  if (msg.startsWith("feat") || msg.startsWith("feature")) {
    return "minor";
  }

  // 修复 (patch)
  if (msg.startsWith("fix") || msg.startsWith("bugfix")) {
    return "patch";
  }

  // 文档更新 (patch)
  if (msg.startsWith("docs") || msg.startsWith("doc")) {
    return "patch";
  }

  // 样式更新 (patch)
  if (msg.startsWith("style")) {
    return "patch";
  }

  // 重构 (patch)
  if (msg.startsWith("refactor")) {
    return "patch";
  }

  // 性能优化 (patch)
  if (msg.startsWith("perf")) {
    return "patch";
  }

  // 测试 (patch)
  if (msg.startsWith("test")) {
    return "patch";
  }

  // 构建相关 (patch)
  if (
    msg.startsWith("build") ||
    msg.startsWith("ci") ||
    msg.startsWith("chore")
  ) {
    return "patch";
  }

  return null;
}

// 生成变更集内容
function generateChangesetContent(commitMessage, changeType, affectedPackages) {
  if (affectedPackages.length === 0) {
    return null; // 如果没有受影响的包，不生成变更集
  }

  const changesetEntries = affectedPackages
    .map((pkg) => `"${pkg}": ${changeType}`)
    .join("\n");

  return `---
${changesetEntries}
---

${commitMessage}
`;
}

// 确保 .changeset 目录存在
function ensureChangesetDir() {
  const changesetDir = path.join(projectRoot, ".changeset");
  if (!fs.existsSync(changesetDir)) {
    fs.mkdirSync(changesetDir, { recursive: true });
  }
}

// 生成唯一的文件名
function generateUniqueFileName(commitMessage, index) {
  // 清理 commit 消息，移除特殊字符
  const cleanMessage = commitMessage
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 50);

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .split("T")[0];
  return `auto-${timestamp}-${index}-${cleanMessage}.md`;
}

// 主函数
function main() {
  try {
    console.log("🚀 开始自动生成变更集...");

    // 获取包名
    const packageNames = getPackageNames();
    if (packageNames.length === 0) {
      console.error("❌ 没有找到任何包");
      process.exit(1);
    }

    console.log(
      `📦 找到 ${packageNames.length} 个包:`,
      packageNames.join(", ")
    );

    // 获取 commit 及其修改的文件
    const commits = getCommitsWithFiles();
    if (commits.length === 0) {
      console.log("✅ 没有新的 commit，无需生成变更集");
      return;
    }

    console.log(`📝 找到 ${commits.length} 个新的 commit`);

    // 确保 .changeset 目录存在
    ensureChangesetDir();

    let generatedCount = 0;

    // 处理每个 commit
    commits.forEach((commit, index) => {
      const changeType = getChangeType(commit.message);

      if (!changeType) {
        console.log(`⏭️  跳过 commit: ${commit.message} (无法确定变更类型)`);
        return;
      }

      // 分析影响的包
      const affectedPackages = getAffectedPackages(commit.files, packageNames);
      
      if (affectedPackages.length === 0) {
        console.log(`⏭️  跳过 commit: ${commit.message} (没有影响的包)`);
        return;
      }

      const content = generateChangesetContent(
        commit.message,
        changeType,
        affectedPackages
      );

      if (!content) {
        console.log(`⏭️  跳过 commit: ${commit.message} (无法生成变更集内容)`);
        return;
      }

      const fileName = generateUniqueFileName(commit.message, index);
      const filePath = path.join(projectRoot, ".changeset", fileName);

      fs.writeFileSync(filePath, content);
      console.log(`✅ 生成变更集: ${fileName} (${changeType}) - 影响包: ${affectedPackages.join(", ")}`);
      generatedCount++;
    });

    if (generatedCount > 0) {
      console.log(`\n🎉 成功生成 ${generatedCount} 个变更集文件`);
      console.log('💡 提示: 运行 "bun run changeset:version" 来更新版本号');
    } else {
      console.log("ℹ️  没有生成任何变更集文件");
    }
  } catch (error) {
    console.error("❌ 生成变更集时出错:", error.message);
    process.exit(1);
  }
}

main();
