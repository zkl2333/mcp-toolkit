/**
 * MCP 测试工具包
 * 提供模拟 MCP 协议的测试工具函数
 */

// MCP 协议类型定义
export interface McpToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface MockMcpServer {
  _registeredTools: Record<string, any>;
  [key: string]: any;
}

/**
 * 简单的 MCP 工具调用模拟器
 * 
 * 这个函数通过反射访问 MCP 服务器内部的工具处理函数
 * 并直接调用它们，绕过复杂的协议层
 */
export async function callMcpTool(
  server: MockMcpServer, 
  toolName: string, 
  args: Record<string, any>
): Promise<McpToolResponse> {
  // 检查工具是否注册
  const tools = server._registeredTools;
  const toolInfo = tools[toolName];
  
  if (!toolInfo) {
    throw new Error(`Tool ${toolName} not found. Available tools: ${Object.keys(tools).join(', ')}`);
  }

  if (!toolInfo.enabled) {
    throw new Error(`Tool ${toolName} is disabled`);
  }

  try {
    // 查找工具处理函数
    // 在 MCP SDK 中，工具处理函数通常存储在私有字段中
    // 我们需要通过反射来访问这些函数
    
    const serverAny = server as any;
    let toolHandler: Function | undefined;
    
    // 方法1: 尝试访问内部工具处理器存储
    const possibleHandlerLocations = [
      serverAny._toolHandlers?.[toolName],
      serverAny._tools?.[toolName]?.handler,
      serverAny.server?._toolHandlers?.[toolName],
      serverAny.server?._requestHandlers?.["tools/call"]
    ];
    
    for (const handler of possibleHandlerLocations) {
      if (typeof handler === 'function') {
        toolHandler = handler;
        break;
      }
    }
    
    // 方法2: 尝试模拟完整的 MCP 协议调用
    if (!toolHandler && serverAny.server?._requestHandlers?.["tools/call"]) {
      const toolsCallHandler = serverAny.server._requestHandlers["tools/call"];
      
      // 模拟 MCP 协议请求
      const mockRequest = {
        jsonrpc: "2.0" as const,
        id: Math.random().toString(36),
        method: "tools/call" as const,
        params: {
          name: toolName,
          arguments: args
        }
      };
      
      try {
        const response = await toolsCallHandler(mockRequest);
        
        if (response.error) {
          return {
            content: [{ 
              type: "text", 
              text: response.error.message || String(response.error)
            }],
            isError: true
          };
        }
        
        return response.result;
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `工具协议调用失败: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
    
    // 方法3: 如果有自定义的 getToolHandler 方法
    if (!toolHandler && typeof serverAny.getToolHandler === 'function') {
      toolHandler = serverAny.getToolHandler(toolName);
    }
    
    // 方法4: 如果还是找不到，提供调试信息
    if (!toolHandler) {
      console.log('Server structure for debugging:', {
        keys: Object.keys(serverAny),
        toolsKeys: Object.keys(tools),
        serverKeys: serverAny.server ? Object.keys(serverAny.server) : 'no server property',
        requestHandlers: serverAny.server?._requestHandlers ? Object.keys(serverAny.server._requestHandlers) : 'no request handlers'
      });
      
      throw new Error(
        `Cannot find handler for tool ${toolName}. ` +
        `This might be because:\n` +
        `1. The MCP server hasn't been properly initialized\n` +
        `2. The tool handler storage location is different than expected\n` +
        `3. You need to implement a custom getToolHandler method\n` +
        `4. The tools/call request handler is not available`
      );
    }

    // 调用工具处理函数
    const result = await toolHandler(args);
    
    // 确保返回值符合 MCP 协议格式
    if (result && typeof result === 'object' && result.content) {
      return result;
    }
    
    // 如果返回值不是标准格式，包装一下
    return {
      content: [{ 
        type: "text", 
        text: typeof result === 'string' ? result : JSON.stringify(result)
      }]
    };
    
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: `工具调用失败: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * 创建 MCP 测试助手
 * 提供便捷的测试方法
 */
export function createMcpTestHelper(server: MockMcpServer) {
  return {
    /**
     * 调用工具
     */
    async callTool(toolName: string, args: Record<string, any> = {}) {
      return await callMcpTool(server, toolName, args);
    },

    /**
     * 获取已注册的工具列表
     */
    getRegisteredTools(): string[] {
      return Object.keys(server._registeredTools);
    },

    /**
     * 检查工具是否已注册
     */
    isToolRegistered(toolName: string): boolean {
      return toolName in server._registeredTools;
    },

    /**
     * 检查工具是否启用
     */
    isToolEnabled(toolName: string): boolean {
      const tool = server._registeredTools[toolName];
      return tool ? tool.enabled : false;
    },

    /**
     * 获取工具信息
     */
    getToolInfo(toolName: string) {
      return server._registeredTools[toolName];
    },

    /**
     * 断言工具已注册
     */
    expectToolRegistered(toolName: string) {
      if (!this.isToolRegistered(toolName)) {
        throw new Error(`Expected tool ${toolName} to be registered, but it's not. Available tools: ${this.getRegisteredTools().join(', ')}`);
      }
    },

    /**
     * 断言工具启用
     */
    expectToolEnabled(toolName: string) {
      this.expectToolRegistered(toolName);
      if (!this.isToolEnabled(toolName)) {
        throw new Error(`Expected tool ${toolName} to be enabled, but it's disabled`);
      }
    }
  };
}

/**
 * 为服务器添加测试助手方法
 * 这个函数会给服务器对象添加 getToolHandler 方法，便于测试
 */
export function addTestHelpers(server: MockMcpServer) {
  const serverAny = server as any;
  
  // 添加获取工具处理函数的方法
  serverAny.getToolHandler = function(toolName: string) {
    // 这里需要根据实际的 MCP SDK 实现来调整
    // 这是一个通用的实现，可能需要针对具体的 SDK 版本进行调整
    
    // 尝试从不同位置查找处理函数
    const possibleLocations = [
      this._toolHandlers?.[toolName],
      this._tools?.[toolName]?.handler,
      this.server?._toolHandlers?.[toolName]
    ];
    
    for (const handler of possibleLocations) {
      if (typeof handler === 'function') {
        return handler;
      }
    }
    
    return undefined;
  };
  
  return server;
}

/**
 * 工具调用期望匹配器
 * 用于测试工具调用结果
 */
export const expectToolCall = {
  /**
   * 期望工具调用成功
   */
  toSucceed(result: McpToolResponse) {
    if (result.isError) {
      throw new Error(`Expected tool call to succeed, but it failed with: ${result.content[0]?.text}`);
    }
  },

  /**
   * 期望工具调用失败
   */
  toFail(result: McpToolResponse) {
    if (!result.isError) {
      throw new Error(`Expected tool call to fail, but it succeeded with: ${result.content[0]?.text}`);
    }
  },

  /**
   * 期望工具调用结果包含指定文本
   */
  toContain(result: McpToolResponse, text: string) {
    const content = result.content[0]?.text || '';
    if (!content.includes(text)) {
      throw new Error(`Expected tool call result to contain "${text}", but got: ${content}`);
    }
  },

  /**
   * 期望工具调用结果匹配正则表达式
   */
  toMatch(result: McpToolResponse, pattern: RegExp) {
    const content = result.content[0]?.text || '';
    if (!pattern.test(content)) {
      throw new Error(`Expected tool call result to match ${pattern}, but got: ${content}`);
    }
  }
};