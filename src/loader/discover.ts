import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DiscoveryError } from "../errors.js";
import { parseSegment } from "../path-utils.js";
import { DiscoveredAgentNode, SegmentDescriptor } from "../types.js";

const ENTRY_FILES = ["index.ts", "index.js", "index.mjs", "index.cjs"];

export function discoverAgentTree(agentsRootDir: string): DiscoveredAgentNode {
  return discoverNode(agentsRootDir, []);
}

function discoverNode(dirPath: string, segmentsFromRoot: SegmentDescriptor[]): DiscoveredAgentNode {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const entryFile = ENTRY_FILES.find((fileName) =>
    entries.some((entry) => entry.isFile() && entry.name === fileName)
  );

  if (!entryFile) {
    throw new DiscoveryError(
      `Missing agent entry file in ${dirPath}. Expected one of: ${ENTRY_FILES.join(", ")}.`
    );
  }

  const childDirs = entries.filter((entry) => entry.isDirectory());
  const children: DiscoveredAgentNode[] = childDirs
    .map((dir) => {
      const childDirPath = join(dirPath, dir.name);
      const childSegments = [...segmentsFromRoot, parseSegment(dir.name)];
      return discoverNode(childDirPath, childSegments);
    })
    .sort((a, b) => a.dirPath.localeCompare(b.dirPath));

  return {
    dirPath,
    entryFilePath: join(dirPath, entryFile),
    segmentsFromRoot,
    children
  };
}
