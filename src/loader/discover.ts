import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DiscoveryError, MissingOrchestratorError } from "../errors.js";
import { parseSegment } from "../path-utils.js";
import {
  DiscoveredAgentNode,
  SegmentDescriptor,
  SequentialWorkflowMetadata,
  ParallelWorkflowMetadata
} from "../types.js";

const ENTRY_FILES = ["index.ts", "index.js", "index.mjs", "index.cjs"];
const LINEAR_ORCHESTRATOR_FILE = "linear.ts";
const MCP_CONFIG_FILE = "mcp_tools.ts";
const LAYOUT_FILES = ["layout.ts", "layout.js", "layout.mjs", "layout.cjs"];
const MIDDLEWARE_FILES = ["middleware.ts", "middleware.js", "middleware.mjs", "middleware.cjs"];
const INTERRUPT_FILES = ["interrupt.ts", "interrupt.js", "interrupt.mjs", "interrupt.cjs"];
const PARALLEL_ORCHESTRATOR_FILES = ["parallel.ts", "parallel.js", "parallel.mjs", "parallel.cjs"];
const FALLBACK_FILES = ["fallback.ts", "fallback.js", "fallback.mjs", "fallback.cjs"];
const DEBATE_FOLDER = "+debate";
const NUMBERED_AGENT_REGEX = /^(\d+)_(.+)\.(ts|js|mjs|cjs)$/;

interface DiscoveredAgentNodeWithSequential extends DiscoveredAgentNode {
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
  hasFallback?: boolean;
  fallbackPath?: string;
}

export function discoverAgentTree(agentsRootDir: string): DiscoveredAgentNodeWithSequential {
  return discoverNode(agentsRootDir, []);
}

function discoverNumberedAgents(dirPath: string): Array<{ index: number; fileName: string; filePath: string }> {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const numbered: Array<{ index: number; fileName: string; filePath: string }> = [];

  entries.forEach((entry) => {
    if (entry.isFile()) {
      const match = entry.name.match(NUMBERED_AGENT_REGEX);
      if (match) {
        const index = parseInt(match[1], 10);
        numbered.push({
          index,
          fileName: entry.name,
          filePath: join(dirPath, entry.name)
        });
      }
    }
  });

  // Sort by index
  numbered.sort((a, b) => a.index - b.index);
  return numbered;
}

function discoverNode(dirPath: string, segmentsFromRoot: SegmentDescriptor[]): DiscoveredAgentNodeWithSequential {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const entryFile = ENTRY_FILES.find((fileName) =>
    entries.some((entry) => entry.isFile() && entry.name === fileName)
  );

  if (!entryFile) {
    throw new DiscoveryError(
      `Missing agent entry file in ${dirPath}. Expected one of: ${ENTRY_FILES.join(", ")}.`
    );
  }

  // Check for sequential workflow
  const numberedAgents = discoverNumberedAgents(dirPath);
  const hasOrchestratorFile = entries.some(
    (entry) => entry.isFile() && entry.name === LINEAR_ORCHESTRATOR_FILE
  );

  const interruptFile = INTERRUPT_FILES.find((fileName) =>
    entries.some((entry) => entry.isFile() && entry.name === fileName)
  );

  const parallelOrchestratorFile = PARALLEL_ORCHESTRATOR_FILES.find((fileName) =>
    entries.some((entry) => entry.isFile() && entry.name === fileName)
  );

  const debateFolder = entries.find(
    (entry) => entry.isDirectory() && entry.name === DEBATE_FOLDER
  );

  let debateEntryPath: string | undefined;
  if (debateFolder) {
    const debateEntries = readdirSync(join(dirPath, DEBATE_FOLDER), { withFileTypes: true });
    const debateEntryFile = ENTRY_FILES.find((fileName) =>
      debateEntries.some((entry) => entry.isFile() && entry.name === fileName)
    );

    if (debateEntryFile) {
      debateEntryPath = join(dirPath, DEBATE_FOLDER, debateEntryFile);
    }
  }

  const parallelWorkflow: ParallelWorkflowMetadata | undefined =
    parallelOrchestratorFile || debateFolder
      ? {
          hasParallelOrchestrator: Boolean(parallelOrchestratorFile),
          orchestratorPath: parallelOrchestratorFile ? join(dirPath, parallelOrchestratorFile) : undefined,
          hasDebateFolder: Boolean(debateFolder),
          debatePath: debateFolder ? join(dirPath, DEBATE_FOLDER) : undefined,
          debateEntryPath
        }
      : undefined;

  // Check for MCP configuration
  const hasMcpConfig = entries.some(
    (entry) => entry.isFile() && entry.name === MCP_CONFIG_FILE
  );

  const layoutFile = LAYOUT_FILES.find((fileName) =>
    entries.some((entry) => entry.isFile() && entry.name === fileName)
  );

  const middlewareFile = MIDDLEWARE_FILES.find((fileName) =>
    entries.some((entry) => entry.isFile() && entry.name === fileName)
  );

  const fallbackFile = FALLBACK_FILES.find((fileName) =>
    entries.some((entry) => entry.isFile() && entry.name === fileName)
  );

  let sequentialWorkflow: SequentialWorkflowMetadata | undefined;
  if (numberedAgents.length > 0) {
    if (!hasOrchestratorFile) {
      throw new MissingOrchestratorError(
        `Directory ${dirPath} contains numbered agents (${numberedAgents.map((a) => a.fileName).join(", ")}) but is missing the required linear.ts orchestrator file.`
      );
    }
    sequentialWorkflow = {
      hasSequentialAgents: true,
      numberedAgents,
      hasOrchestratorFile: true,
      orchestratorPath: join(dirPath, LINEAR_ORCHESTRATOR_FILE),
      hasInterruptFile: Boolean(interruptFile),
      interruptPath: interruptFile ? join(dirPath, interruptFile) : undefined
    };
  }

  const childDirs = entries.filter(
    (entry) => entry.isDirectory() && entry.name !== DEBATE_FOLDER
  );
  const children: DiscoveredAgentNodeWithSequential[] = childDirs
    .map((dir) => {
      const childDirPath = join(dirPath, dir.name);
      const childSegments = [...segmentsFromRoot, parseSegment(dir.name)];
      return discoverNode(childDirPath, childSegments);
    })
    .sort((a, b) => a.dirPath.localeCompare(b.dirPath));

  const node: DiscoveredAgentNodeWithSequential = {
    dirPath,
    entryFilePath: join(dirPath, entryFile),
    segmentsFromRoot,
    children
  };

  if (sequentialWorkflow) {
    node.sequentialWorkflow = sequentialWorkflow;
  }

  if (parallelWorkflow) {
    node.parallelWorkflow = parallelWorkflow;
  }

  if (hasMcpConfig) {
    node.hasMcpConfig = true;
    node.mcpConfigPath = join(dirPath, MCP_CONFIG_FILE);
  }

  if (layoutFile) {
    node.hasLayout = true;
    node.layoutPath = join(dirPath, layoutFile);
  }

  if (middlewareFile) {
    node.hasMiddleware = true;
    node.middlewarePath = join(dirPath, middlewareFile);
  }

  if (interruptFile) {
    node.hasInterrupt = true;
    node.interruptPath = join(dirPath, interruptFile);
  }

  if (fallbackFile) {
    node.hasFallback = true;
    node.fallbackPath = join(dirPath, fallbackFile);
  }

  return node;
}
