/**
 * MCP Configuration Loader
 * 
 * Discovers and loads mcp_tools.ts files from the agent directory tree,
 * building a hierarchical scope of MCP servers available to each agent.
 */

import path from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import type { MCPToolsConfig, MCPRegistryEntry, MCPScope, MCPServerConfig } from "./types.js";

/**
 * MCP Loader - Discovers and loads MCP configurations
 */
export class MCPConfigLoader {
  private configCache = new Map<string, { config: MCPToolsConfig; cached: boolean }>();
  private scopeCache = new Map<string, MCPScope>();

  /**
   * Find and load mcp_tools.ts configuration for a specific agent path
   * 
   * @param agentDirPath - Physical directory path of the agent
   * @param logicalPath - Logical path of the agent (e.g., "root.devops.incident")
   * @returns MCPRegistryEntry with configuration details
   */
  async loadMCPConfig(
    agentDirPath: string,
    logicalPath: string
  ): Promise<MCPRegistryEntry> {
    const mcpConfigPath = path.join(agentDirPath, "mcp_tools.ts");
    const mcpConfigPathCommon = path.join(agentDirPath, "mcp_tools.js");

    const entry: MCPRegistryEntry = {
      hasMcpConfig: false
    };

    // Check for mcp_tools.ts or mcp_tools.js
    if (existsSync(mcpConfigPath) || existsSync(mcpConfigPathCommon)) {
      const configPath = existsSync(mcpConfigPath) ? mcpConfigPath : mcpConfigPathCommon;
      
      try {
        entry.hasMcpConfig = true;
        entry.mcpConfigPath = configPath;
        entry.config = await this.loadConfigFile(configPath);
      } catch (error) {
        console.error(
          `Failed to load MCP config from ${configPath}:`,
          error instanceof Error ? error.message : error
        );
        entry.config = undefined;
      }
    }

    return entry;
  }

  /**
   * Load and parse mcp_tools.ts file
   * 
   * Supports both:
   * - ES modules with `export const tools: MCPToolsConfig`
   * - CJS modules with `module.exports = { tools }`
   */
  private async loadConfigFile(filePath: string): Promise<MCPToolsConfig> {
    // Check cache first
    const cached = this.configCache.get(filePath);
    if (cached) {
      return cached.config;
    }

    try {
      // For demo/testing: simple file parsing
      // In production, you'd use dynamic import with proper error handling
      const content = await readFile(filePath, "utf-8");

      // Try to parse as TypeScript/JavaScript object
      // This is a simplified version - production would use ts-node or similar
      let config: MCPToolsConfig;

      if (content.includes("export const tools")) {
        // ES module format
        config = this.parseESModule(content);
      } else if (content.includes("module.exports")) {
        // CommonJS format
        config = this.parseCommonJS(content);
      } else {
        throw new Error("Invalid mcp_tools.ts format: must export 'tools' object");
      }

      this.configCache.set(filePath, { config, cached: true });
      return config;
    } catch (error) {
      throw new Error(
        `Failed to load MCP config from ${filePath}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Simple parser for ES module exports
   */
  private parseESModule(content: string): MCPToolsConfig {
    // Extract the tools object from ES module
    const match = content.match(/export\s+const\s+tools\s*:\s*MCPToolsConfig\s*=\s*(\{[\s\S]*?\});/);
    if (!match) {
      throw new Error("Could not find 'export const tools' in file");
    }

    try {
      // Replace process.env references with actual values
      let configStr = match[1];
      configStr = configStr.replace(
        /process\.env\.([A-Z_0-9]+)/g,
        (_, envVar) => `"${process.env[envVar] || ""}"`
      );

      // Evaluate the object (simplified - in production use safe parser)
      const config = eval(`(${configStr})`) as MCPToolsConfig;
      return config;
    } catch (error) {
      throw new Error(`Failed to parse tools object: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Simple parser for CommonJS exports
   */
  private parseCommonJS(content: string): MCPToolsConfig {
    const match = content.match(/module\.exports\s*=\s*\{\s*tools\s*:\s*(\{[\s\S]*?\})\s*\}/);
    if (!match) {
      throw new Error("Could not find 'module.exports = { tools }' in file");
    }

    try {
      let configStr = match[1];
      configStr = configStr.replace(
        /process\.env\.([A-Z_0-9]+)/g,
        (_, envVar) => `"${process.env[envVar] || ""}"`
      );

      const config = eval(`(${configStr})`) as MCPToolsConfig;
      return config;
    } catch (error) {
      throw new Error(`Failed to parse tools object: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Build hierarchical MCP scope for an agent
   * 
   * Walks up the directory tree to collect all inherited MCP configurations,
   * merging server definitions and inheriting tools based on inheritParent setting.
   * 
   * @param agentPath - Logical path of the agent (e.g., "root.devops.incident")
   * @param agentDirPath - Physical directory path
   * @param allConfigs - Map of all discovered MCP configurations by path
   * @returns Complete MCPScope with merged servers and tools
   */
  buildMCPScope(
    agentPath: string,
    agentDirPath: string,
    allConfigs: Map<string, MCPRegistryEntry>
  ): MCPScope {
    // Check cache
    const cached = this.scopeCache.get(agentPath);
    if (cached) {
      return cached;
    }

    const segments = agentPath.split(".");
    const scope: MCPScope = {
      folderPath: agentDirPath,
      logicalPath: agentPath,
      servers: {},
      tools: new Map()
    };

    // Walk up the directory tree and collect all MCP configs
    const configsToMerge: MCPRegistryEntry[] = [];
    let currentPath = segments.slice(0, -1); // Start from parent

    // Collect parent configs (root → parent)
    while (currentPath.length > 0) {
      const logicalPath = currentPath.join(".");
      const entry = allConfigs.get(logicalPath);
      if (entry && entry.config) {
        configsToMerge.unshift(entry);
      }
      currentPath.pop();
    }

    // Add own config if exists
    const ownEntry = allConfigs.get(agentPath);
    if (ownEntry && ownEntry.config) {
      configsToMerge.push(ownEntry);
      scope.localConfig = ownEntry.config;
    }

    // Merge configurations top-down
    let inheritedTools = new Map<string, any>();

    for (const entry of configsToMerge) {
      const config = entry.config!;
      const isLocal = entry === ownEntry;

      // Merge servers
      Object.assign(scope.servers, config.servers);

      // Handle tool inheritance
      if (isLocal) {
        // Store inherited tools for reference
        scope.inheritedTools = new Map(inheritedTools);

        // Check inheritParent setting
        const shouldInherit = config.inheritParent !== false;
        if (shouldInherit) {
          scope.tools = new Map([
            ...inheritedTools,
            ...scope.tools
          ]);
        } else {
          // Only use local tools
          scope.tools = new Map(scope.tools);
        }
      } else {
        // Add to inherited tools
        inheritedTools = new Map(inheritedTools);
      }
    }

    this.scopeCache.set(agentPath, scope);
    return scope;
  }

  /**
   * Clear caches (useful for testing or dynamic reloading)
   */
  clearCache(): void {
    this.configCache.clear();
    this.scopeCache.clear();
  }

  /**
   * Clear scope cache only
   */
  clearScopeCache(): void {
    this.scopeCache.clear();
  }
}

/**
 * Helper: Scan directory tree for all mcp_tools.ts files
 * Used during initial registry build
 */
export async function discoverMCPConfigs(
  agentRegistry: Map<string, { dirPath: string; logicalPath: string }>
): Promise<Map<string, MCPRegistryEntry>> {
  const mcpConfigs = new Map<string, MCPRegistryEntry>();
  const loader = new MCPConfigLoader();

  for (const [logicalPath, { dirPath }] of agentRegistry) {
    try {
      const entry = await loader.loadMCPConfig(dirPath, logicalPath);
      if (entry.hasMcpConfig) {
        mcpConfigs.set(logicalPath, entry);
      }
    } catch (error) {
      console.warn(`Failed to load MCP config for ${logicalPath}:`, error);
    }
  }

  return mcpConfigs;
}
