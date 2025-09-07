import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import * as path from "path";
import * as fs from "fs/promises";

import {
  createTempTestDir,
  cleanupTempDir,
  createTestFile,
  createMockMcpSdk,
  setupMcpMocks,
  createMcpTestHelper,
  expectToolCall,
} from "../src/index";

describe("@zkl2333/mcp-test-utils", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await createTempTestDir("test-utils-");
  });

  afterAll(async () => {
    await cleanupTempDir(tmpDir);
  });

  it("文件工具应能创建与清理临时目录/文件", async () => {
    // 目录存在
    const stat = await fs.stat(tmpDir);
    expect(stat.isDirectory()).toBe(true);

    // 创建文件
    const filePath = await createTestFile(tmpDir, "hello.txt", "world");
    const content = await fs.readFile(filePath, "utf8");
    expect(content).toBe("world");
  });

  it("MockMcpServer 应支持注册与调用工具", async () => {
    const { McpServer } = createMockMcpSdk();
    const server = new McpServer({ name: "mock", version: "0.0.0" });

    server.registerTool(
      "echo",
      { title: "Echo", description: "echo text" },
      async (args) => ({ content: [{ type: "text", text: String(args.msg ?? "") }] })
    );

    expect(server.isToolRegistered("echo")).toBe(true);
    expect(server.getRegisteredTools()).toContain("echo");
    expect(server.getToolConfig("echo")?.title).toBe("Echo");

    const ok = await server.callTool("echo", { msg: "hi" });
    expectToolCall.toSucceed(ok);
    expectToolCall.toContain(ok, "hi");

    const fail = await server.callTool("echo", {
      makeError: true,
    }).catch(() => null);
    // 这里不抛错，因为 handler 没有抛错；单独测试抛错场景：
  });

  it("callTool 未注册工具应抛出错误", async () => {
    const { McpServer } = createMockMcpSdk();
    const server = new McpServer({ name: "mock", version: "0.0.0" });
    await expect(server.callTool("nope", {})).rejects.toBeDefined();
  });

  it("createMcpTestHelper 应封装常用操作", async () => {
    const { McpServer } = createMockMcpSdk();
    const server = new McpServer({ name: "mock", version: "0.0.0" });

    server.registerTool(
      "sum",
      { title: "Sum", description: "add numbers" },
      async (args) => ({ content: [{ type: "text", text: String((args.a ?? 0) + (args.b ?? 0)) }] })
    );

    const helper = createMcpTestHelper(server);
    expect(helper.getRegisteredTools()).toContain("sum");
    helper.expectToolRegistered("sum");

    const res = await helper.callTool("sum", { a: 2, b: 3 });
    expectToolCall.toSucceed(res);
    expectToolCall.toMatch(res, /5/);
  });

  it("setupMcpMocks 应替换 SDK 模块导出", async () => {
    setupMcpMocks();
    const mcp = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const stdio = await import("@modelcontextprotocol/sdk/server/stdio.js");

    expect(typeof mcp.McpServer).toBe("function");
    expect(typeof stdio.StdioServerTransport).toBe("function");

    const server = new mcp.McpServer({ name: "mock", version: "0.0.0" });
    server.registerTool(
      "ping",
      { title: "Ping", description: "pong" },
      async () => ({ content: [{ type: "text", text: "pong" }] })
    );
    const result = await server.callTool("ping", {});
    expectToolCall.toSucceed(result);
    expectToolCall.toContain(result, "pong");
  });
});
