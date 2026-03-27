import type { ProviderName } from "./providers/types.js";

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

export interface AgentLayoutConfig {
  hasLayout: boolean;
  layoutPath?: string;
}

export interface AgentMiddlewareConfig {
  hasMiddleware: boolean;
  middlewarePath?: string;
}

export interface AgentInterruptConfig {
  hasInterrupt: boolean;
  interruptPath?: string;
}

export interface AgentRouterConfig {
  hasRouter: boolean;
  routerPath?: string;
}

export interface AgentRouterRequest {
  parentPath: string;
  routerPath: string;
  proposedTargetPath: string;
  userInput: string;
  toolName: string;
  arguments: Record<string, unknown>;
  sessionId: string;
  traceId: string;
  callStack: string[];
  availableChildren: string[];
  metadata: Record<string, unknown>;
}

export interface AgentRouterResolution {
  targetPath: string;
  userInput?: string;
  metadata?: Record<string, unknown>;
}

export type AgentRouterHandler = (
  request: AgentRouterRequest
) => Promise<string | AgentRouterResolution | null | undefined> | string | AgentRouterResolution | null | undefined;

export interface ParallelWorkflowMetadata {
  hasParallelOrchestrator: boolean;
  orchestratorPath?: string;
  hasDebateFolder: boolean;
  debatePath?: string;
  debateEntryPath?: string;
}

export interface ProviderFallbackChain {
  provider: ProviderName;
  modelId?: string;
  apiKeyEnv?: string;
}

export interface ProviderFallbackConfig {
  providers: ProviderFallbackChain[];
}

export interface AgentProviderFallback {
  hasFallbackConfig: boolean;
  fallbackPath?: string;
  config?: ProviderFallbackConfig;
}

export interface TierConfig {
  provider?: ProviderName;
  modelId?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface AgentTierRoutingConfig {
  hasTierConfig: boolean;
  tierPath?: string;
}

export interface BudgetConfig {
  maxSteps?: number;
  maxTokens?: number;
  maxTools?: number;
}

export interface AgentBudgetConfig {
  hasBudgetConfig: boolean;
  budgetPath?: string;
}

export interface EscalationLadderConfig {
  enabled?: boolean;
  escalateSignal?: string;
}

export interface AgentEscalationLadder {
  hasLadderConfig: boolean;
  ladderPath?: string;
  simplePath?: string;
}

export interface CachePolicyConfig {
  enabled?: boolean;
  ttlMs?: number;
}

export interface AgentCacheConfig {
  hasCacheConfig: boolean;
  cachePath?: string;
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
  parallelWorkflow?: ParallelWorkflowMetadata;
  mcpConfig?: AgentMCPConfig;
  layoutConfig?: AgentLayoutConfig;
  middlewareConfig?: AgentMiddlewareConfig;
  interruptConfig?: AgentInterruptConfig;
  routerConfig?: AgentRouterConfig;
  providerFallback?: AgentProviderFallback;
  tierConfig?: AgentTierRoutingConfig;
  budgetConfig?: AgentBudgetConfig;
  ladderConfig?: AgentEscalationLadder;
  cacheConfig?: AgentCacheConfig;
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
  flattened?: boolean | FlattenedRegistryOptions;
}

export interface FlattenedRegistryOptions {
  enabled?: boolean;
  exposeOnPaths?: string[];
  toolNameStyle?: "underscore" | "dot";
  includeIntermediateTools?: boolean;
}

export interface SequentialAgentObject {
  name: string;
  index: number;
  filePath: string;
  definition?: AgentDefinition;
  execute: (params: { input: unknown; originalTask: unknown }) => Promise<{
    status: "success" | "error" | "paused";
    output?: unknown;
    message?: string;
  }>;
}

export interface LinearContext {
  initialInput: unknown;
  originalInput?: unknown;
  approvalData?: unknown;
  resumedFromSessionId?: string;
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
  hasInterruptFile?: boolean;
  interruptPath?: string;
}

export interface DiscoveredAgentNodeWithSequential extends DiscoveredAgentNode {
  sequentialWorkflow?: SequentialWorkflowMetadata;
}

export interface ExecutionSnapshot {
  id: string;
  sessionId: string;
  traceId: string;
  agentPath: string;
  status: "checkpoint" | "paused" | "failed";
  createdAt: number;
  context: Record<string, unknown>;
  userInput?: string;
  globalContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SnapshotStore {
  save(snapshot: ExecutionSnapshot): Promise<void>;
  getBySessionId(sessionId: string): Promise<ExecutionSnapshot | undefined>;
  getById(id: string): Promise<ExecutionSnapshot | undefined>;
  list(): Promise<ExecutionSnapshot[]>;
}

export interface LayoutModule {
  systemPromptPrefix: string;
}
