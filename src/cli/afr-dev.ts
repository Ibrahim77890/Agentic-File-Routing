import path from "node:path";
import { startAfrDevServer } from "../dev/server.js";

interface AfrDevCliArgs {
  agentsDir: string;
  port: number;
}

function parseArgs(argv: string[]): AfrDevCliArgs {
  let agentsDir = "./examples/agents";
  let port = 3000;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--agents" && argv[i + 1]) {
      agentsDir = argv[i + 1];
      i++;
      continue;
    }

    if (argv[i] === "--port" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (!Number.isNaN(parsed) && parsed > 0) {
        port = parsed;
      }
      i++;
    }
  }

  return {
    agentsDir,
    port
  };
}

export async function runAfrDevCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  await startAfrDevServer({
    agentsRootDir: path.resolve(args.agentsDir),
    loadDefinitions: true,
    strictDefinitionLoading: false,
    port: args.port
  });
}
