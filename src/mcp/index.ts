/**
 * MCP (Model Context Protocol) Integration
 * 
 * Provides hierarchical tool scoping - agents only see tools they need
 * based on mcp_tools.ts configuration files placed in their folder.
 */

export * from "./types.js";
export { MCPConfigLoader, discoverMCPConfigs } from "./loader.js";
export { MCPServerClient, MCPServerPool } from "./client.js";
export { MCPToolHydrator, ToolMerger, type ExtendedAgentTool } from "./hydrator.js";

// Re-export key types
export type {
  MCPToolsConfig,
  MCPScope,
  MCPServerConfig,
  MCPToolCall,
  MCPToolCallResult,
  MCPRegistryEntry
} from "./types.js";
