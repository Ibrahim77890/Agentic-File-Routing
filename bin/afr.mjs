#!/usr/bin/env node

import { runAfrDevCli } from "../dist/cli/afr-dev.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`
AFR CLI

Usage:
  afr dev [--agents <path>] [--port <number>]

Examples:
  afr dev
  afr dev --agents ./src/agents --port 3000
`);
    process.exit(0);
  }

  if (command === "dev") {
    await runAfrDevCli(args.slice(1));
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
