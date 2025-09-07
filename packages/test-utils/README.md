# @zkl2333/mcp-test-utils

为 MCP 服务器测试提供通用工具：临时目录/文件工具、MCP SDK Mock、测试助手与断言。

## 安装

```bash
bun add -D @zkl2333/mcp-test-utils
```

或作为 workspace 依赖：

```json
{
  "devDependencies": {
    "@zkl2333/mcp-test-utils": "workspace:*"
  }
}
```

## 提供的能力
- 临时文件与目录：`createTempTestDir`、`cleanupTempDir`、`createTestFile`
- MCP SDK Mock：`createMockMcpSdk()` 返回 `McpServer` 与 `StdioServerTransport`
- 预置 SDK 模块替换：`setupMcpMocks()`
- 测试助手：`createMcpTestHelper(server)` 简化工具调用/查询
- 结果断言：`expectToolCall.toSucceed/.toFail/.toContain/.toMatch`

## 快速上手
在测试入口（或每个测试文件）中预置 SDK Mock：

```ts
import { setupMcpMocks } from "@zkl2333/mcp-test-utils";
setupMcpMocks();
```

创建服务器并测试工具：

```ts
import { createMcpTestHelper, expectToolCall } from "@zkl2333/mcp-test-utils";
import { server } from "../src"; // 你的服务器

const helper = createMcpTestHelper(server);
const res = await helper.callTool("read-metadata", { file: "foo.jpg" });
expectToolCall.toFail(res);
expectToolCall.toContain(res, "不存在");
```

## 运行测试

```bash
bun run test
bun run test:coverage
```

## 路线图
- 更多内置断言
- 更丰富的 Mock 能力（会话、事件）
