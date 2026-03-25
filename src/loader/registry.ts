import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ExecutionError, SchemaError } from "../errors.js";
import { toLogicalPath, toRoutePattern, toToolName } from "../path-utils.js";
import {
  AgentDefinition,
  AgentRegistry,
  AgentRegistryRecord,
  AgentTool,
  AgentMCPConfig,
  BuildRegistryOptions,
  DiscoveredAgentNode,
  SequentialWorkflowMetadata
} from "../types.js";
import { discoverAgentTree } from "./discover.js";
import { MCPConfigLoader } from "../mcp/loader.js";

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

  await buildNodeRecord(rootNode, records, rootLogicalPath, options, mcpLoader);

  return {
    rootPath: rootLogicalPath,
    records
  };
}

async function buildNodeRecord(
  node: DiscoveredAgentNode & { sequentialWorkflow?: SequentialWorkflowMetadata; hasMcpConfig?: boolean; mcpConfigPath?: string },
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
    mcpConfig
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
    const moduleUrl = pathToFileURL(entryFilePath).href;
    const mod = (await import(moduleUrl)) as Record<string, unknown>;
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
