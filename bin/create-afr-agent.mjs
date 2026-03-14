#!/usr/bin/env node

/**
 * create-afr-agent CLI
 * 
 * Usage:
 *   npx create-afr-agent my-project
 *   npx create-afr-agent my-project --path /custom/path
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { createProject } from '../dist/cli/scaffolder.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
create-afr-agent - Scaffold a new Agentic File-Routing project

Usage:
  npx create-afr-agent <project-name> [options]

Options:
  --path <path>      Target directory (default: current directory)
  --help, -h        Show this help message

Examples:
  npx create-afr-agent my-agents
  npx create-afr-agent my-agents --path ~/projects
`);
    process.exit(0);
  }

  const projectName = args[0];
  let targetPath = process.cwd();

  // Parse options
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--path' && args[i + 1]) {
      targetPath = args[i + 1];
      i++;
    }
  }

  const projectPath = join(targetPath, projectName);

  // Check if directory already exists
  if (existsSync(projectPath)) {
    console.error(`✗ Directory already exists: ${projectPath}`);
    process.exit(1);
  }

  console.log(`Creating AFR project: ${projectName}`);
  console.log(`Target: ${projectPath}\n`);

  try {
    await createProject(projectName, projectPath);
  } catch (error) {
    console.error(`✗ Error:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
