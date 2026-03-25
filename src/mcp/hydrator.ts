/**
 * MCP Tool Hydrator
 * 
 * Converts MCP tool definitions into AFR-compatible tool formats
 * and manages the merging of MCP tools with agent tools.
 */

import type { MCPToolDefinition, MCPScope, MCPToolsConfig } from "./types.js";
import type { ProviderTool } from "../providers/types.js";
import { normalizeToolSchema } from "../providers/types.js";

/**
 * Extended AgentTool type that can represent both child agents and MCP tools
 */
export interface ExtendedAgentTool {
  name: string;
  description: string;
  schema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  isLocal?: boolean; // true if child agent, false if MCP tool
  isMCPTool?: boolean;
  mcpServer?: string;
  targetPath?: string; // For local tools
}

/**
 * MCP Tool Hydrator
 * Converts MCP tool definitions to provider/executor format
 */
export class MCPToolHydrator {
  /**
   * Convert MCP tool definition to provider tool format
   */
  static mcpToolToProviderTool(
    mcpTool: MCPToolDefinition,
    toolNamePrefix?: string
  ): ProviderTool {
    const toolName = toolNamePrefix
      ? `${toolNamePrefix}${mcpTool.name}`
      : mcpTool.name;

    return {
      name: toolName,
      description: mcpTool.description,
      inputSchema: normalizeToolSchema(mcpTool.inputSchema)
    };
  }

  /**
   * Convert MCP tool definition to extended agent tool format
   */
  static mcpToolToAgentTool(
    mcpTool: MCPToolDefinition,
    toolNamePrefix?: string
  ): ExtendedAgentTool {
    const toolName = toolNamePrefix
      ? `${toolNamePrefix}${mcpTool.name}`
      : mcpTool.name;

    return {
      name: toolName,
      description: mcpTool.description,
      schema: mcpTool.inputSchema,
      isMCPTool: true,
      isLocal: false,
      mcpServer: mcpTool.mcpServer
    };
  }

  /**
   * Merge local agent tools (child agents) with MCP tools
   * MCP tools don't override local tools (local tools take precedence)
   */
  static mergeTools(
    localTools: ExtendedAgentTool[],
    mcpScope: MCPScope,
    toolNamePrefixes?: Record<string, string>
  ): ExtendedAgentTool[] {
    const merged: ExtendedAgentTool[] = [];
    const toolNameSet = new Set<string>();

    // Add local tools first (they take precedence)
    for (const tool of localTools) {
      merged.push(tool);
      toolNameSet.add(tool.name);
    }

    // Add MCP tools that don't conflict with local tools
    for (const [mcpServerName, mcpTools] of Object.entries(mcpScope.tools)) {
      const prefix = toolNamePrefixes?.[mcpServerName];

      for (const mcpTool of mcpTools.values?.() || []) {
        const toolName = prefix ? `${prefix}${mcpTool.name}` : mcpTool.name;

        // Skip if already exists (local tools take precedence)
        if (!toolNameSet.has(toolName)) {
          merged.push(
            this.mcpToolToAgentTool(mcpTool, prefix)
          );
          toolNameSet.add(toolName);
        }
      }
    }

    return merged;
  }

  /**
   * Extract tools from MCPScope for a specific server
   */
  static getServerTools(
    mcpScope: MCPScope,
    serverName: string,
    toolNamePrefix?: string
  ): ProviderTool[] {
    const tools: ProviderTool[] = [];

    for (const mcpTool of mcpScope.tools.values()) {
      if (mcpTool.mcpServer === serverName) {
        tools.push(this.mcpToolToProviderTool(mcpTool, toolNamePrefix));
      }
    }

    return tools;
  }

  /**
   * Get all available tools in a scope as provider tools
   */
  static getScopeTools(mcpScope: MCPScope): ProviderTool[] {
    const tools: ProviderTool[] = [];

    for (const mcpTool of mcpScope.tools.values()) {
      tools.push(this.mcpToolToProviderTool(mcpTool));
    }

    return tools;
  }

  /**
   * Filter MCP tools based on include/exclude patterns
   */
  static filterTools(
    tools: Map<string, MCPToolDefinition>,
    filter?: { include?: string[]; exclude?: string[] }
  ): Map<string, MCPToolDefinition> {
    if (!filter) {
      return new Map(tools);
    }

    const filtered = new Map<string, MCPToolDefinition>();

    for (const [name, tool] of tools) {
      let included = true;

      // Check include list
      if (filter.include && filter.include.length > 0) {
        included = filter.include.some(pattern => this.matchesPattern(name, pattern));
      }

      // Check exclude list
      if (included && filter.exclude && filter.exclude.length > 0) {
        included = !filter.exclude.some(pattern => this.matchesPattern(name, pattern));
      }

      if (included) {
        filtered.set(name, tool);
      }
    }

    return filtered;
  }

  /**
   * Check if a tool name matches a pattern (supports wildcards)
   */
  private static matchesPattern(toolName: string, pattern: string): boolean {
    // Simple wildcard matching: * matches anything, ? matches single char
    const regex = new RegExp(
      `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`
    );
    return regex.test(toolName);
  }

  /**
   * Build tool documentation for system prompt
   */
  static generateToolDocumentation(tools: ProviderTool[]): string {
    if (tools.length === 0) {
      return "No tools available.";
    }

    const docs = ["## Available Tools\n"];

    for (const tool of tools) {
      docs.push(`### ${tool.name}`);
      docs.push(tool.description || "No description");
      docs.push("");

      if (tool.inputSchema?.properties) {
        docs.push("**Parameters:**");
        for (const [paramName, paramDef] of Object.entries(tool.inputSchema.properties)) {
          const required = tool.inputSchema.required?.includes(paramName) ? " (required)" : "";
          docs.push(`- **${paramName}**${required}: ${JSON.stringify(paramDef)}`);
        }
        docs.push("");
      }
    }

    return docs.join("\n");
  }

  /**
   * Validate that an MCP tool call is legal for a scope
   * (Tool exists and comes from a server in this scope)
   */
  static validateToolCall(
    toolName: string,
    mcpScope: MCPScope
  ): { valid: boolean; error?: string } {
    // Check if tool exists in scope
    for (const mcpTool of mcpScope.tools.values()) {
      if (mcpTool.name === toolName) {
        return { valid: true };
      }
    }

    return {
      valid: false,
      error: `Tool "${toolName}" not found in MCP scope "${mcpScope.logicalPath}"`
    };
  }
}

/**
 * Tool Merger Utility
 * Combines tools from multiple sources while avoiding conflicts
 */
export class ToolMerger {
  /**
   * Merge multiple tool lists with precedence
   * First list has highest precedence
   */
  static merge(...toolLists: ExtendedAgentTool[][]): ExtendedAgentTool[] {
    const merged = new Map<string, ExtendedAgentTool>();
    const seen = new Set<string>();

    for (const tools of toolLists) {
      for (const tool of tools) {
        if (!seen.has(tool.name)) {
          merged.set(tool.name, tool);
          seen.add(tool.name);
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Create tool namespace by adding prefix
   */
  static namespaceTools(
    tools: ExtendedAgentTool[],
    namespace: string
  ): ExtendedAgentTool[] {
    return tools.map(tool => ({
      ...tool,
      name: `${namespace}_${tool.name}`
    }));
  }

  /**
   * Group tools by type (local vs MCP)
   */
  static groupByType(tools: ExtendedAgentTool[]): {
    local: ExtendedAgentTool[];
    mcp: ExtendedAgentTool[];
  } {
    return {
      local: tools.filter(t => t.isLocal !== false && !t.isMCPTool),
      mcp: tools.filter(t => t.isMCPTool)
    };
  }

  /**
   * Group MCP tools by server
   */
  static groupByServer(mcpTools: ExtendedAgentTool[]): Record<string, ExtendedAgentTool[]> {
    const grouped: Record<string, ExtendedAgentTool[]> = {};

    for (const tool of mcpTools.filter(t => t.isMCPTool)) {
      const server = tool.mcpServer || "unknown";
      if (!grouped[server]) {
        grouped[server] = [];
      }
      grouped[server].push(tool);
    }

    return grouped;
  }

  /**
   * Create a summary of available tools
   */
  static summarize(tools: ExtendedAgentTool[]): {
    totalTools: number;
    localTools: number;
    mcpTools: number;
    toolsByServer: Record<string, number>;
  } {
    const groups = this.groupByType(tools);
    const byServer = this.groupByServer(groups.mcp);

    const serverCounts: Record<string, number> = {};
    for (const [server, serverTools] of Object.entries(byServer)) {
      serverCounts[server] = serverTools.length;
    }

    return {
      totalTools: tools.length,
      localTools: groups.local.length,
      mcpTools: groups.mcp.length,
      toolsByServer: serverCounts
    };
  }
}
