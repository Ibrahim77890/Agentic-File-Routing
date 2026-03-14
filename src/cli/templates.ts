/**
 * Agent and project templates for scaffolding
 */

import { GeneratedFile, TemplateContext } from './types.js';

export function generatePackageJsonTemplate(context: TemplateContext): GeneratedFile {
  return {
    path: 'package.json',
    type: 'json',
    content: JSON.stringify(
      {
        name: context.projectName,
        version: '0.1.0',
        description: `An Agentic File-Routing project: ${context.projectName}`,
        type: 'module',
        main: 'dist/index.js',
        exports: {
          '.': {
            types: './dist/index.d.ts',
            default: './dist/index.js',
          },
        },
        scripts: {
          build: 'tsc -p tsconfig.json',
          dev: 'tsc -p tsconfig.json --watch',
          'start:demo': 'node dist/demo.js',
          test: 'node --test dist/tests/**/*.test.js',
        },
        dependencies: {
          'agentic-file-routing': '^0.1.0',
        },
        devDependencies: {
          '@types/node': '^22.15.3',
          typescript: '^5.8.2',
        },
        keywords: ['agent', 'orchestration', 'file-routing', 'afr'],
        author: context.author || 'UNKNOWN',
        license: 'MIT',
      },
      null,
      2
    ),
  };
}

export function generateTsConfigTemplate(): GeneratedFile {
  return {
    path: 'tsconfig.json',
    type: 'json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          lib: ['ES2022'],
          moduleResolution: 'NodeNext',
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          noImplicitAny: true,
          strictNullChecks: true,
          strictFunctionTypes: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noImplicitReturns: true,
        },
        include: ['src/**/*.ts'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2
    ),
  };
}

export function generateRootAgentTemplate(projectName: string): GeneratedFile {
  return {
    path: 'src/agents/index.ts',
    type: 'typescript',
    content: `import type { AgentDefinition } from 'agentic-file-routing';

/**
 * Root orchestrator agent for ${projectName}
 */
export const agent: AgentDefinition = {
  id: 'root',
  name: 'Root Orchestrator',
  description: 'Main orchestrator for ${projectName}. Delegates tasks to specialized sub-agents.',
  model: 'gpt-4',
  systemPrompt: \`You are the root orchestrator for ${projectName}.
Your role is to understand incoming requests and delegate them to the most appropriate sub-agent.
Always be clear about why you're delegating to a specific agent.
Summarize and return the result to the user.\`,
  inputSchema: {
    type: 'object',
    properties: {
      request: {
        type: 'string',
        description: 'User request or task',
      },
    },
    required: ['request'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: {
        type: 'string',
        description: 'Final result or response',
      },
      delegated_to: {
        type: 'string',
        description: 'Agent path that was delegated to, if any',
      },
    },
  },
  config: {
    timeoutMs: 30000,
    retries: 2,
    tags: ['orchestrator', 'root'],
  },
};
`,
  };
}

export function generateChildAgentTemplate(
  agentName: string,
  description: string,
  hasChildren: boolean = false
): GeneratedFile {
  const childAgentName = agentName
    .split('.')
    .pop()!
    .replace(/-/g, '_')
    .toUpperCase();

  return {
    path: `src/agents/${agentName.replace(/\./g, '/')}/index.ts`,
    type: 'typescript',
    content: `import type { AgentDefinition } from 'agentic-file-routing';

/**
 * ${childAgentName} agent
 */
export const agent: AgentDefinition = {
  id: '${agentName}',
  name: '${childAgentName}',
  description: '${description}',
  model: 'gpt-4',
  systemPrompt: \`You are the ${childAgentName} agent responsible for: ${description}
Stay focused on your domain and return clear, actionable results.\`,
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Task or request to handle',
      },
    },
    required: ['task'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['success', 'error', 'pending'],
      },
      result: {
        type: 'string',
        description: 'Task result',
      },
    },
  },
  config: {
    timeoutMs: 20000,
    retries: 1,
    tags: ['${agentName}'],
  },
};
`,
  };
}

export function generateConfigTemplate(agentPath: string): GeneratedFile {
  return {
    path: `src/agents/${agentPath.replace(/\./g, '/')}/config.json`,
    type: 'json',
    content: JSON.stringify(
      {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        tags: [agentPath],
        metadata: {
          owner: 'UNKNOWN',
          tags: ['auto-generated'],
          createdAt: new Date().toISOString(),
        },
      },
      null,
      2
    ),
  };
}

export function generateDemoTemplate(projectName: string): GeneratedFile {
  return {
    path: 'src/demo.ts',
    type: 'typescript',
    content: `import {
  discoverAgentTree,
  buildAgentRegistry,
  AfrExecutor,
  createExecutionContext,
} from 'agentic-file-routing';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Demo: Load and execute agents from the file system
 */
async function main() {
  console.log('=== ${projectName} Demo ===\\n');

  const agentsPath = path.resolve(__dirname, 'agents');
  console.log('Loading agents from:', agentsPath);

  // Discover agent tree
  const tree = await discoverAgentTree(agentsPath);
  if (!tree) {
    console.error('Failed to discover agent tree');
    process.exit(1);
  }

  // Build registry
  const registry = buildAgentRegistry({ tree, basePath: agentsPath });
  console.log('\\nRegistry built:', Object.keys(registry.records).length, 'agents');

  // Create executor
  const executor = new AfrExecutor(registry, {
    telemetryEnabled: true,
  });

  // Initialize execution context
  const ctx = createExecutionContext('root', {
    userId: 'demo-user',
    sessionName: '${projectName} Demo',
    timestamp: new Date().toISOString(),
  });

  console.log('\\n--- Execution context created ---');
  console.log('Session ID:', ctx.sessionId);
  console.log('Trace ID:', ctx.traceId);
  console.log('\\nNote: Agents are created. To execute actual LLM calls:');
  console.log('1. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable');
  console.log('2. Executor will use real models instead of simulation mode');
}

main().catch(console.error);
`,
  };
}

export function generateReadmeTemplate(projectName: string): GeneratedFile {
  return {
    path: 'README.md',
    type: 'markdown',
    content: `# ${projectName}

An [Agentic File-Routing (AFR)](https://github.com/Ibrahim77890/Agentic-File-Routing) project.

## Overview

This project uses AFR to create a hierarchical, modular multi-agent system where the file system defines the agent topology and orchestration flow.

## Project Structure

\`\`\`
src/
├─ agents/
│  ├─ index.ts                    # Root orchestrator
│  └─ [your-agents]/
│     └─ index.ts                 # Sub-agents
└─ demo.ts                         # Example execution
\`\`\`

Each folder with \`index.ts\` is an executable agent.

## Getting Started

### Installation

\`\`\`bash
npm install
npm run build
\`\`\`

### Running the Demo

\`\`\`bash
npm run start:demo
\`\`\`

### Creating New Agents

Add a new sub-agent:

\`\`\`
src/agents/your-agent-name/
├─ index.ts       # AgentDefinition export
├─ config.json    # Optional local config
└─ middleware.ts  # Optional hooks
\`\`\`

### Setting Up LLM Providers

Export your API key:

\`\`\`bash
export OPENAI_API_KEY=sk-...
# or
export ANTHROPIC_API_KEY=sk-ant-...
\`\`\`

## Documentation

See the [AFR Project Documentation](https://github.com/Ibrahim77890/Agentic-File-Routing) for detailed API reference and architecture.

## License

MIT
`,
  };
}

export function generateGitIgnoreTemplate(): GeneratedFile {
  return {
    path: '.gitignore',
    type: 'markdown',
    content: `node_modules/
dist/
*.log
.DS_Store
.env
.env.local
.env.*.local
*.swp
*.swo
*~
.vscode/settings.json
.idea/
*.iml
`,
  };
}
