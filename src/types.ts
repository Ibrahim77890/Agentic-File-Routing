export interface AgentTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  targetPath: string;
  routePattern: string;
}

/**
 * MCP (Model Context Protocol) configuration for an agent
 * Defines which MCP servers are available in this scope
 */
export interface AgentMCPConfig {
  hasMcpConfig: boolean;
  mcpConfigPath?: string;
  config?: Record<string, unknown>; // MCPToolsConfig from mcp/types
}

export interface AgentDefinition {
  id?: string;
  name: string;
  description: string;
  model?: string;
  systemPrompt: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tools?: AgentTool[];
  config?: {
    timeoutMs?: number;
    retries?: number;
    tags?: string[];
  };
}

export type SegmentKind = "static" | "dynamic" | "catch-all";

export interface SegmentDescriptor {
  raw: string;
  kind: SegmentKind;
  paramName?: string;
}

export interface DiscoveredAgentNode {
  dirPath: string;
  entryFilePath: string;
  segmentsFromRoot: SegmentDescriptor[];
  children: DiscoveredAgentNode[];
}

export interface AgentRegistryRecord {
  logicalPath: string;
  routePattern: string;
  dirPath: string;
  entryFilePath: string;
  segmentParams: string[];
  config: Record<string, unknown>;
  tools: AgentTool[];
  childrenPaths: string[];
  definition?: AgentDefinition;
  sequentialWorkflow?: SequentialWorkflowMetadata;
  mcpConfig?: AgentMCPConfig;
}

export interface AgentRegistry {
  rootPath: string;
  records: Record<string, AgentRegistryRecord>;
}

export interface BuildRegistryOptions {
  agentsRootDir: string;
  rootLogicalPath?: string;
  loadDefinitions?: boolean;
  strictDefinitionLoading?: boolean;
}

export interface SequentialAgentObject {
  name: string;
  index: number;
  filePath: string;
  definition?: AgentDefinition;
  execute: (params: { input: unknown; originalTask: unknown }) => Promise<{
    status: "success" | "error";
    output?: unknown;
    message?: string;
  }>;
}

export interface LinearContext {
  initialInput: unknown;
  sessionId: string;
  traceId: string;
  depth: number;
  agentPath: string;
}

export interface SequentialWorkflowMetadata {
  hasSequentialAgents: boolean;
  numberedAgents: Array<{
    index: number;
    fileName: string;
    filePath: string;
  }>;
  hasOrchestratorFile: boolean;
  orchestratorPath?: string;
}

export interface DiscoveredAgentNodeWithSequential extends DiscoveredAgentNode {
  sequentialWorkflow?: SequentialWorkflowMetadata;
}
