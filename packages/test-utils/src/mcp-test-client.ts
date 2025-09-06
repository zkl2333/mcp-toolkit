import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

/**
 * MCP 测试客户端配置
 */
export interface MCPTestConfig {
  serverPath: string;
  timeout?: number;
  env?: Record<string, string>;
}

/**
 * 简单的 JSON-RPC 客户端，专门用于测试 MCP 服务器
 */
export class SimpleMCPClient {
  private serverProcess: ChildProcess;
  private messageId = 1;
  private config: MCPTestConfig;

  constructor(serverProcess: ChildProcess, config: MCPTestConfig) {
    this.serverProcess = serverProcess;
    this.config = config;
  }

  /**
   * 发送 JSON-RPC 消息到服务器
   */
  async sendMessage(method: string, params: any = {}): Promise<any> {
    const message = {
      jsonrpc: "2.0",
      id: this.messageId++,
      method,
      params
    };

    const messageString = JSON.stringify(message) + '\n';
    this.serverProcess.stdin!.write(messageString);

    return new Promise((resolve, reject) => {
      let responseData = '';
      const timeout = this.config.timeout || 10000;
      
      const timeoutId = setTimeout(() => {
        this.serverProcess.stdout!.removeListener('data', onData);
        reject(new Error(`响应超时 (${timeout}ms)`));
      }, timeout);

      const onData = (data: Buffer) => {
        responseData += data.toString();
        
        // 检查是否接收到完整的 JSON 响应
        try {
          const lines = responseData.split('\n').filter(line => line.trim());
          for (const line of lines) {
            if (line.trim()) {
              const response = JSON.parse(line);
              if (response.id === message.id) {
                clearTimeout(timeoutId);
                this.serverProcess.stdout!.removeListener('data', onData);
                
                if (response.error) {
                  reject(new Error(`MCP 错误: ${response.error.message || response.error}`));
                } else {
                  resolve(response);
                }
                return;
              }
            }
          }
        } catch (e) {
          // 继续等待更多数据
        }
      };

      this.serverProcess.stdout!.on('data', onData);
    });
  }

  /**
   * 初始化 MCP 连接
   */
  async initialize(clientInfo = { name: "test-client", version: "1.0.0" }): Promise<any> {
    return this.sendMessage('initialize', {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo
    });
  }

  /**
   * 获取工具列表
   */
  async listTools(): Promise<any> {
    return this.sendMessage('tools/list');
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: any = {}): Promise<any> {
    return this.sendMessage('tools/call', {
      name,
      arguments: args
    });
  }
}

/**
 * MCP 服务器测试助手类
 */
export class MCPServerTester {
  private config: MCPTestConfig;
  private serverProcess: ChildProcess | null = null;
  private client: SimpleMCPClient | null = null;

  constructor(config: MCPTestConfig) {
    this.config = {
      timeout: 10000,
      env: { NODE_ENV: 'test' },
      ...config
    };
  }

  /**
   * 启动 MCP 服务器
   */
  async startServer(): Promise<void> {
    console.log('🚀 启动 MCP 服务器...');
    
    this.serverProcess = spawn('node', [this.config.serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.config.env }
    });

    let serverReady = false;
    
    this.serverProcess.stderr?.on('data', (data) => {
      const message = data.toString();
      if (message.includes('启动成功') || message.includes('已启动') || message.includes('started')) {
        serverReady = true;
      }
    });

    this.serverProcess.on('error', (error) => {
      throw new Error(`服务器启动失败: ${error.message}`);
    });

    // 等待服务器启动
    let attempts = 0;
    while (!serverReady && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      
      if (this.serverProcess?.killed) {
        throw new Error('服务器进程意外终止');
      }
    }
    
    if (!serverReady) {
      throw new Error('服务器启动超时');
    }
    
    console.log('✅ 服务器启动成功');
  }

  /**
   * 创建并初始化客户端
   */
  async createClient(): Promise<SimpleMCPClient> {
    if (!this.serverProcess) {
      throw new Error('服务器未启动');
    }

    this.client = new SimpleMCPClient(this.serverProcess, this.config);
    
    console.log('🔌 初始化 MCP 连接...');
    const initResponse = await this.client.initialize();
    
    if (!initResponse.result || !initResponse.result.serverInfo) {
      throw new Error('MCP 初始化失败');
    }
    
    console.log('✅ MCP 连接初始化成功');
    return this.client;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('🧹 清理测试资源...');
    
    if (this.serverProcess && !this.serverProcess.killed) {
      this.serverProcess.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);
        
        this.serverProcess!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      this.serverProcess = null;
    }
    
    this.client = null;
    console.log('✅ 清理完成');
  }

  /**
   * 获取当前客户端
   */
  getClient(): SimpleMCPClient {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }
    return this.client;
  }

  /**
   * 检查服务器是否运行
   */
  isServerRunning(): boolean {
    return this.serverProcess !== null && !this.serverProcess.killed;
  }
}

/**
 * 测试辅助函数
 */
export class TestHelpers {
  /**
   * 等待指定时间
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建临时目录
   */
  static createTempDir(basePath: string, prefix = 'test-'): string {
    const tempName = prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const tempPath = path.join(basePath, tempName);
    fs.mkdirSync(tempPath, { recursive: true });
    return tempPath;
  }

  /**
   * 清理临时目录
   */
  static cleanupTempDir(tempPath: string): void {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
  }

  /**
   * 创建测试文件
   */
  static createTestFile(filePath: string, content = 'test content'): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * 检查文件是否存在
   */
  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 读取文件内容
   */
  static readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * 验证 MCP 响应格式
   */
  static validateMCPResponse(response: any, expectSuccess = true): void {
    if (!response) {
      throw new Error('响应为空');
    }

    if (expectSuccess) {
      if (!response.result) {
        throw new Error('响应缺少 result 字段');
      }
      
      if (!response.result.content || !Array.isArray(response.result.content)) {
        throw new Error('响应缺少有效的 content 数组');
      }
      
      if (response.result.content.length === 0) {
        throw new Error('响应 content 为空');
      }
      
      const firstContent = response.result.content[0];
      if (!firstContent.type || !firstContent.text) {
        throw new Error('响应 content 格式不正确');
      }
    }
  }

  /**
   * 从 MCP 响应中提取文本
   */
  static extractTextFromResponse(response: any): string {
    this.validateMCPResponse(response);
    return response.result.content[0].text;
  }

  /**
   * 检查响应是否包含错误
   */
  static responseHasError(response: any): boolean {
    const text = this.extractTextFromResponse(response);
    return text.includes('错误') || text.includes('失败') || text.includes('Error');
  }
}
