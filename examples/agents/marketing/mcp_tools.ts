/**
 * MCP Tools Configuration for Marketing Agents
 * 
 * This configuration defines marketing-specific MCP servers.
 * 
 * Agents in this scope can access:
 * - Email marketing platforms (Mailchimp)
 * - CRM systems (HubSpot)
 * - Analytics and reporting
 * - Content management
 *
 * Marketing agents cannot access GitHub or Docker tools - they are scoped
 * out of their directory tree (security and separation of concerns).
 */

import type { MCPToolsConfig } from "../../../src/mcp/types.js";

export const tools: MCPToolsConfig = {
  servers: {
    // Email Marketing Platform
    mailchimp: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-mailchimp"],
      env: {
        MAILCHIMP_API_KEY: process.env.MAILCHIMP_API_KEY
      },
      timeout: 5000,
      autoRestart: true
    },

    // CRM System Integration
    hubspot: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-hubspot"],
      env: {
        HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY
      },
      timeout: 5000,
      autoRestart: true
    },

    // Analytics Server
    analytics: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-google-analytics"],
      env: {
        GOOGLE_ANALYTICS_KEY: process.env.GOOGLE_ANALYTICS_KEY
      },
      timeout: 5000,
      autoRestart: true
    }
  },

  // Don't inherit parent tools - marketing is separate from devops
  // If there were a global root mcp_tools.ts, set to false to isolate
  inheritParent: true,

  // Limit tool exposure
  toolFilter: {
    // Don't expose sensitive customer data export
    exclude: ["*_export_all_customers", "*_bulk_delete_*"]
  },

  // Namespace to avoid conflicts
  toolPrefix: {
    mailchimp: "email_",
    hubspot: "crm_",
    analytics: "analytics_"
  }
};
