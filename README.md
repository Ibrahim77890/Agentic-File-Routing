# AFR (Agentic File-Routing)

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-MVP-yellow)

A powerful, file-system-routed hierarchical agent orchestration framework for JavaScript/TypeScript. AFR maps LLM cognitive hierarchies to physical directory structures, enabling modular, observable, and infinitely scalable multi-agent systems.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

Traditional multi-agent systems struggle with:
- **Tool Overload**: Flat lists of 50+ tools confuse LLMs and waste tokens
- **Poor Observability**: Hard to track who calls whom across agent boundaries
- **Weak Boundaries**: Difficult to enforce permissions, roles, and scope limits
- **Maintenance Complexity**: Centralized configs become spaghetti code

**AFR solves this by treating your file system as the agent orchestration graph.**

Each folder is an agent scope. Sub-folders are sub-agents. Routing, delegation, and context inheritance are automatically derived from directory structure. Think Next.js, but for hierarchical agents.

### Why This Approach?

```text
root/
├─ marketing/          → Agent with 2 child tools
│  ├─ copywriting/     → Leaf agent (final execution)
│  └─ seo/             → Leaf agent (final execution)
└─ devops/             → Agent with 1 child tool
   └─ incident/        → Leaf agent (final execution)
```

**Before (Without AFR):**
- Root agent prompt lists all 50 tools
- LLM confused about which tool to call
- Token waste describing unrelated tools
- Permission boundaries manual and fragile

**After (With AFR):**
- Root sees only 2 tools: `marketing`, `devops`
- Each manager sees only their children
- Each agent's context is isolated and scoped
- Permissions inherit from folder path
- Call flow is transparent in file explorer

## Key Features

✅ **File-Based Routing** — Folder structure defines agent topology (no JSON configs)
✅ **Hierarchical Tool Exposure** — Each agent sees only its direct children
✅ **Recursive Composition** — Unlimited nesting; all agents follow same interface
✅ **Provider Agnostic** — Built-in adapters for OpenAI and Anthropic
✅ **Zero External Dependencies** — HTTP fetch-based, no SDK bloat
✅ **Context Inheritance** — Automatic parent-to-child parameter propagation
✅ **Session Tracking** — Built-in traceId, sessionId, and call stacks
✅ **Graceful Fallback** — Simulation mode when LLM provider unavailable
✅ **TypeScript First** — Full type safety and IntelliSense support
✅ **Next.js-Like Routing** — Static and dynamic folder segments

## Installation

### Prerequisites
- Node.js 18+
- TypeScript 5.0+ (if building from source)

### NPM

```bash
npm install agentic-file-routing
```

### From Source

```bash
git clone https://github.com/Ibrahim77890/Agentic-File-Routing.git
cd Agentic-File-Routing
npm install
npm run build
```

## Quick Start

### 1. Create an Agent Directory Structure

```text
src/agents/
├─ index.ts                    # Root orchestrator
├─ marketing/
│  ├─ index.ts                 # Marketing manager
│  ├─ copywriting/
│  │  └─ index.ts              # Copywriter agent
│  └─ seo/
│     └─ index.ts              # SEO specialist agent
└─ devops/
   ├─ index.ts                 # DevOps manager
   └─ incident/
      └─ index.ts              # Incident response agent
```

### 2. Define Agent Configurations

**src/agents/index.ts** (Root Orchestrator)

```typescript
export default {
  name: "Root Orchestrator",
  description: "Root agent that routes work to managers",
  systemPrompt: "You are the root orchestrator. Analyze requests and delegate to the appropriate team.",
  model: "gpt-4-turbo"
};
```

**src/agents/marketing/index.ts** (Manager)

```typescript
export default {
  name: "Marketing Manager",
  description: "Manages marketing operations and content creation",
  systemPrompt: "You are the marketing manager. Coordinate copywriting and SEO initiatives.",
  model: "gpt-4-turbo",
  inputSchema: {
    type: "object",
    properties: {
      campaign: { type: "string", description: "Campaign name or type" }
    }
  }
};
```

**src/agents/marketing/copywriting/index.ts** (Leaf Agent)

```typescript
export default {
  name: "Copywriter",
  description: "Creates persuasive marketing copy and email campaigns",
  systemPrompt: "You are an expert copywriter. Write compelling, conversion-focused content.",
  model: "gpt-4o-mini"  // Use cheaper models for utilities
};
```

### 3. Load and Execute

```typescript
import {
  buildAgentRegistry,
  executeAgent,
  type ModelConfig
} from "agentic-file-routing";

const registry = await buildAgentRegistry({
  agentsRootDir: "./src/agents",
  loadDefinitions: true
});

const modelConfig: ModelConfig = {
  provider: "openai",
  modelId: "gpt-4-turbo",
  apiKey: process.env.OPENAI_API_KEY
};

const result = await executeAgent(
  registry,
  "root",  // Start at root agent
  "Write a campaign email for our new AI product launch",
  { userId: "user-123", company: "acme-corp" },  // Global context
  { modelConfig, maxDepth: 5, timeoutMs: 30000 }
);

console.log("Result:", result.messages);
console.log("Call stack:", result.context.callStack);
```

## Architecture

### System Layers

```
┌─────────────────────────────────────────┐
│  Application / User Code                │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Executor (Milestone 2)                 │
│  - Recursive frame execution            │
│  - Tool call interception               │
│  - Session management                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Providers (Milestone 3)                │
│  - OpenAI function-calling              │
│  - Anthropic tool-use                   │
│  - Simulation fallback                  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Registry (Milestone 1)                 │
│  - Directory crawling                   │
│  - Agent discovery                      │
│  - Parent-child linkage                 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  File System                            │
│  - agents/**/*.ts agent definitions     │
└─────────────────────────────────────────┘
```

### Core Concepts

#### AgentDefinition
Each agent exports a definition describing its role, capabilities, and constraints.

```typescript
interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  model?: string;
  inputSchema?: Record<string, unknown>;
  config?: {
    timeoutMs?: number;
    retries?: number;
    tags?: string[];
  };
}
```

#### AgentRegistry
Built by crawling the directory tree. Maps logical paths to agent metadata.

```typescript
interface AgentRegistry {
  rootPath: string;  // "root"
  records: {
    // Key: logical path (dot-separated)
    "root": AgentRegistryRecord;
    "marketing": AgentRegistryRecord;
    "marketing.copywriting": AgentRegistryRecord;
    // ...
  };
}
```

#### ExecutionContext
Tracks execution state through nested calls. Automatically inherited by children.

```typescript
interface ExecutionContext {
  sessionId: string;      // Unique per root call
  traceId: string;        // For distributed tracing
  currentPath: string;    // e.g., "marketing.copywriting"
  callStack: string[];    // Complete path history
  globalContext: {};      // User-provided data
  localOverrides: {};     // Agent-specific overrides
  depth: number;          // Current nesting level
}
```

#### SessionFrame
Manages message flow and tool results for one agent invocation.

```typescript
interface SessionFrame {
  context: ExecutionContext;
  messages: Message[];        // System, user, assistant, tool
  toolResults: Map<string, unknown>;
  childFrames: SessionFrame[]; // Sub-agent executions
}
```

## Usage Guide

### Basic Execution

```typescript
import { buildAgentRegistry, executeAgent } from "agentic-file-routing";

// 1. Load agent registry from folder
const registry = await buildAgentRegistry({
  agentsRootDir: "./agents",
  loadDefinitions: true  // Parse index.ts exports
});

// 2. Execute starting at any agent
const result = await executeAgent(
  registry,
  "root",  // Agent path
  "Process this task",  // User input
  { userId: "123" },  // Global context
  {
    modelConfig: {
      provider: "openai",
      modelId: "gpt-4-turbo",
      temperature: 0.7,
      maxTokens: 2048
    }
  }
);

// 3. Handle result
if (result.success) {
  result.messages.forEach(msg => {
    console.log(`[${msg.role}] ${msg.content}`);
  });
}
```

### Context Inheritance

Global context flows from root to all children. Children can override locally.

```typescript
// Root execution
const result = await executeAgent(
  registry,
  "root",
  "task",
  {
    userId: "user-123",
    tenantId: "acme-corp",
    apiKey: "secret-key"
  }
);

// Inside marketing.copywriting agent:
// context.globalContext = { userId, tenantId, apiKey }
// context.localOverrides might add model-specific settings
```

### Configuration Override

Optional `config.json` in any folder overrides inherited settings.

```json
// agents/devops/config.json
{
  "model": "gpt-4o-mini",
  "temperature": 0.2,
  "timeoutMs": 60000
}
```

### Dynamic Segments (Coming in v2)

```typescript
// agents/blog/[topic]/index.ts
// Accessible as: blog.ai, blog.typescript, blog.devops, etc.

export default {
  name: "Blog Writer",
  description: "Write blog posts on any topic",
  systemPrompt: "Write a technical blog post about {topic}",
  // paramName: "topic" automatically injected
};
```

## API Reference

### `buildAgentRegistry(options)`

Crawls agent folder and builds registry.

```typescript
function buildAgentRegistry(options: {
  agentsRootDir: string;        // Path to agents folder
  rootLogicalPath?: string;     // Default: "root"
  loadDefinitions?: boolean;    // Parse index.ts exports
  strictDefinitionLoading?: boolean;  // Throw on missing exports
}): Promise<AgentRegistry>
```

### `executeAgent(registry, agentPath, input, context, options)`

Execute an agent and return result.

```typescript
function executeAgent(
  registry: AgentRegistry,
  agentPath: string,
  userInput: string,
  globalContext?: Record<string, unknown>,
  options?: ExecutionOptions
): Promise<ExecutionResult>
```

**ExecutionResult:**
```typescript
interface ExecutionResult {
  success: boolean;
  context: ExecutionContext;
  messages: Message[];
  finalOutput?: unknown;
  error?: Error;
  durationMs: number;
}
```

### `createProvider(config)`

Create a model provider instance.

```typescript
function createProvider(config: ModelConfig): ILlmProvider
```

**Supported Providers:**
- `"openai"` → OpenAI GPT-4, GPT-4o family
- `"anthropic"` → Anthropic Claude 3 family (coming: v2)

## Examples

### Example 1: Marketing Campaign Assistant

```typescript
// src/agents/index.ts
export default {
  name: "Campaign Assistant",
  description: "Helps create and manage marketing campaigns",
  systemPrompt: "You are a marketing campaign assistant. Help users plan and execute campaigns.",
};

// src/agents/marketing/index.ts
export default {
  name: "Marketing Team",
  description: "Manages copywriting, design, and distribution",
  systemPrompt: "Coordinate the marketing campaign execution."
};

// src/agents/marketing/copywriting/index.ts
export default {
  name: "Copywriter",
  description: "Writes marketing copy",
  systemPrompt: "Write persuasive, conversion-focused marketing copy."
};

// src/agents/marketing/seo/index.ts
export default {
  name: "SEO Specialist",
  description: "Optimizes content for search",
  systemPrompt: "Optimize content for search engines and user intent."
};

// Run it
const result = await executeAgent(
  registry,
  "root",
  "Create a campaign email for our Q2 launch"
);
```

### Example 2: DevOps Incident Response

```typescript
// src/agents/devops/index.ts
export default {
  name: "DevOps Lead",
  description: "Manages infrastructure and incident response",
  systemPrompt: "Lead the incident response. Escalate to specialists as needed."
};

// src/agents/devops/incident/index.ts
export default {
  name: "Incident Response",
  description: "Handles urgent production incidents",
  systemPrompt: "Triage critical issues. Execute incident playbooks."
};

// src/agents/devops/incident/config.json
{
  "timeoutMs": 300000,
  "retries": 3,
  "tags": ["critical", "time-sensitive"]
}
```

### Example 3: With Real Provider

```typescript
import { buildAgentRegistry, executeAgent } from "agentic-file-routing";

const registry = await buildAgentRegistry({
  agentsRootDir: "./agents",
  loadDefinitions: true
});

const result = await executeAgent(
  registry,
  "root",
  "Analyze our Q3 marketing performance",
  {
    userId: "analyst-001",
    companyId: "acme",
    dataUrl: "https://analytics.example.com/api"
  },
  {
    modelConfig: {
      provider: "openai",
      modelId: "gpt-4-turbo",
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.5,
      maxTokens: 4096
    },
    maxDepth: 10,
    timeoutMs: 60000
  }
);

console.log("Success:", result.success);
console.log("Duration:", result.durationMs + "ms");
console.log("Call trace:", result.context.callStack.join(" → "));

result.messages.forEach((msg, i) => {
  console.log(`\n[${i}] ${msg.role.toUpperCase()}`);
  console.log(msg.content.substring(0, 500) + "...");
});
```

## Development

### Project Structure

```
.
├── src/
│   ├── types.ts              # Core type definitions
│   ├── errors.ts             # Error classes
│   ├── path-utils.ts         # Route parsing
│   ├── loader/
│   │   ├── discover.ts       # Directory crawler
│   │   ├── registry.ts       # Registry builder
│   │   └── index.ts          # Loader exports
│   ├── executor/
│   │   ├── session.ts        # Session management
│   │   ├── messages.ts       # Message types
│   │   ├── executor.ts       # Core engine
│   │   └── index.ts          # Executor exports
│   ├── providers/
│   │   ├── types.ts          # Provider interface
│   │   ├── openai.ts         # OpenAI adapter
│   │   ├── anthropic.ts      # Anthropic adapter
│   │   ├── factory.ts        # Provider factory
│   │   └── index.ts          # Provider exports
│   ├── demo.ts               # Milestone 2 demo
│   ├── demo3.ts              # Milestone 3 demo
│   └── index.ts              # Package entry
├── examples/
│   └── agents/               # Example agent tree
├── dist/                     # Compiled output (generated)
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run Milestone 2 demo (execution engine)
node dist/demo.js

# Run Milestone 3 demo (providers)
node dist/demo3.js
```

### Running Tests (Coming Soon)

```bash
npm test
```

## Roadmap

### ✅ Completed (MVP)

- **Milestone 0**: Foundation and contracts
- **Milestone 1**: Core loader and registry crawler
- **Milestone 2**: Recursive execution engine
- **Milestone 3**: Provider adapters (OpenAI, Anthropic)

### 🔄 In Progress

- **Milestone 4**: Context inheritance and policy layer
- **Milestone 5**: Middleware and observability
- **Milestone 6**: CLI and developer experience

### 📋 Planned

- **Milestone 7**: Production hardening and npm publication
- **v2.0**: Dynamic segment routing ([topic], [...path])
- **v2.0**: Advanced middleware ecosystem
- **v2.5**: Distributed execution support
- **v3.0**: UI dashboard for agent monitoring

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork** the repository
2. **Branch**: `git checkout -b feature/your-feature`
3. **Code**: Follow TypeScript strict mode
4. **Test**: Add tests for new features
5. **Commit**: Clear, descriptive messages
6. **Push**: To your fork
7. **PR**: Include description and motivation

### Code Style

- TypeScript with strict mode enabled
- ESM modules (no CommonJS)
- 2-space indentation
- Type exports explicitly
- Document public APIs with JSDoc

### Running Locally

```bash
git clone https://github.com/Ibrahim77890/Agentic-File-Routing.git
cd Agentic-File-Routing
npm install
npm run build
node dist/demo3.js
```

## License

MIT License - see LICENSE file for details

---

## FAQ

**Q: Do I need external SDK dependencies?**
A: No. AFR uses HTTP fetch for all model calls. Zero npm dependencies for providers.

**Q: Can I mix OpenAI and Anthropic agents?**
A: Not yet, but coming in v2. You can specify per-agent model config.

**Q: What's the maximum agent depth?**
A: Limited by `maxDepth` option (default: 10). Adjust as needed.

**Q: Does AFR work in the browser?**
A: Not yet. v2 will add browser-compatible execution.

**Q: How do I debug agent execution?**
A: Every execution returns a `callStack` and `traceId`. Use these to track routing.

---

**Built with ❤️ for the future of hierarchical AI agents**

[GitHub](https://github.com/Ibrahim77890/Agentic-File-Routing) | [npm](https://npmjs.org/package/agentic-file-routing) | [Docs](./docs)
