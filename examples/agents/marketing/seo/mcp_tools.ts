/**
 * MCP Tools Configuration for SEO Agents
 * 
 * SEO agents inherit all parent marketing tools plus specialized SEO tools.
 * This shows hierarchical scoping in action.
 * 
 * Available tools:
 * - Parent tools: email_*, crm_*, analytics_*
 * - Local tools: seo_*, search_console_*
 */

import type { MCPToolsConfig } from "../../../../src/mcp/types.js";

export const tools: MCPToolsConfig = {
  servers: {
    // Google Search Console Integration
    search_console: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-google-search-console"],
      env: {
        GOOGLE_SEARCH_CONSOLE_KEY: process.env.GOOGLE_SEARCH_CONSOLE_KEY
      },
      timeout: 5000,
      autoRestart: true
    },

    // SEO Analysis Tool
    semrush: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-semrush"],
      env: {
        SEMRUSH_API_KEY: process.env.SEMRUSH_API_KEY
      },
      timeout: 8000,
      autoRestart: true
    }
  },

  // Inherit parent marketing tools
  inheritParent: true,

  // Namespace SEO tools
  toolPrefix: {
    search_console: "gsc_",
    semrush: "seo_"
  }
};
