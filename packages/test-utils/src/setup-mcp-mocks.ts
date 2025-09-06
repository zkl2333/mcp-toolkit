/**
 * MCP SDK Mock 设置
 * 在测试运行前模拟 MCP SDK
 */

import { mock } from "bun:test";
import { createMockMcpSdk } from "./mock-mcp-sdk.js";

/**
 * 设置 MCP SDK 模拟
 * 这个函数应该在测试运行前调用（使用 preload）
 */
export function setupMcpMocks() {
  const mockSdk = createMockMcpSdk();

  // 模拟整个 @modelcontextprotocol/sdk 模块
  mock.module("@modelcontextprotocol/sdk/server/mcp.js", () => ({
    McpServer: mockSdk.McpServer
  }));

  mock.module("@modelcontextprotocol/sdk/server/stdio.js", () => ({
    StdioServerTransport: mockSdk.StdioServerTransport
  }));

  console.log("✅ MCP SDK mocks set up successfully");
}

/**
 * 创建测试助手，用于与模拟的服务器交互
 */
export function createMcpTestHelper(server: any) {
  // 现在 server 是我们的 MockMcpServer 实例
  // 我们可以直接调用它的方法，而不需要访问内部属性
  
  return {
    /**
     * 调用工具
     */
    async callTool(toolName: string, args: Record<string, any> = {}) {
      return await server.callTool(toolName, args);
    },

    /**
     * 获取已注册的工具列表
     */
    getRegisteredTools(): string[] {
      return server.getRegisteredTools();
    },

    /**
     * 检查工具是否已注册
     */
    isToolRegistered(toolName: string): boolean {
      return server.isToolRegistered(toolName);
    },

    /**
     * 获取工具配置
     */
    getToolConfig(toolName: string) {
      return server.getToolConfig(toolName);
    },

    /**
     * 获取服务器信息
     */
    getServerInfo() {
      return server.getServerInfo();
    },

    /**
     * 断言工具已注册
     */
    expectToolRegistered(toolName: string) {
      if (!this.isToolRegistered(toolName)) {
        throw new Error(`Expected tool ${toolName} to be registered, but it's not. Available tools: ${this.getRegisteredTools().join(', ')}`);
      }
    }
  };
}

/**
 * 工具调用期望匹配器
 */
export const expectToolCall = {
  /**
   * 期望工具调用成功
   */
  toSucceed(result: any) {
    if (result.isError) {
      throw new Error(`Expected tool call to succeed, but it failed with: ${result.content[0]?.text}`);
    }
  },

  /**
   * 期望工具调用失败
   */
  toFail(result: any) {
    if (!result.isError) {
      throw new Error(`Expected tool call to fail, but it succeeded with: ${result.content[0]?.text}`);
    }
  },

  /**
   * 期望工具调用结果包含指定文本
   */
  toContain(result: any, text: string) {
    const content = result.content[0]?.text || '';
    if (!content.includes(text)) {
      throw new Error(`Expected tool call result to contain "${text}", but got: ${content}`);
    }
  },

  /**
   * 期望工具调用结果匹配正则表达式
   */
  toMatch(result: any, pattern: RegExp) {
    const content = result.content[0]?.text || '';
    if (!pattern.test(content)) {
      throw new Error(`Expected tool call result to match ${pattern}, but got: ${content}`);
    }
  }
};
