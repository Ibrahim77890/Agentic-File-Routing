# AFR (Agentic File-Routing)

![Version](https://img.shields.io/badge/version-0.2.0-blue)
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
- [Localized MCP Tool Injection](#localized-mcp-tool-injection)
- [Guardrail Middleware Pattern](#guardrail-middleware-pattern)
- [Shared Directory Context with layoutts](#shared-directory-context-with-layoutts)
- [Human-in-the-Loop Breakpoint with interruptts](#human-in-the-loop-breakpoint-with-interruptts)
- [Parallel Ensemble Routing with parallelts](#parallel-ensemble-routing-with-parallelts)
- [Economic Orchestration (FinOps-for-Agents)](#economic-orchestration-finops-for-agents)
- [NPM Readiness Enhancements](#npm-readiness-enhancements)
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

- ✅ **File-Based Routing** — Folder structure defines agent topology (no JSON configs)
- ✅ **Hierarchical Tool Exposure** — Each agent sees only its direct children
- ✅ **Recursive Composition** — Unlimited nesting; all agents follow same interface
- ✅ **Sequential Chain Orchestration** — Explicit numbered agent workflows (0_step.ts → 1_step.ts → linear.ts)
- ✅ **Localized MCP Tool Injection** — Folder-scoped Model Context Protocol servers (mcp_tools.ts per folder)
- ✅ **Guardrail Middleware Pattern** — Branch-level middleware.ts hooks for input/output controls
- ✅ **Shared Directory Context** — layout.ts prompt prefixes inherited root → leaf
- ✅ **Human-in-the-Loop Interrupts** — interrupt.ts breakpoints + resumeAgent(sessionId, approvalData)
- ✅ **Parallel Ensemble Routing** — parallel.ts jury over concurrent child-agent outputs
- ✅ **Economic Orchestration (FinOps)** — directory-scoped model tiers, escalation ladders, budgets, caching, and parallel short-circuiting
- ✅ **Provider Fallback Chains** — fallback.ts for automatic provider/model failover
- ✅ **Provider Agnostic** — Built-in adapters for OpenAI, Anthropic, and OpenRouter
- ✅ **Zero External Dependencies** — HTTP fetch-based, no SDK bloat
- ✅ **Context Inheritance** — Automatic parent-to-child parameter propagation
- ✅ **Session Tracking** — Built-in traceId, sessionId, and call stacks
- ✅ **Graceful Fallback** — Simulation mode when LLM provider unavailable
- ✅ **State Snapshots** — Save/restore failed or paused runs from checkpoints
- ✅ **AFR Dev Server + HMR** — afr dev graph UI with live registry rebuilds
- ✅ **TypeScript First** — Full type safety and IntelliSense support
- ✅ **Next.js-Like Routing** — Static and dynamic folder segments

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

### Pro Tip: Full Branch Pattern

Use folder-level control files to enforce safety and consistency:

```text
src/agents/
├─ layout.ts                # Global prompt prefix (company rules)
├─ middleware.ts            # Global guardrails (PII masking, output checks)
├─ tech-support/
│  ├─ layout.ts             # Domain-specific context
│  ├─ mcp_tools.ts          # Jira/Slack tools for this branch only
│  ├─ 0_triage.ts
│  ├─ interrupt.ts          # Pause for approval on critical incidents
│  ├─ 1_resolver.ts
│  └─ linear.ts
└─ risk-review/
  ├─ parallel.ts           # Jury/consensus aggregator
  ├─ legal/
  │  └─ index.ts
  ├─ security/
  │  └─ index.ts
  └─ finance/
    └─ index.ts
```

This makes safety boundaries and approval points visible directly in the file tree.

## Economic Orchestration (FinOps-for-Agents)

AFR now supports **directory-scoped economic governance** to reduce chain creep, latency, and unpredictable token spend.

### 1) Tiered Model Routing (`tier.ts` / `model.ts`)

Define model defaults at the folder level. Child folders inherit parent tiers and can override only specific fields.

```text
agents/
├─ support/
│  ├─ tier.ts              # cheap defaults for support branch
│  ├─ faq/
│  │  └─ index.ts
│  └─ legal/
│     ├─ tier.ts           # overrides to stronger model for legal subtree
│     └─ index.ts
```

```typescript
// agents/support/tier.ts
export default {
  provider: "openrouter",
  modelId: "google/gemini-1.5-flash",
  maxTokens: 600
};
```

```typescript
// agents/support/legal/tier.ts
export default {
  modelId: "anthropic/claude-3-5-sonnet"
};
```

### 2) Escalation Ladder (`ladder.ts` + `simple.ts`)

Run a cheap direct path first. Only escalate to full agent execution when your `simple.ts` returns `REASONING_REQUIRED`.

```text
agents/intake/
├─ ladder.ts
├─ simple.ts
└─ index.ts
```

```typescript
// agents/intake/ladder.ts
export default {
  enabled: true,
  escalateSignal: "REASONING_REQUIRED"
};
```

```typescript
// agents/intake/simple.ts
export async function run({ input }: { input: unknown }) {
  const text = String(input ?? "");

  if (text.length < 120 && !text.includes("analyze deeply")) {
    return { output: `Quick answer: ${text}` };
  }

  return { status: "REASONING_REQUIRED" };
}
```

### 3) Hierarchical Budgeting (`budget.ts`)

Enforce hard limits on chain steps, aggregate tokens, and tool calls.

```typescript
// agents/risk-review/budget.ts
export default {
  maxSteps: 12,
  maxTokens: 18000,
  maxTools: 8
};
```

Budgets merge down the call stack using the **strictest limit** per field.

### 4) Recursive Path-Aware Caching (`cache.ts`)

Cache output by `{agentPath + normalizedInput}` with folder-level TTL policies.

```typescript
// agents/news/cache.ts
export default {
  enabled: true,
  ttlMs: 24 * 60 * 60 * 1000
};
```

```typescript
// agents/crypto/cache.ts
export default {
  enabled: true,
  ttlMs: 10 * 60 * 1000
};
```

### 5) Parallel Short-Circuiting

In parallel branches, AFR can stop sibling LLM calls when one child returns high confidence.

```typescript
const result = await executeAgent(registry, "root", "Evaluate proposal", {}, {
  modelConfig,
  parallel: {
    mode: "in-process",
    enableShortCircuit: true,
    shortCircuitConfidence: 0.95
  }
});
```

### FinOps Metadata + Dev Server Heatmap

Each execution now includes economic metadata under:

```typescript
result.context.metadata.economic
```

And `afr dev` exposes a real-time FinOps endpoint:

```text
GET /api/finops
```

The dashboard renders:
- Red folders: expensive/frontier-heavy or low cache-hit branches
- Green folders: low-cost/high-cache optimized branches
- Per-request COGS summary (e.g., cost and token usage for the latest request)

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

## Localized MCP Tool Injection

AFR includes **Localized MCP Tool Injection**, a powerful hierarchical MCP (Model Context Protocol) server management system that solves the **Tool Overload Problem** by scoping MCP servers to specific agent folders. Each folder can define its own `mcp_tools.ts` configuration, and agents automatically inherit tools from parent folders while remaining isolated from sibling branches.

### Why MCP Tool Injection?

**The Problem:**
- Exposing all 50+ tools to every agent wastes tokens and confuses the LLM
- Global tool lists make it hard to enforce security permissions
- Sharing API credentials across teams is risky and inflexible
- Scaling across departments means managing one massive tool registry

**The Solution:**
- Define MCP servers per-folder in `mcp_tools.ts` files
- Each agent only sees tools scoped to its folder path and parents
- Security boundaries = file-system boundaries (DevOps tools hidden from Marketing)
- Different API keys per department, no shared globals
- 35-50% context savings by exposing only relevant tools

### How It Works

**File Structure Example:**

```text
agents/
├── mcp_tools.ts                          # Global servers
├── devops/
│   ├── mcp_tools.ts                      # GitHub, Docker servers
│   ├── index.ts                          # DevOps orchestrator
│   └── incident/
│       ├── mcp_tools.ts                  # Monitoring, Incident servers
│       ├── index.ts                      # Incident response agent
│       └── 0_triage.ts                   # Sequential step
└── marketing/
    ├── mcp_tools.ts                      # Mailchimp, HubSpot servers
    ├── index.ts                          # Marketing orchestrator
    ├── copywriting/
    │   └── index.ts                      # Copywriter agent
    └── seo/
        └── index.ts                      # SEO specialist agent
```

**Tool Access by Agent:**

- `devops.incident` agent has access to:
  - Global tools (if defined at root)
  - Parent tools: GitHub, Docker
  - Own tools: Monitoring, Incident Tracking

- `marketing.seo` agent has access to:
  - Global tools (if defined at root)
  - Parent tools: Mailchimp, HubSpot, Analytics
  - Own tools: Search Console, Semrush
  - ❌ Cannot see: GitHub, Docker (DevOps branch is isolated)

### Creating mcp_tools.ts

Each `mcp_tools.ts` file defines which MCP servers are accessible at that folder level:

```typescript
// agents/devops/mcp_tools.ts
const MCPToolsConfig = {
  servers: {
    github: {
      name: "GitHub",
      command: "node",
      args: ["./mcp-servers/github-server.js"],
      env: {
        GITHUB_TOKEN: process.env.GITHUB_DEVOPS_TOKEN,  // Separate token per team
        GITHUB_OWNER: "my-company"
      },
      timeout: 30000,
      autoRestart: true
    },
    docker: {
      name: "Docker",
      command: "node",
      args: ["./mcp-servers/docker-server.js"],
      env: {
        DOCKER_HOST: process.env.DOCKER_HOST
      }
    }
  },
  
  // Optional: disable tool inheritance from parent
  inheritParent: true,  // Default: true
  
  // Optional: filter which tools are exposed
  toolFilter: {
    include: ["gh_*", "docker_*"],  // Only expose these patterns
    exclude: ["gh_delete_repo"]     // Hide sensitive operations
  },
  
  // Optional: add prefixes to avoid naming collisions
  toolPrefix: {
    github: "gh_",      // Tools named: gh_create_issue, gh_list_repos
    docker: "docker_"   // Tools named: docker_run, docker_stop
  }
};

export default MCPToolsConfig;
```

```typescript
// agents/devops/incident/mcp_tools.ts
// Inherits parent tools (GitHub, Docker) + adds monitoring
const MCPToolsConfig = {
  servers: {
    monitoring: {
      name: "Monitoring",
      command: "node",
      args: ["./mcp-servers/monitoring-server.js"],
      env: {
        DATADOG_API_KEY: process.env.MONITORING_API_KEY
      }
    },
    incidents: {
      name: "Incident Tracking",
      command: "node",
      args: ["./mcp-servers/incidents-server.js"],
      env: {
        PAGERDUTY_TOKEN: process.env.PAGERDUTY_TOKEN
      }
    }
  },
  inheritParent: true,  // Inherit GitHub and Docker from parent
  toolFilter: {
    exclude: ["gh_delete_*"]  // Don't expose destructive operations
  }
};

export default MCPToolsConfig;
```

### Example Real-World Configuration

**Marketing Team Setup:**

```typescript
// agents/marketing/mcp_tools.ts
const MCPToolsConfig = {
  servers: {
    mailchimp: {
      name: "Mailchimp",
      command: "node",
      args: ["./mcp-servers/mailchimp.js"],
      env: { MAILCHIMP_API_KEY: process.env.MAILCHIMP_KEY }
    },
    hubspot: {
      name: "HubSpot",
      command: "node",
      args: ["./mcp-servers/hubspot.js"],
      env: { HUBSPOT_API_KEY: process.env.HUBSPOT_KEY }
    },
    analytics: {
      name: "Google Analytics",
      command: "node",
      args: ["./mcp-servers/analytics.js"],
      env: { ANALYTICS_API_KEY: process.env.ANALYTICS_KEY }
    }
  },
  toolPrefix: {
    mailchimp: "email_",
    hubspot: "crm_",
    analytics: "analytics_"
  }
};

export default MCPToolsConfig;

// agents/marketing/seo/mcp_tools.ts
const MCPToolsConfig = {
  servers: {
    searchconsole: {
      name: "Google Search Console",
      command: "node",
      args: ["./mcp-servers/gsc.js"],
      env: { GSC_API_KEY: process.env.GSC_KEY }
    },
    semrush: {
      name: "Semrush",
      command: "node",
      args: ["./mcp-servers/semrush.js"],
      env: { SEMRUSH_TOKEN: process.env.SEMRUSH_TOKEN }
    }
  },
  inheritParent: true,
  toolPrefix: {
    searchconsole: "seo_",
    semrush: "seo_"
  }
};

export default MCPToolsConfig;
```

When the SEO specialist agent executes, it automatically has access to:
```
✓ email_* tools (Mailchimp)
✓ crm_* tools (HubSpot)
✓ analytics_* tools (Google Analytics)
✓ seo_* tools (Search Console, Semrush)
✗ Cannot see: GitHub, Docker, any DevOps tools
```

### How It Integrates

**Phase 1: Discovery**
```
npm run build
  ↓
Directory crawler finds all mcp_tools.ts files
  ↓
Stored in AgentRegistry
```

**Phase 2: Scope Resolution**
```
When executing agent "devops.incident":
  ↓
MCPConfigLoader.buildMCPScope() walks up tree:
  - Load root/mcp_tools.ts (if exists)
  - Load devops/mcp_tools.ts
  - Load devops/incident/mcp_tools.ts
  ↓
Merges configs respecting inheritParent flag
  ↓
Returns MCPScope with all accessible servers & tools
```

**Phase 3: Tool Hydration** (Coming in next phase)
```
Before LLM call:
  ↓
MCPServerClient connects to configured servers
  ↓
Applies filtering and namespacing
  ↓
Merges with local agent tools
  ↓
Passes all tools to LLM provider
```

### Key Features

✅ **Hierarchical Scoping** — File-system tree = tool-scope tree
✅ **Credential Isolation** — Different API keys per folder (no shared globals)
✅ **Tool Filtering** — Include/exclude patterns for sensitive operations
✅ **Tool Namespacing** — Add prefixes to avoid naming collisions (gh_create_issue vs gl_create_issue)
✅ **Lazy Initialization** — MCP servers connect only when needed
✅ **Configuration Caching** — Performance optimized
✅ **Type Safety** — Full TypeScript support with MCPScope and MCPToolDefinition types
✅ **Inheritance Control** — Optional inheritParent flag for custom scoping

### Advanced Features

**Tool Filtering:**
```typescript
// Only expose read-only tools to some agents
toolFilter: {
  include: ["gh_list_*", "gh_get_*"],  // Only read operations
  exclude: ["gh_delete_*"]              // Hide destructive ops
}
```

**Tool Prefixing to Avoid Collisions:**
```typescript
// Multiple GitHub-like servers with different prefixes
toolPrefix: {
  github: "gh_",
  gitlab: "gl_",
  gitea: "gitea_"
}
// Results in: gh_create_issue, gl_create_issue, gitea_create_issue
```

**Custom Credential Management:**
```typescript
// Different tokens per deployment context
servers: {
  github: {
    env: {
      // Uses different env vars per folder
      GITHUB_TOKEN: process.env.GITHUB_DEVOPS_TOKEN
    }
  }
}
```

### See Full Documentation

For complete MCP Tool Injection documentation, architecture details, and examples, see:
- [MCP_TOOL_INJECTION.md](./MCP_TOOL_INJECTION.md) — Full feature guide with 5-phase flow diagrams
- [MCP_QUICK_START.md](./MCP_QUICK_START.md) — Implementation summary and testing guide
- [examples/agents/devops/mcp_tools.ts](./examples/agents/devops/mcp_tools.ts) — Real DevOps setup
- [examples/agents/marketing/mcp_tools.ts](./examples/agents/marketing/mcp_tools.ts) — Real Marketing setup

## Guardrail Middleware Pattern

AFR now supports branch-level `middleware.ts` files that wrap execution for every agent inside that branch.

### What Problem It Solves

- **Input safety**: redact PII/PCI before requests reach the model.
- **Output safety**: block forbidden language, unsafe claims, or policy violations.
- **Branch governance**: enforce budget and policy checks by folder boundary.

### How It Works

- AFR resolves middleware from **root → leaf** along the call stack.
- Hooks execute in order: `beforePrompt`, `beforeToolCall`, `afterToolResult`, `afterResponse`, `onError`.
- The closest branch middleware can enforce strict branch-specific controls.

```typescript
// agents/finance/middleware.ts
export default {
  name: "finance-compliance",
  async beforePrompt(req) {
    return {
      systemPrompt: `${req.systemPrompt}\n\nCompliance: Never expose PCI/PII.`,
      messages: req.messages
    };
  },
  async afterResponse(req) {
    return { response: req.response.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "***-**-****") };
  }
};
```

## Shared Directory Context with layout.ts

AFR supports `layout.ts` files as inherited semantic wrappers for prompts.

### What Problem It Solves

- Eliminates duplicated system prompt fragments across sibling agents.
- Prevents drift in coding standards, company tone, and compliance wording.

### How It Works

- AFR resolves layout files from root to active leaf.
- `systemPromptPrefix` strings are concatenated in order.
- Final prompt = inherited layout prefix + local agent system prompt.

```typescript
// agents/layout.ts
export default {
  systemPromptPrefix: "Global rules: be factual, concise, and audit-friendly."
};

// agents/coding-assistant/layout.ts
export default {
  systemPromptPrefix: "Tech stack: Node.js 20, TypeScript strict mode, ESM only."
};
```

## Human-in-the-Loop Breakpoint with interrupt.ts

Sequential chains can now pause using `interrupt.ts` and resume later with `resumeAgent`.

### What Problem It Solves

- Prevents autonomous execution of critical decisions without approval.
- Enables long-running workflows that wait for human sign-off.

### How It Works

- If a sequential branch has `interrupt.ts`, AFR evaluates it before running `linear.ts`.
- If interrupt says pause, AFR saves a snapshot and returns a paused result with `snapshotId`.
- Resume with `resumeAgent(registry, sessionId, approvalData, options)`.

```typescript
import { executeAgent, resumeAgent, FileSnapshotStore } from "agentic-file-routing";

const snapshotStore = new FileSnapshotStore();

const firstRun = await executeAgent(registry, "root.tech-support", "Critical outage", {}, { snapshotStore });

if (firstRun.paused) {
  const resumed = await resumeAgent(registry, firstRun.context.sessionId, { approvedBy: "ops-manager" }, { snapshotStore });
  console.log(resumed.success);
}
```

## Parallel Ensemble Routing with parallel.ts

AFR can execute all child agents concurrently and aggregate consensus through `parallel.ts`.

### What Problem It Solves

- Reduces single-agent bias/hallucination in high-stakes decisions.
- Provides explicit multi-perspective adjudication.

### How It Works

- AFR detects `parallel.ts` (or `+debate/index.ts`) in a folder.
- All child agents execute concurrently using fan-out/fan-in.
- AFR uses `Promise.allSettled()` so one failed child does not collapse sibling results.
- The parallel orchestrator receives all results and returns consensus output.

### Fan-Out Runtime Modes

Configure `ExecutionOptions.parallel` to select execution isolation:

- `in-process` (default): concurrent sibling execution in the same Node.js process.
- `worker_threads`: each sibling branch runs in a dedicated worker thread via a worker pool.
- `remote`: branch execution is serialized and POSTed to a remote worker endpoint.

```typescript
const result = await executeAgent(
  registry,
  "root.risk-review",
  "Should we approve this rollout?",
  {},
  {
    parallel: {
      mode: "worker_threads", // or "in-process" | "remote"
      maxWorkers: 6,
      failFast: false,
      remote: {
        endpoint: "https://your-worker.example.com/api/afr-worker",
        apiKey: process.env.AFR_REMOTE_WORKER_KEY,
        timeoutMs: 45000
      }
    }
  }
);
```

```typescript
// agents/risk-review/parallel.ts
export async function run(ctx) {
  const successful = ctx.results.filter(r => r.success);
  return {
    mode: "parallel-ensemble",
    consensus: successful.map(r => ({ reviewer: r.childPath, summary: r.messages.at(-1)?.content ?? "" }))
  };
}
```

## NPM Readiness Enhancements

### AFR Dev Server

- Run `afr dev --agents ./examples/agents --port 3000`
- Opens local UI with live graph and execution endpoints.

### Hot Module Reloading (Registry Rebuild)

- `RegistryReloader` watches the agents folder and rebuilds registry on file changes.
- Dev server uses this for live updates without process restart.

### State Snapshots

- Built-in `SnapshotStore` interface with `InMemorySnapshotStore` and `FileSnapshotStore`.
- AFR stores snapshots on failures and interrupt pauses.
- Recover with `restartAgentFromSnapshot(...)` or `resumeAgent(...)`.

### Provider Fallbacks

- Add branch-level `fallback.ts` files to define provider/model failover chain.
- AFR retries configured fallback providers automatically.

```typescript
// agents/devops/fallback.ts
export default {
  providers: [
    { provider: "anthropic", modelId: "claude-3-5-sonnet-20241022", apiKeyEnv: "ANTHROPIC_API_KEY" },
    { provider: "openrouter", modelId: "openai/gpt-4o-mini", apiKeyEnv: "OPENROUTER_API_KEY" }
  ]
};
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

### Human Approval Resume Flow

```typescript
import { executeAgent, resumeAgent, FileSnapshotStore } from "agentic-file-routing";

const snapshotStore = new FileSnapshotStore();

const paused = await executeAgent(
  registry,
  "root.tech-support",
  "Critical incident affecting customer data",
  { severity: "critical" },
  { snapshotStore }
);

if (paused.paused) {
  const resumed = await resumeAgent(
    registry,
    paused.context.sessionId,
    { approvedBy: "manager-42", approvedAt: new Date().toISOString() },
    { snapshotStore }
  );
  console.log(resumed.success);
}
```

### Restart from Snapshot After Failure

```typescript
import { restartAgentFromSnapshot, listAgentSnapshots } from "agentic-file-routing";

const snapshots = await listAgentSnapshots(registry, { snapshotStore });
const latestFailed = snapshots.find((s) => s.status === "failed");

if (latestFailed) {
  const recovered = await restartAgentFromSnapshot(
    registry,
    latestFailed.id,
    "Retry with same context",
    { snapshotStore }
  );
  console.log(recovered.success);
}
```

### Parallel Ensemble Branch Execution

```typescript
const result = await executeAgent(
  registry,
  "root.risk-review",
  "Should we approve this high-risk enterprise rollout?"
);

// If risk-review has parallel.ts, AFR runs child agents concurrently and aggregates consensus.
console.log(result.finalOutput);
```

### Remote Worker Endpoint Pattern

Use `executeChildExecutionRequest` inside a serverless HTTP endpoint to process remote child jobs.

```typescript
import {
  executeChildExecutionRequest,
  type ChildExecutionRequest
} from "agentic-file-routing";

export async function POST(req: Request) {
  const payload = (await req.json()) as ChildExecutionRequest;
  const result = await executeChildExecutionRequest(payload);
  return Response.json(result);
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

**ExecutionOptions (parallel additions):**

```typescript
interface ExecutionOptions {
  // existing options omitted
  parallel?: {
    mode?: "in-process" | "worker_threads" | "remote";
    maxWorkers?: number;
    failFast?: boolean;
    remote?: {
      endpoint: string;
      apiKey?: string;
      headers?: Record<string, string>;
      timeoutMs?: number;
    };
  };
}
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
  paused?: boolean;
  snapshotId?: string;
}
```

### `resumeAgent(registry, sessionId, approvalData, options)`

Resume an interrupted workflow from a saved session snapshot.

```typescript
function resumeAgent(
  registry: AgentRegistry,
  sessionId: string,
  approvalData: unknown,
  options?: ExecutionOptions
): Promise<ExecutionResult>
```

### `restartAgentFromSnapshot(registry, snapshotId, userInputOverride?, options?)`

Restart execution from a failed/paused checkpoint.

```typescript
function restartAgentFromSnapshot(
  registry: AgentRegistry,
  snapshotId: string,
  userInputOverride?: string,
  options?: ExecutionOptions
): Promise<ExecutionResult>
```

### `listAgentSnapshots(registry, options?)`

List stored snapshots for observability and recovery workflows.

```typescript
function listAgentSnapshots(
  registry: AgentRegistry,
  options?: ExecutionOptions
): Promise<ExecutionSnapshot[]>
```

### `startAfrDevServer(options)`

Launch local AFR dev server with live graph and execute endpoints.

```typescript
function startAfrDevServer(options: {
  agentsRootDir: string;
  port?: number;
  loadDefinitions?: boolean;
  strictDefinitionLoading?: boolean;
  rootLogicalPath?: string;
}): Promise<void>
```

### `createProvider(config)`

Create a model provider instance.

```typescript
function createProvider(config: ModelConfig): ILlmProvider
```

**Supported Providers:**
- `"openai"` → OpenAI GPT-4, GPT-4o family
- `"anthropic"` → Anthropic Claude 3 family
- `"openrouter"` → OpenRouter model gateway

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

### Example 5: Hierarchical Tool Injection with MCP

Configure folder-scoped MCP servers where agents only see tools relevant to their domain:

```typescript
// agents/devops/mcp_tools.ts
export default {
  servers: {
    github: {
      name: "GitHub",
      command: "node",
      args: ["./servers/github.js"],
      env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
    },
    docker: {
      name: "Docker",
      command: "node",
      args: ["./servers/docker.js"],
      env: { DOCKER_HOST: process.env.DOCKER_HOST }
    }
  },
  toolPrefix: { github: "gh_", docker: "docker_" },
  toolFilter: { exclude: ["gh_delete_repo"] }  // Hide destructive ops
};

// agents/devops/incident/mcp_tools.ts
export default {
  servers: {
    monitoring: {
      name: "Datadog",
      command: "node",
      args: ["./servers/datadog.js"],
      env: { DATADOG_API_KEY: process.env.DATADOG_KEY }
    }
  },
  inheritParent: true  // Inherit GitHub & Docker from parent
};

// agents/marketing/mcp_tools.ts
export default {
  servers: {
    mailchimp: {
      name: "Mailchimp",
      command: "node",
      args: ["./servers/mailchimp.js"],
      env: { MAILCHIMP_KEY: process.env.MAILCHIMP_KEY }
    },
    hubspot: {
      name: "HubSpot",
      command: "node",
      args: ["./servers/hubspot.js"],
      env: { HUBSPOT_KEY: process.env.HUBSPOT_KEY }
    }
  }
  // DevOps branch is isolated - no GitHub or Docker tools
};

// Now when executing agents:
const devopsRegistry = await buildAgentRegistry({
  agentsRootDir: "./agents",
  loadDefinitions: true
});

// devops.incident agent automatically has:
// ✓ gh_* (GitHub), docker_* (Docker), monitor_* (Datadog)
const incidentResult = await executeAgent(
  devopsRegistry,
  "root.devops.incident",
  "Production database down, investigate"
);

// marketing agent automatically has:
// ✓ email_* (Mailchimp), crm_* (HubSpot)
// ✗ Cannot see: GitHub, Docker tools
const marketingResult = await executeAgent(
  devopsRegistry,
  "root.marketing",
  "Create campaign for product launch"
);
```

**Key Benefits:**
- Security: DevOps tools hidden from Marketing agents
- Efficiency: Each agent sees only 5-10 relevant tools (not 50+ global tools)
- Credentials: GITHUB_TOKEN, MAILCHIMP_KEY safely isolated per folder
- Inheritance: Sub-agents automatically get parent tools
- Flexibility: Add mcp_tools.ts to any folder to introduce new servers

See [Localized MCP Tool Injection](#localized-mcp-tool-injection) section and [MCP_TOOL_INJECTION.md](./MCP_TOOL_INJECTION.md) for complete documentation.

## Development

### Project Structure

```
.
├── src/
│   ├── types.ts              # Core type definitions
│   ├── errors.ts             # Error classes
│   ├── path-utils.ts         # Route parsing
│   ├── sequential.ts         # Sequential chain orchestration
│   ├── parallel.ts           # Parallel ensemble orchestration
│   ├── loader/
│   │   ├── discover.ts       # Directory crawler
│   │   ├── registry.ts       # Registry builder
│   │   └── module-resolver.ts # Runtime TS/JS module resolution
│   ├── executor/
│   │   ├── session.ts        # Session management
│   │   ├── messages.ts       # Message types
│   │   ├── executor.ts       # Core engine
│   │   └── index.ts          # Executor exports
│   ├── layout/
│   │   └── loader.ts         # Hierarchical layout.ts resolver
│   ├── snapshots/
│   │   └── store.ts          # Snapshot persistence (memory/file)
│   ├── dev/
│   │   ├── reloader.ts       # Registry HMR watcher
│   │   └── server.ts         # AFR dev server
│   ├── providers/
│   │   ├── types.ts          # Provider interface
│   │   ├── openai.ts         # OpenAI adapter
│   │   ├── anthropic.ts      # Anthropic adapter
│   │   ├── openrouter.ts     # OpenRouter adapter
│   │   ├── factory.ts        # Provider factory
│   │   ├── fallback-loader.ts # Branch fallback.ts resolver
│   │   └── index.ts          # Provider exports
│   ├── mcp/
│   │   ├── types.ts          # MCP type definitions
│   │   ├── loader.ts         # MCP config discovery & scope resolution
│   │   ├── client.ts         # MCP server connection management
│   │   ├── hydrator.ts       # Tool format conversion & merging
│   │   └── index.ts          # MCP module exports
│   ├── demo.ts               # Milestone 2 demo
│   ├── demo3.ts              # Milestone 3 demo
│   ├── demo-sequential.ts    # Sequential chain demos
│   └── index.ts              # Package entry
├── examples/
│   └── agents/               # Example agent trees
│       ├── devops/
│       │   ├── mcp_tools.ts  # MCP config with GitHub, Docker
│       │   └── incident/
│       │       └── mcp_tools.ts  # Inherits + Monitoring, Incidents
│       ├── marketing/
│       │   ├── mcp_tools.ts  # MCP config with Email, CRM, Analytics
│       │   ├── copywriting/
│       │   └── seo/
│       │       └── mcp_tools.ts  # Inherits + SEO tools
│       ├── competitor-analysis/  # Sequential workflow + interrupt.ts example
│       ├── risk-review/          # Parallel ensemble example (parallel.ts)
│       └── finance/              # Branch middleware compliance example
├── dist/                     # Compiled output (generated)
├── SEQUENTIAL_CHAIN_ORCHESTRATION.md     # Sequential feature docs
├── SEQUENTIAL_IMPLEMENTATION_SUMMARY.md  # Implementation details
├── MCP_TOOL_INJECTION.md                 # MCP feature documentation
├── MCP_QUICK_START.md                    # MCP quick reference
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

# Start AFR dev server (graph + execute API)
npm run dev

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
- **Milestone 3**: Provider adapters (OpenAI, Anthropic, OpenRouter)
- **Milestone 4-5**: Context inheritance, policy layer, and middleware
- **Milestone 6**: Sequential Chain Orchestration (numbered agents + linear.ts orchestrators)
- **Milestone 7**: Localized MCP Tool Injection (hierarchical MCP server scoping with mcp_tools.ts)
- **Milestone 8**: Guardrail middleware + layout inheritance + interrupt/resume + parallel routing
- **Milestone 9**: Dev server, registry HMR, snapshots, and provider fallback chain

### 🔄 In Progress

- **Executor MCP Integration** — Injecting hydrated MCP tools directly into provider calls
- **Production hardening** — Expanded tests, stricter config validation, and benchmark suite

### 📋 Planned

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

**Q: What is Localized MCP Tool Injection?**
A: A hierarchical MCP server management system where agents only see tools scoped to their folder. Each folder's `mcp_tools.ts` defines which MCP servers are accessible, with automatic inheritance from parents. Solves the "Tool Overload" and "Credential Isolation" problems. See [Localized MCP Tool Injection](#localized-mcp-tool-injection) section.

**Q: Can I limit which tools are visible to specific agents?**
A: Yes! Use `toolFilter` in `mcp_tools.ts` with include/exclude patterns. Hide sensitive operations like `gh_delete_repo` from certain agents:
```javascript
toolFilter: {
  include: ["gh_list_*", "gh_get_*"],  // Only read operations
  exclude: ["gh_delete_*"]              // Hide destructive ops
}
```

**Q: How do I manage different API keys for different teams?**
A: Each `mcp_tools.ts` points to different environment variables:
```javascript
// devops/mcp_tools.ts
servers: {
  github: { env: { GITHUB_TOKEN: process.env.GITHUB_DEVOPS_TOKEN } }
}

// marketing/mcp_tools.ts
servers: {
  mailchimp: { env: { MAILCHIMP_KEY: process.env.MARKETING_MAILCHIMP_KEY } }
}
```

**Q: Can agents from one branch (e.g., Marketing) see tools from another (e.g., DevOps)?**
A: No. If `inheritParent: false`, sibling branches are completely isolated. Marketing agents only see Marketing servers, DevOps only sees DevOps servers. This is by design for security.

**Q: What if I want all agents to have access to certain global tools?**
A: Define them in a root-level `mcp_tools.ts`:
```javascript
// agents/mcp_tools.ts (root)
servers: {
  logs: { /* Central logging */ }
}
// All subfolders inherit this
// agents/devops/mcp_tools.ts
inheritParent: true  // Gets logs + github + docker
```

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
