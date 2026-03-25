import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DiscoveryError, MissingOrchestratorError } from "../errors.js";
import { parseSegment } from "../path-utils.js";
import { DiscoveredAgentNode, SegmentDescriptor, SequentialWorkflowMetadata } from "../types.js";

const ENTRY_FILES = ["index.ts", "index.js", "index.mjs", "index.cjs"];
const LINEAR_ORCHESTRATOR_FILE = "linear.ts";
const MCP_CONFIG_FILE = "mcp_tools.ts";
const NUMBERED_AGENT_REGEX = /^(\d+)_(.+)\.(ts|js|mjs|cjs)$/;

interface DiscoveredAgentNodeWithSequential extends DiscoveredAgentNode {
  sequentialWorkflow?: SequentialWorkflowMetadata;
  hasMcpConfig?: boolean;
  mcpConfigPath?: string;
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

  // Check for MCP configuration
  const hasMcpConfig = entries.some(
    (entry) => entry.isFile() && entry.name === MCP_CONFIG_FILE
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
      orchestratorPath: join(dirPath, LINEAR_ORCHESTRATOR_FILE)
    };
  }

  const childDirs = entries.filter((entry) => entry.isDirectory());
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

  if (hasMcpConfig) {
    node.hasMcpConfig = true;
    node.mcpConfigPath = join(dirPath, MCP_CONFIG_FILE);
  }

  return node;
}
