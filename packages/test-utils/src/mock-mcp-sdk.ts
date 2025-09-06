/**
 * Mock MCP SDK for testing
 * 模拟 MCP SDK 以支持优雅的测试
 */

export interface MockMcpToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface MockMcpToolHandler {
  (args: Record<string, any>): Promise<MockMcpToolResponse>;
}

export interface MockMcpToolConfig {
  title?: string;
  description?: string;
  inputSchema?: any;
}

/**
 * 模拟的 MCP 服务器类
 */
export class MockMcpServer {
  private tools: Map<string, { config: MockMcpToolConfig; handler: MockMcpToolHandler }> = new Map();
  private serverInfo: { name: string; version: string };

  constructor(info: { name: string; version: string }) {
    this.serverInfo = info;
  }

  /**
   * 注册工具
   */
  registerTool(
    name: string,
    config: MockMcpToolConfig,
    handler: MockMcpToolHandler
  ) {
    this.tools.set(name, { config, handler });
  }

  /**
   * 调用工具 - 这是测试的核心功能
   */
  async callTool(name: string, args: Record<string, any> = {}): Promise<MockMcpToolResponse> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new Error(`Tool ${name} not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    }

    try {
      return await tool.handler(args);
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * 获取注册的工具列表
   */
  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 检查工具是否注册
   */
  isToolRegistered(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取工具配置
   */
  getToolConfig(name: string): MockMcpToolConfig | undefined {
    const tool = this.tools.get(name);
    return tool?.config;
  }

  /**
   * 获取服务器信息
   */
  getServerInfo() {
    return this.serverInfo;
  }

  /**
   * 连接方法（模拟）
   */
  async connect(transport: any) {
    // 在真实的测试中，我们不需要真正连接
    return Promise.resolve();
  }
}

/**
 * 模拟的传输层类
 */
export class MockStdioServerTransport {
  // 在测试中，我们不需要真正的传输层
}

/**
 * 创建模拟的 MCP SDK 模块
 */
export function createMockMcpSdk() {
  return {
    McpServer: MockMcpServer,
    StdioServerTransport: MockStdioServerTransport
  };
}
