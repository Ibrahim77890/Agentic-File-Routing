/**
 * MCP Server Client
 * 
 * Handles JSON-RPC communication with MCP servers to:
 * 1. Discover available tools (hydration)
 * 2. Execute tool calls
 * 3. Manage server lifecycle
 */

import { spawn, ChildProcess } from "child_process";
import type {
  MCPServerConfig,
  MCPServerInstance,
  MCPToolDefinition,
  MCPToolCall,
  MCPToolCallResult
} from "./types.js";

/**
 * JSON-RPC Request/Response types for MCP protocol
 */
interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params: unknown;
  id: string | number;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number;
}

/**
 * MCP Server Client
 * Manages connection and communication with a single MCP server
 */
export class MCPServerClient {
  private serverName: string;
  private config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private isConnected = false;
  private requestId = 0;
  private pendingRequests = new Map<string | number, (response: JSONRPCResponse) => void>();
  private tools = new Map<string, MCPToolDefinition>();

  constructor(serverName: string, config: MCPServerConfig) {
    this.serverName = serverName;
    this.config = config;
  }

  /**
   * Connect to the MCP server
   * In a real implementation, this would spawn a process and set up stdio communication
   */
  async connect(): Promise<boolean> {
    try {
      console.log(`[MCP] Connecting to server: ${this.serverName}`);

      // In production, spawn actual MCP server process
      // For now, simulate connection success
      this.isConnected = true;

      // After connection, fetch available tools
      await this.hydrateTools();

      console.log(`[MCP] Connected to ${this.serverName}. Tools available: ${this.tools.size}`);
      return true;
    } catch (error) {
      console.error(
        `[MCP] Failed to connect to ${this.serverName}:`,
        error instanceof Error ? error.message : error
      );
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.isConnected = false;
    console.log(`[MCP] Disconnected from ${this.serverName}`);
  }

  /**
   * Fetch available tools from this MCP server
   * Calls tools/list endpoint
   */
  private async hydrateTools(): Promise<void> {
    // In real implementation, call JSON-RPC tools/list method
    // For now, initialize empty - would be populated from server response
    console.log(`[MCP] Hydrating tools for ${this.serverName}`);

    // Simulate tool fetch
    try {
      // Response would look like:
      // {
      //   tools: [
      //     {
      //       name: "github_create_issue",
      //       description: "Create a GitHub issue",
      //       inputSchema: { type: "object", properties: {...} }
      //     }
      //   ]
      // }

      // For now, tools will be added as needed
      this.tools.clear();
    } catch (error) {
      console.error(`[MCP] Failed to hydrate tools for ${this.serverName}:`, error);
    }
  }

  /**
   * Register a tool as available from this server
   * (Used during tool discovery phase)
   */
  registerTool(toolDef: MCPToolDefinition): void {
    this.tools.set(toolDef.name, toolDef);
  }

  /**
   * Execute a tool call on this MCP server
   */
  async callTool(toolCall: MCPToolCall): Promise<MCPToolCallResult> {
    const startTime = Date.now();

    if (!this.isConnected) {
      return {
        toolCall,
        content: [],
        success: false,
        error: `MCP server ${this.serverName} is not connected`,
        durationMs: Date.now() - startTime
      };
    }

    try {
      // In production, send JSON-RPC call to tool
      // tools/call with { name: toolName, arguments: {...} }
      console.log(`[MCP] Calling tool ${toolCall.toolName} on ${this.serverName}`);

      // Simulate tool execution
      const result: MCPToolCallResult = {
        toolCall,
        content: [
          {
            type: "text",
            text: `Tool ${toolCall.toolName} executed successfully on ${this.serverName}`
          }
        ],
        success: true,
        durationMs: Date.now() - startTime
      };

      return result;
    } catch (error) {
      return {
        toolCall,
        content: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * Send a JSON-RPC request to the server
   */
  private async sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        method,
        params,
        id
      };

      // Store callback
      this.pendingRequests.set(id, (response: JSONRPCResponse) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      // In production, write to server's stdin
      // this.process?.stdin?.write(JSON.stringify(request) + '\n');

      // For testing, resolve immediately
      setTimeout(() => {
        const callback = this.pendingRequests.get(id);
        if (callback) {
          callback({
            jsonrpc: "2.0",
            result: { tools: [] },
            id
          });
        }
      }, 100);
    });
  }

  /**
   * Get all available tools from this server
   */
  getTools(): Map<string, MCPToolDefinition> {
    return new Map(this.tools);
  }

  /**
   * Check if connected
   */
  isConnectedCheck(): boolean {
    return this.isConnected;
  }

  /**
   * Get server instance info
   */
  getInstanceInfo(): MCPServerInstance {
    return {
      name: this.serverName,
      config: this.config,
      isConnected: this.isConnected,
      connectedAt: this.isConnected ? Date.now() : undefined,
      tools: this.tools,
      error: undefined
    };
  }
}

/**
 * MCP Server Pool
 * Manages multiple MCP server connections
 */
export class MCPServerPool {
  private servers = new Map<string, MCPServerClient>();
  private initialized = false;

  /**
   * Add a server to the pool
   */
  addServer(serverName: string, config: MCPServerConfig): void {
    this.servers.set(serverName, new MCPServerClient(serverName, config));
  }

  /**
   * Connect all servers in pool
   */
  async connectAll(autoRestart = true): Promise<Map<string, MCPServerInstance>> {
    const results = new Map<string, MCPServerInstance>();

    for (const [name, client] of this.servers) {
      const success = await client.connect();
      results.set(name, client.getInstanceInfo());

      if (!success && autoRestart) {
        console.log(`[MCP] Retrying connection to ${name}...`);
        // Could implement exponential backoff retry logic here
      }
    }

    this.initialized = true;
    return results;
  }

  /**
   * Disconnect all servers in pool
   */
  async disconnectAll(): Promise<void> {
    for (const client of this.servers.values()) {
      await client.disconnect();
    }
    this.initialized = false;
  }

  /**
   * Get a specific server client
   */
  getServer(serverName: string): MCPServerClient | undefined {
    return this.servers.get(serverName);
  }

  /**
   * Get all registered servers
   */
  getAllServers(): Map<string, MCPServerClient> {
    return new Map(this.servers);
  }

  /**
   * Check if a tool is available in any server
   */
  findToolServer(toolName: string): MCPServerClient | undefined {
    for (const client of this.servers.values()) {
      if (client.getTools().has(toolName)) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolCall: MCPToolCall): Promise<MCPToolCallResult> {
    const server = this.servers.get(toolCall.mcpServer);
    if (!server) {
      return {
        toolCall,
        content: [],
        success: false,
        error: `Server ${toolCall.mcpServer} not found in pool`,
        durationMs: 0
      };
    }

    return server.callTool(toolCall);
  }

  /**
   * Get all available tools from all servers
   */
  getAllTools(): Map<string, MCPToolDefinition> {
    const allTools = new Map<string, MCPToolDefinition>();

    for (const client of this.servers.values()) {
      for (const [name, def] of client.getTools()) {
        allTools.set(name, def);
      }
    }

    return allTools;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
