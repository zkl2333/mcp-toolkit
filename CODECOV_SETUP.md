# Codecov 设置指南

本项目使用 [Codecov](https://codecov.io/) 来自动生成和展示测试覆盖率徽章。以下是完整的设置步骤：

## 1. 替换 GitHub 仓库信息

在以下文件中，将 `YOUR_GITHUB_USERNAME` 替换为你的实际 GitHub 用户名或组织名：

### 根目录 README.md
```markdown
[![codecov](https://codecov.io/gh/zkl2333/mcp-toolkit/graph/badge.svg?flag=fs-server)](https://codecov.io/gh/YOUR_GITHUB_USERNAME/mcp-toolkit)
```

### packages/fs-server/README.md
```markdown
[![codecov](https://codecov.io/gh/zkl2333/mcp-toolkit/graph/badge.svg?flag=fs-server)](https://codecov.io/gh/YOUR_GITHUB_USERNAME/mcp-toolkit)
```

### packages/exiftool-server/README.md
```markdown
[![codecov](https://codecov.io/gh/zkl2333/mcp-toolkit/graph/badge.svg?flag=exiftool-server)](https://codecov.io/gh/YOUR_GITHUB_USERNAME/mcp-toolkit)
```

## 2. 设置 Codecov

1. 访问 [codecov.io](https://codecov.io/) 并使用 GitHub 账号登录
2. 添加你的 GitHub 仓库 `mcp-toolkit`
3. 获取 Codecov 上传令牌 (Upload Token)

## 3. 配置 GitHub Secrets

在你的 GitHub 仓库中设置以下 Secret：

1. 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加：
   - Name: `CODECOV_TOKEN`
   - Value: 从 Codecov 获取的上传令牌

## 4. 推送代码

一旦配置完成，每次推送代码到 `main` 或 `develop` 分支，或创建 Pull Request 时：

1. GitHub Actions 会自动运行测试
2. 生成覆盖率报告（lcov 格式）
3. 上传到 Codecov
4. 徽章会自动更新显示最新的覆盖率数据

## 5. 验证设置

设置完成后，你可以：

1. 推送一个测试提交触发 GitHub Actions
2. 检查 Actions 标签页确认工作流运行成功
3. 访问 Codecov 仓库页面查看覆盖率报告
4. 确认 README 中的徽章显示正确的覆盖率数据

## 覆盖率配置

项目使用 `codecov.yml` 文件进行配置，包括：

- 忽略构建文件和测试文件
- 按子包分组（fs-server, exiftool-server, test-utils）
- 设置合理的覆盖率阈值

## 本地测试覆盖率

你仍然可以在本地运行覆盖率测试：

```bash
# 单个包
cd packages/fs-server
bun run test:coverage

# 所有包
bun run test:coverage
```

覆盖率文件会生成在各个包的 `coverage/` 目录中。
