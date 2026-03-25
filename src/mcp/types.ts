/**
 * MCP (Model Context Protocol) Type Definitions
 * 
 * Defines the configuration and runtime interfaces for MCP server integration
 * with hierarchical tool scoping in AFR.
 */

/**
 * MCP Server Configuration
 * Specifies how to connect to and communicate with an MCP server
 */
export interface MCPServerConfig {
  /**
   * Command to execute to start the MCP server
   * Example: "npx", "python", "node", etc.
   */
  command: string;

  /**
   * Arguments to pass to the command
   * Example: ["-y", "@modelcontextprotocol/server-github"]
   */
  args?: string[];

  /**
   * Environment variables to pass to the server
   * Useful for API credentials
   * Example: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
   */
  env?: Record<string, string | undefined>;

  /**
   * Timeout (ms) for server startup
   * Default: 5000
   */
  timeout?: number;

  /**
   * Whether to automatically restart on failure
   * Default: true
   */
  autoRestart?: boolean;
}

/**
 * MCP Tools Configuration
 * Defines all MCP servers available in a folder scope
 */
export interface MCPToolsConfig {
  /**
   * Map of server name → server configuration
   * Each entry represents an MCP server to connect to
   * Tools from these servers will be available to agents in this scope
   */
  servers: Record<string, MCPServerConfig>;

  /**
   * Optional: Whether to inherit parent folder's tools
   * Default: true (child agents get all parent tools + their own)
   */
  inheritParent?: boolean;

  /**
   * Optional: Tool name filtering
   * If specified, only these tool names from MCP servers will be exposed
   * Default: all tools are exposed
   */
  toolFilter?: {
    include?: string[];
    exclude?: string[];
  };

  /**
   * Optional: Tool name prefix to avoid collisions
   * Example: "github_" for all GitHub tools
   */
  toolPrefix?: Record<string, string>;
}

/**
 * MCP Tool Definition (from MCP server)
 * Extended tool format that includes MCP metadata
 */
export interface MCPToolDefinition {
  /**
   * Tool name (globally unique within MCP server)
   */
  name: string;

  /**
   * Human-readable description
   */
  description: string;

  /**
   * JSON Schema for tool input parameters
   */
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };

  /**
   * Reference to which MCP server provides this tool
   */
  mcpServer: string;

  /**
   * Original tool definition from MCP server
   */
  original?: Record<string, unknown>;
}

/**
 * Resolved MCP Scope
 * The complete set of MCP servers and tools available at a specific folder path
 */
export interface MCPScope {
  /**
   * Folder path where these MCP configs apply
   */
  folderPath: string;

  /**
   * Logical agent path (e.g., "root.devops.incident")
   */
  logicalPath: string;

  /**
   * All MCP servers accessible in this scope
   * Includes inherited servers from parent folders
   */
  servers: Record<string, MCPServerConfig>;

  /**
   * All hydrated tools available in this scope
   * Key: tool name, Value: hydrated tool definition
   */
  tools: Map<string, MCPToolDefinition>;

  /**
   * Tools from parent scope (for reference)
   */
  inheritedTools?: Map<string, MCPToolDefinition>;

  /**
   * Local MCP configuration (not inherited)
   */
  localConfig?: MCPToolsConfig;
}

/**
 * MCP Server Instance
 * Runtime representation of a connected MCP server
 */
export interface MCPServerInstance {
  /**
   * Server name (key from servers map)
   */
  name: string;

  /**
   * Server configuration
   */
  config: MCPServerConfig;

  /**
   * Whether server is currently connected/running
   */
  isConnected: boolean;

  /**
   * Connection start time
   */
  connectedAt?: number;

  /**
   * Available tools from this server
   */
  tools: Map<string, MCPToolDefinition>;

  /**
   * Any connection errors
   */
  error?: Error;
}

/**
 * MCP Tool Call
 * Represents a call to an MCP tool from an agent
 */
export interface MCPToolCall {
  /**
   * Name of the tool (including namespace/prefix if applicable)
   */
  toolName: string;

  /**
   * Name of the MCP server providing this tool
   */
  mcpServer: string;

  /**
   * Arguments to pass to the tool
   */
  arguments: Record<string, unknown>;

  /**
   * Unique call ID for tracking
   */
  callId: string;
}

/**
 * MCP Tool Call Result
 * Result from executing an MCP tool
 */
export interface MCPToolCallResult {
  /**
   * The tool call that was executed
   */
  toolCall: MCPToolCall;

  /**
   * Result content from MCP server
   */
  content: Array<{
    type: string;
    text?: string;
    name?: string;
    [key: string]: unknown;
  }>;

  /**
   * Whether the call succeeded
   */
  success: boolean;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Execution duration (ms)
   */
  durationMs: number;
}

/**
 * MCP Manager Configuration
 * Options for the MCP manager/loader
 */
export interface MCPManagerOptions {
  /**
   * Root path to start scanning for mcp_tools.ts files
   */
  rootPath: string;

  /**
   * Whether to auto-connect to all discovered servers
   * Default: false (lazy initialization)
   */
  autoConnect?: boolean;

  /**
   * Cache hydrated tools to avoid repeated server queries
   * Default: true
   */
  cacheTools?: boolean;

  /**
   * Timeout for tool hydration operations
   * Default: 5000
   */
  hydrationTimeout?: number;
}

/**
 * MCP Registry Entry
 * Stored in agent registry to track MCP configuration for an agent
 */
export interface MCPRegistryEntry {
  /**
   * Whether this agent path has an mcp_tools.ts configuration
   */
  hasMcpConfig: boolean;

  /**
   * Path to mcp_tools.ts if it exists
   */
  mcpConfigPath?: string;

  /**
   * Parsed MCP configuration
   */
  config?: MCPToolsConfig;

  /**
   * Resolved MCP scope (including inherited tools)
   */
  scope?: MCPScope;
}
