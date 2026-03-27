import { existsSync, readFileSync } from "node:fs";
import { ExecutionError, SchemaError } from "../errors.js";
import { toLogicalPath, toRoutePattern, toToolName } from "../path-utils.js";
import {
  AgentDefinition,
  AgentRegistry,
  AgentRegistryRecord,
  AgentTool,
  AgentMCPConfig,
  AgentLayoutConfig,
  AgentMiddlewareConfig,
  AgentInterruptConfig,
  AgentRouterConfig,
  AgentProviderFallback,
  AgentTierRoutingConfig,
  AgentBudgetConfig,
  AgentEscalationLadder,
  AgentCacheConfig,
  BuildRegistryOptions,
  FlattenedRegistryOptions,
  DiscoveredAgentNode,
  SequentialWorkflowMetadata,
  ParallelWorkflowMetadata
} from "../types.js";
import { discoverAgentTree } from "./discover.js";
import { MCPConfigLoader } from "../mcp/loader.js";
import { importRuntimeModule } from "./module-resolver.js";

const DEFAULT_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {},
  additionalProperties: true
};

export async function buildAgentRegistry(options: BuildRegistryOptions): Promise<AgentRegistry> {
  const rootLogicalPath = options.rootLogicalPath ?? "root";
  const rootNode = discoverAgentTree(options.agentsRootDir);
  const records: Record<string, AgentRegistryRecord> = {};
  const mcpLoader = new MCPConfigLoader();
  const flattenedOptions = resolveFlattenedOptions(options.flattened, rootLogicalPath);

  await buildNodeRecord(rootNode, records, rootLogicalPath, options, mcpLoader);
  if (flattenedOptions.enabled) {
    injectFlattenedTools(records, flattenedOptions);
  }

  return {
    rootPath: rootLogicalPath,
    records
  };
}

async function buildNodeRecord(
  node: DiscoveredAgentNode & {
    sequentialWorkflow?: SequentialWorkflowMetadata;
    parallelWorkflow?: ParallelWorkflowMetadata;
    hasMcpConfig?: boolean;
    mcpConfigPath?: string;
    hasLayout?: boolean;
    layoutPath?: string;
    hasMiddleware?: boolean;
    middlewarePath?: string;
    hasInterrupt?: boolean;
    interruptPath?: string;
    hasRouter?: boolean;
    routerPath?: string;
    hasFallback?: boolean;
    fallbackPath?: string;
    hasTier?: boolean;
    tierPath?: string;
    hasBudget?: boolean;
    budgetPath?: string;
    hasLadder?: boolean;
    ladderPath?: string;
    simplePath?: string;
    hasCache?: boolean;
    cachePath?: string;
  },
  records: Record<string, AgentRegistryRecord>,
  rootLogicalPath: string,
  options: BuildRegistryOptions,
  mcpLoader: MCPConfigLoader
): Promise<void> {
  for (const child of node.children) {
    await buildNodeRecord(child, records, rootLogicalPath, options, mcpLoader);
  }

  const logicalPath = toLogicalPath(node.segmentsFromRoot, rootLogicalPath);
  const routePattern = toRoutePattern(node.segmentsFromRoot);
  const config = loadLocalConfig(node.dirPath);
  const definition = await maybeLoadDefinition(node.entryFilePath, options);

  // Load MCP configuration if present
  let mcpConfig: AgentMCPConfig | undefined;
  if (node.hasMcpConfig) {
    try {
      const mcpEntry = await mcpLoader.loadMCPConfig(node.dirPath, logicalPath);
      mcpConfig = {
        hasMcpConfig: mcpEntry.hasMcpConfig,
        mcpConfigPath: mcpEntry.mcpConfigPath,
        config: mcpEntry.config as unknown as Record<string, unknown>
      };
    } catch (error) {
      console.warn(`Failed to load MCP config for ${logicalPath}:`, error);
    }
  }

  const layoutConfig: AgentLayoutConfig | undefined = node.hasLayout
    ? {
        hasLayout: true,
        layoutPath: node.layoutPath
      }
    : undefined;

  const middlewareConfig: AgentMiddlewareConfig | undefined = node.hasMiddleware
    ? {
        hasMiddleware: true,
        middlewarePath: node.middlewarePath
      }
    : undefined;

  const interruptConfig: AgentInterruptConfig | undefined = node.hasInterrupt
    ? {
        hasInterrupt: true,
        interruptPath: node.interruptPath
      }
    : undefined;

  const routerConfig: AgentRouterConfig | undefined = node.hasRouter
    ? {
        hasRouter: true,
        routerPath: node.routerPath
      }
    : undefined;

  const providerFallback: AgentProviderFallback | undefined = node.hasFallback
    ? {
        hasFallbackConfig: true,
        fallbackPath: node.fallbackPath
      }
    : undefined;

  const tierConfig: AgentTierRoutingConfig | undefined = node.hasTier
    ? {
        hasTierConfig: true,
        tierPath: node.tierPath
      }
    : undefined;

  const budgetConfig: AgentBudgetConfig | undefined = node.hasBudget
    ? {
        hasBudgetConfig: true,
        budgetPath: node.budgetPath
      }
    : undefined;

  const ladderConfig: AgentEscalationLadder | undefined = node.hasLadder
    ? {
        hasLadderConfig: true,
        ladderPath: node.ladderPath,
        simplePath: node.simplePath
      }
    : undefined;

  const cacheConfig: AgentCacheConfig | undefined = node.hasCache
    ? {
        hasCacheConfig: true,
        cachePath: node.cachePath
      }
    : undefined;

  const tools: AgentTool[] = node.children.map((child) => {
    const childLogicalPath = toLogicalPath(child.segmentsFromRoot, rootLogicalPath);
    const childRoutePattern = toRoutePattern(child.segmentsFromRoot);
    const childRecord = records[childLogicalPath];
    const childDefinition = childRecord?.definition;
    const schema = childDefinition?.inputSchema ?? DEFAULT_INPUT_SCHEMA;

    return {
      name: toToolName(child.segmentsFromRoot[child.segmentsFromRoot.length - 1]),
      description: childDefinition?.description ?? `Delegate work to ${childLogicalPath}`,
      schema,
      targetPath: childLogicalPath,
      routePattern: childRoutePattern
    };
  });

  const segmentParams = node.segmentsFromRoot
    .filter((segment) => segment.paramName)
    .map((segment) => segment.paramName as string);

  const record: AgentRegistryRecord = {
    logicalPath,
    routePattern,
    dirPath: node.dirPath,
    entryFilePath: node.entryFilePath,
    segmentParams,
    config,
    tools,
    childrenPaths: node.children.map((child) => toLogicalPath(child.segmentsFromRoot, rootLogicalPath)),
    definition,
    sequentialWorkflow: node.sequentialWorkflow,
    parallelWorkflow: node.parallelWorkflow,
    mcpConfig,
    layoutConfig,
    middlewareConfig,
    interruptConfig,
    routerConfig,
    providerFallback,
    tierConfig,
    budgetConfig,
    ladderConfig,
    cacheConfig
  };

  if (definition) {
    definition.tools = tools;
  }

  records[logicalPath] = record;
}

function loadLocalConfig(dirPath: string): Record<string, unknown> {
  const configPath = `${dirPath}/config.json`;
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed;
  } catch (error) {
    throw new SchemaError(`Invalid JSON in ${configPath}: ${(error as Error).message}`);
  }
}

async function maybeLoadDefinition(
  entryFilePath: string,
  options: BuildRegistryOptions
): Promise<AgentDefinition | undefined> {
  if (!options.loadDefinitions) {
    return undefined;
  }

  try {
    const mod = await importRuntimeModule(entryFilePath);
    const candidate = (mod.default ?? mod.agent ?? mod.definition) as AgentDefinition | undefined;

    if (!candidate) {
      if (options.strictDefinitionLoading) {
        throw new SchemaError(
          `No agent definition export found in ${entryFilePath}. Expected default export or named export: agent/definition.`
        );
      }
      return undefined;
    }

    validateAgentDefinition(candidate, entryFilePath);
    return candidate;
  } catch (error) {
    if (options.strictDefinitionLoading) {
      throw new ExecutionError(`Failed to load ${entryFilePath}: ${(error as Error).message}`);
    }
    return undefined;
  }
}

function validateAgentDefinition(definition: AgentDefinition, entryFilePath: string): void {
  const missing: string[] = [];
  if (!definition.name) {
    missing.push("name");
  }
  if (!definition.description) {
    missing.push("description");
  }
  if (!definition.systemPrompt) {
    missing.push("systemPrompt");
  }

  if (missing.length > 0) {
    throw new SchemaError(
      `Invalid agent definition in ${entryFilePath}. Missing required fields: ${missing.join(", ")}.`
    );
  }
}

interface NormalizedFlattenedRegistryOptions {
  enabled: boolean;
  exposeOnPaths: string[];
  toolNameStyle: "underscore" | "dot";
  includeIntermediateTools: boolean;
}

function resolveFlattenedOptions(
  option: BuildRegistryOptions["flattened"],
  rootLogicalPath: string
): NormalizedFlattenedRegistryOptions {
  if (!option) {
    return {
      enabled: false,
      exposeOnPaths: [rootLogicalPath],
      toolNameStyle: "underscore",
      includeIntermediateTools: false
    };
  }

  if (option === true) {
    return {
      enabled: true,
      exposeOnPaths: [rootLogicalPath],
      toolNameStyle: "underscore",
      includeIntermediateTools: false
    };
  }

  const typed = option as FlattenedRegistryOptions;
  return {
    enabled: typed.enabled ?? true,
    exposeOnPaths: typed.exposeOnPaths && typed.exposeOnPaths.length > 0
      ? typed.exposeOnPaths
      : [rootLogicalPath],
    toolNameStyle: typed.toolNameStyle ?? "underscore",
    includeIntermediateTools: typed.includeIntermediateTools ?? false
  };
}

function injectFlattenedTools(
  records: Record<string, AgentRegistryRecord>,
  options: NormalizedFlattenedRegistryOptions
): void {
  const allPaths = Object.keys(records);
  const flattenedTargets = allPaths.filter((logicalPath) => {
    const record = records[logicalPath];
    if (!record) {
      return false;
    }

    if (options.includeIntermediateTools) {
      return true;
    }

    return record.childrenPaths.length === 0;
  });

  for (const exposePath of options.exposeOnPaths) {
    const parentRecord = records[exposePath];
    if (!parentRecord) {
      continue;
    }

    const existingTargets = new Set(parentRecord.tools.map((tool) => tool.targetPath));
    const existingNames = new Set(parentRecord.tools.map((tool) => tool.name));

    for (const targetPath of flattenedTargets) {
      if (targetPath === exposePath || existingTargets.has(targetPath)) {
        continue;
      }

      const targetRecord = records[targetPath];
      if (!targetRecord) {
        continue;
      }

      const schema = targetRecord.definition?.inputSchema ?? DEFAULT_INPUT_SCHEMA;
      const baseName = formatFlattenedToolName(targetPath, options.toolNameStyle);
      const toolName = ensureUniqueToolName(baseName, existingNames);

      parentRecord.tools.push({
        name: toolName,
        description: targetRecord.definition?.description ?? `Delegate work to ${targetPath}`,
        schema,
        targetPath,
        routePattern: targetRecord.routePattern
      });

      existingTargets.add(targetPath);
      existingNames.add(toolName);
    }

    if (parentRecord.definition) {
      parentRecord.definition.tools = parentRecord.tools;
    }
  }
}

function formatFlattenedToolName(
  logicalPath: string,
  style: NormalizedFlattenedRegistryOptions["toolNameStyle"]
): string {
  if (style === "dot") {
    return logicalPath
      .replace(/[^A-Za-z0-9_.-]/g, "_")
      .replace(/^\.+|\.+$/g, "")
      .replace(/\.{2,}/g, ".");
  }

  return logicalPath
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function ensureUniqueToolName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let index = 2;
  while (existingNames.has(`${baseName}_${index}`)) {
    index += 1;
  }

  return `${baseName}_${index}`;
}
