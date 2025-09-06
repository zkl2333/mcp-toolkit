/**
 * @mcp/test-utils - MCP 测试工具包
 * 
 * 为 MCP 服务器提供通用的测试功能，包括：
 * - 简单的 JSON-RPC 客户端
 * - MCP 服务器测试助手
 * - 测试辅助函数
 */

export {
  SimpleMCPClient,
  MCPServerTester,
  TestHelpers,
  type MCPTestConfig
} from './mcp-test-client.js';

// 导出常用的测试配置
export const DEFAULT_TEST_CONFIG = {
  timeout: 10000,
  env: { NODE_ENV: 'test' }
};

// 导出测试用的常量
export const TEST_CONSTANTS = {
  MCP_PROTOCOL_VERSION: "2024-11-05",
  DEFAULT_TIMEOUT: 10000,
  SERVER_STARTUP_TIMEOUT: 5000,
  CLIENT_NAME: "mcp-test-client",
  CLIENT_VERSION: "1.0.0"
};
