/**
 * MCP Tools Configuration for DevOps Agents
 * 
 * This configuration defines which MCP servers are available to all agents
 * in the devops directory and its subdirectories.
 * 
 * Agents in this scope can leverage GitHub and Docker tools for:
 * - Issue management and PR operations
 * - Docker image management
 * - CI/CD pipeline orchestration
 *
 * These tools are scoped to devops only - marketing agents won't see them.
 */

import type { MCPToolsConfig } from "../src/mcp/types.js";

export const tools: MCPToolsConfig = {
  servers: {
    // GitHub MCP Server - Issue and PR management
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN
      },
      timeout: 5000,
      autoRestart: true
    },

    // Docker MCP Server - Container and image management
    docker: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-docker"],
      timeout: 5000,
      autoRestart: true
    }
  },

  // Inherit parent tools (e.g., global search) - default: true
  inheritParent: true,

  // Tool filtering - only expose specific GitHub tools
  toolFilter: {
    exclude: ["github_*_secret*"] // Don't expose secret-related tools
  },

  // Add prefix to avoid naming conflicts
  toolPrefix: {
    github: "gh_",
    docker: "docker_"
  }
};
