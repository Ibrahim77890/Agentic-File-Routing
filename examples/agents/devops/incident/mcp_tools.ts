/**
 * MCP Tools Configuration for Incident Management
 * 
 * This configuration overrides/extends parent tools for incident-specific operations.
 * 
 * Agents in incident foldre get:
 * - All parent devops tools (GitHub, Docker)
 * - Specialized incident management tools
 * - Monitoring and alerting integration
 */

import type { MCPToolsConfig } from "../../../src/mcp/types.js";

export const tools: MCPToolsConfig = {
  servers: {
    // Monitoring/Alerting MCP Server
    monitoring: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-monitoring"],
      env: {
        PROMETHEUS_URL: process.env.PROMETHEUS_URL,
        ALERT_MANAGER_URL: process.env.ALERT_MANAGER_URL
      },
      timeout: 8000,
      autoRestart: true
    },

    // Incident tracking system
    incident_tracker: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-jira"],
      env: {
        JIRA_URL: process.env.JIRA_URL,
        JIRA_API_KEY: process.env.JIRA_API_KEY
      },
      timeout: 5000,
      autoRestart: true
    }
  },

  // Inherit all parent tools (GitHub, Docker from /devops)
  inheritParent: true,

  // Tool filtering for incident-specific use
  toolFilter: {
    // Only allow read operations on monitoring
    exclude: ["monitoring_delete_*", "monitoring_modify_*"]
  },

  // Namespace incident tools
  toolPrefix: {
    monitoring: "monitor_",
    incident_tracker: "incident_"
  }
};
