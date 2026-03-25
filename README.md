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
- [Sequential Chain Orchestration](#sequential-chain-orchestration)
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
✅ **Sequential Chain Orchestration** — Explicit numbered agent workflows (0_step.ts → 1_step.ts → linear.ts)
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

### Pro Tip: Sequential Chains

For explicit, visible workflows, use **Sequential Chain Orchestration** with numbered agents:

```text
agents/competitor-analysis/
├── 0_scraper.ts        # Step 1: Extract data
├── 1_analyzer.ts       # Step 2: Analyze patterns
├── 2_reporter.ts       # Step 3: Generate report
└── linear.ts           # Control data flow
```

The executor automatically detects and orchestrates these workflows. See [Sequential Chain Orchestration](#sequential-chain-orchestration) for details.

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

## Sequential Chain Orchestration

AFR includes a powerful **Sequential Chain Orchestration** feature for building explicit, visible data pipelines where multiple agents execute in a defined sequence with data flowing from one step to the next.

### Why Sequential Chains?

Instead of black-box LLM looping or recursive tool calls, sequential chains give you:
- **Explicit Workflows** — File system shows exact execution order (0_step → 1_step → 2_step)
- **Developer Control** — Write `linear.ts` orchestrator to manage data flow between steps
- **Custom Logic Hooks** — Inject business logic (API calls, database updates) between steps
- **Type Safety** — Full TypeScript support with interfaces

### How It Works

**File Structure:**
```text
agents/workflow-name/
├── index.ts                    # Entry point
├── 0_scraper.ts                # First step
├── 1_analyzer.ts               # Second step
├── 2_reporter.ts               # Third step
└── linear.ts                   # Orchestration logic
```

**Automatic Detection & Validation:**
1. Library discovers numbered agents (0_*.ts, 1_*.ts, etc.)
2. Auto-sorts by numeric prefix
3. Validates that `linear.ts` exists (throws `MissingOrchestratorError` if missing)
4. Passes sorted agents to orchestrator function

**Data Flow:**
```
Input
  ↓
[0_scraper.ts] → Extract features
  ↓ (output becomes input)
[1_analyzer.ts] → Analyze data
  ↓ (output becomes input)
[2_reporter.ts] → Generate report
  ↓
[linear.ts] → Orchestrator returns final result
```

### Quick Example: Competitor Analysis

```typescript
// agents/competitor-analysis/index.ts
export default {
  name: "Competitor Analysis Orchestrator",
  description: "Analyzes competitors and generates counter-strategies",
  systemPrompt: "Coordinate multi-step competitive analysis...",
};

// agents/competitor-analysis/0_scraper.ts
export async function execute(params: { input: unknown; originalTask: unknown }) {
  return {
    status: "success",
    output: { productName: "...", features: [...], pricingModel: "..." }
  };
}

// agents/competitor-analysis/1_price_analyst.ts
export async function execute(params: { input: unknown; originalTask: unknown }) {
  const productData = params.input;
  return {
    status: "success",
    output: { pricingAnalysis: "...", opportunities: [...] }
  };
}

// agents/competitor-analysis/2_strategist.ts
export async function execute(params: { input: unknown; originalTask: unknown }) {
  const analysisData = params.input;
  return {
    status: "success",
    output: { strategy: "...", recommendations: [...] }
  };
}

// agents/competitor-analysis/linear.ts
import { LinearContext, SequentialAgentObject } from 'agentic-file-routing';

export async function run(context: LinearContext, agents: SequentialAgentObject[]) {
  let pipelineData = context.initialInput;

  for (const agent of agents) {
    const result = await agent.execute({
      input: pipelineData,
      originalTask: context.initialInput
    });

    if (result.status === 'error') {
      throw new Error(`Chain failed at ${agent.name}: ${result.message}`);
    }

    // Custom logic between steps
    if (agent.index === 0) {
      console.log("✅ Product research complete, proceeding to analysis...");
    }

    pipelineData = result.output;
  }

  return pipelineData;
}
```

### Advanced Features: Custom Logic Between Steps

You have full control in `linear.ts` to inject custom logic between agent executions:

```typescript
export async function run(context: LinearContext, agents: SequentialAgentObject[]) {
  let pipelineData = context.initialInput;

  for (const agent of agents) {
    const result = await agent.execute({
      input: pipelineData,
      originalTask: context.initialInput
    });

    if (result.status === 'error') throw new Error(`Failed at ${agent.name}`);

    pipelineData = result.output;

    // CUSTOM LOGIC BETWEEN STEPS
    if (agent.index === 0) {
      // Validate data from step 1
      if (!pipelineData.productName) {
        throw new Error('Missing product name');
      }
      
      // Example: Call external API
      // const enrichedData = await fetchFromDatabase(pipelineData);
      // pipelineData = enrichedData;
    }

    if (agent.index === 1) {
      // Transform or enrich results
      pipelineData = {
        ...pipelineData,
        timestamp: new Date().toISOString(),
        processedBy: agent.name
      };
      
      // Example: Save to database
      // await saveIntermediateResults('step1_output', pipelineData);
    }
  }

  return pipelineData;
}
```

### Linear.ts Orchestrator

Each sequential workflow requires a manually-written `linear.ts` file:

**Required Signature:**
```typescript
export async function run(
  context: LinearContext,
  agents: SequentialAgentObject[]
): Promise<any>
```

**LinearContext:**
```typescript
interface LinearContext {
  initialInput: unknown;    // Original input to workflow
  sessionId: string;        // Session identifier
  traceId: string;          // Trace identifier
  depth: number;            // Execution depth
  agentPath: string;        // Path to orchestrator
}
```

**SequentialAgentObject:**
```typescript
interface SequentialAgentObject {
  name: string;             // Agent name
  index: number;            // Numeric prefix (0, 1, 2...)
  filePath: string;         // Path to agent file
  definition?: AgentDefinition;
  execute: (params: {
    input: unknown;
    originalTask: unknown;
  }) => Promise<{
    status: "success" | "error";
    output?: unknown;
    message?: string;
  }>;
}
```

### Automatic Execution via Executor

When you run an agent with sequential workflow metadata, `AfrExecutor` automatically:
1. Detects the sequential workflow
2. Loads and sorts the numbered agents
3. Executes the `linear.ts` orchestrator
4. Returns the final result

```typescript
const executor = new AfrExecutor(registry);
const result = await executor.execute('root.competitor-analysis', 'Company X');
// Automatically detects and executes the sequential workflow
```

### Error Handling

**MissingOrchestratorError** — Thrown when:
- Directory contains numbered agents (0_*.ts, 1_*.ts, etc.)
- But `linear.ts` file is not found

**Fix:** Create a `linear.ts` file in the directory that exports a `run` function

### Best Practices

1. **Use Meaningful Numbers**: Start from 0, use single digits (0-9)
2. **Clear Naming**: Use descriptive names after the number (e.g., `0_scraper.ts`, `1_analyzer.ts`)
3. **Error Handling**: Always check `result.status` in linear.ts
4. **Schema Validation**: Define input/output schemas in agent definitions
5. **Logging**: Add meaningful logs in linear.ts for debugging
6. **Document Contracts**: Explain input/output expectations in comments

### See Full Documentation

For complete sequential chain orchestration documentation, examples, and API reference, see:
- [SEQUENTIAL_CHAIN_ORCHESTRATION.md](./SEQUENTIAL_CHAIN_ORCHESTRATION.md) — Full feature guide
- [SEQUENTIAL_IMPLEMENTATION_SUMMARY.md](./SEQUENTIAL_IMPLEMENTATION_SUMMARY.md) — Architecture details
- [src/demo-sequential.ts](./src/demo-sequential.ts) — Working examples

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

### Sequential Chain Workflows

Create explicit data pipelines with numbered agents and a `linear.ts` orchestrator:

```typescript
// 1. Define numbered agents that execute in sequence
// agents/data-pipeline/0_extractor.ts
export async function execute(params: { input: unknown; originalTask: unknown }) {
  return {
    status: "success",
    output: { extracted: "data from source" }
  };
}

// agents/data-pipeline/1_transformer.ts
export async function execute(params: { input: unknown; originalTask: unknown }) {
  const { extracted } = params.input as any;
  return {
    status: "success",
    output: { transformed: extracted.toUpperCase() }
  };
}

// agents/data-pipeline/2_loader.ts
export async function execute(params: { input: unknown; originalTask: unknown }) {
  const { transformed } = params.input as any;
  return {
    status: "success",
    output: { loaded: true, data: transformed }
  };
}

// 2. Create the orchestrator that controls data flow
// agents/data-pipeline/linear.ts
import { LinearContext, SequentialAgentObject } from 'agentic-file-routing';

export async function run(context: LinearContext, agents: SequentialAgentObject[]) {
  let data = context.initialInput;

  for (const agent of agents) {
    const result = await agent.execute({
      input: data,
      originalTask: context.initialInput
    });

    if (result.status === 'error') {
      throw new Error(`Pipeline failed at step ${agent.index}`);
    }

    data = result.output;
  }

  return { pipelineComplete: true, finalData: data };
}

// 3. Execute the sequential workflow
const executor = new AfrExecutor(registry);
const result = await executor.execute(
  'root.data-pipeline',
  { source: 'http://...' }
);
// Automatically detects and executes the sequential chain
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

### Example 3: Sequential Chain - Data Processing Pipeline

Create an explicit workflow where data flows through multiple processing steps.

```typescript
// Structure:
// agents/feedback-pipeline/
// ├── 0_cleaner.ts      - Normalize and clean data
// ├── 1_classifier.ts   - Categorize feedback
// ├── 2_summarizer.ts   - Generate summaries
// └── linear.ts         - Orchestrate the pipeline

// agents/feedback-pipeline/0_cleaner.ts
export const definition = {
  name: "Data Cleaner",
  description: "Normalizes and cleans input data",
  systemPrompt: "Clean and normalize the data..."
};

export async function execute(params: { input: unknown; originalTask: unknown }) {
  const { feedbackList } = params.input as any;
  return {
    status: "success",
    output: { cleaned: feedbackList.map(f => f.trim()) }
  };
}

// agents/feedback-pipeline/1_classifier.ts
export async function execute(params: { input: unknown; originalTask: unknown }) {
  const { cleaned } = params.input as any;
  return {
    status: "success",
    output: { 
      classified: cleaned.map(f => ({
        text: f,
        category: f.includes("bug") ? "bug" : "feature"
      }))
    }
  };
}

// agents/feedback-pipeline/2_summarizer.ts
export async function execute(params: { input: unknown; originalTask: unknown }) {
  const { classified } = params.input as any;
  return {
    status: "success",
    output: { 
      summary: {
        bugs: classified.filter((c: any) => c.category === "bug").length,
        features: classified.filter((c: any) => c.category === "feature").length,
        items: classified
      }
    }
  };
}

// agents/feedback-pipeline/linear.ts
import { LinearContext, SequentialAgentObject } from 'agentic-file-routing';

export async function run(context: LinearContext, agents: SequentialAgentObject[]) {
  console.log(`Processing feedback pipeline: ${agents.length} steps`);
  let data = context.initialInput;

  for (const agent of agents) {
    const startTime = Date.now();
    const result = await agent.execute({
      input: data,
      originalTask: context.initialInput
    });

    if (result.status === 'error') {
      throw new Error(`Pipeline failed at ${agent.name}: ${result.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ ${agent.name} completed in ${duration}ms`);
    data = result.output;
  }

  return {
    processedAt: new Date().toISOString(),
    pipelineResult: data,
    agents: agents.map(a => ({ name: a.name, index: a.index }))
  };
}

// Execute the pipeline
const executor = new AfrExecutor(registry);
const result = await executor.execute(
  'root.feedback-pipeline',
  { feedbackList: ["Bug: login fails", "Feature: dark mode", "Bug: slow load"] }
);
```

### Example 4: With Real Provider

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
│   ├── sequential.ts         # Sequential chain orchestration
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
│   ├── demo-sequential.ts    # Sequential chain demos
│   └── index.ts              # Package entry
├── examples/
│   └── agents/               # Example agent trees
│       ├── devops/
│       ├── marketing/
│       └── competitor-analysis/  # Sequential workflow example
├── dist/                     # Compiled output (generated)
├── SEQUENTIAL_CHAIN_ORCHESTRATION.md     # Sequential feature docs
├── SEQUENTIAL_IMPLEMENTATION_SUMMARY.md  # Implementation details
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
- **Milestone 4-5**: Context inheritance, policy layer, and middleware
- **Milestone 6**: Sequential Chain Orchestration (numbered agents + linear.ts orchestrators)

### 🔄 In Progress

- **CLI and Developer Experience Tools**
- **Agent Template Scaffolding**

### 📋 Planned

- **Milestone 7**: Production hardening and npm publication
- **v2.0**: Dynamic segment routing ([topic], [...path])
- **v2.0**: Advanced middleware ecosystem
- **v2.0**: Parallel execution support for sequential chains
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

**Q: What are Sequential Chain Orchestrations?**
A: Explicit workflows where numbered agents (0_step.ts, 1_step.ts) execute sequentially with data piping between steps. Control data flow using a `linear.ts` orchestrator file. See [SEQUENTIAL_CHAIN_ORCHESTRATION.md](./SEQUENTIAL_CHAIN_ORCHESTRATION.md) for details.

**Q: When should I use Sequential Chains vs. tool delegation?**
A: Use Sequential Chains when you need:
- Explicit, visible workflows (not black-box LLM recursion)
- Custom logic between steps (API calls, database updates)
- Guaranteed execution order
- Simpler data passing without LLM tool calling overhead

Use tool delegation for unstructured, exploratory agent interactions.

**Q: What happens if a step in my sequential chain fails?**
A: The `linear.ts` orchestrator controls error handling. You can either throw (stop the chain) or handle gracefully and continue. Full error context is available.

**Q: Can I have parallel steps in a sequential chain?**
A: Not yet. v2 will add support for conditional branches and parallel execution. For now, implement manual parallelization in `linear.ts` using Promise.all() if needed.

**Q: Do I need to define schemas for sequential agents?**
A: Optional but recommended. Define `inputSchema` and `outputSchema` in agent definitions for documentation and validation.

---

**Built with ❤️ for the future of hierarchical AI agents**

[GitHub](https://github.com/Ibrahim77890/Agentic-File-Routing) | [npm](https://npmjs.org/package/agentic-file-routing) | [Docs](./docs)
