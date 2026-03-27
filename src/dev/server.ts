import { createServer } from "node:http";
import { RegistryReloader, toGraph, type RegistryReloaderOptions } from "./reloader.js";
import { executeAgent, resumeAgent } from "../executor/executor.js";
import { FileSnapshotStore } from "../snapshots/store.js";

interface FinOpsPathPoint {
  path: string;
  executions: number;
  totalCostUsd: number;
  totalTokens: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  avgCostUsd: number;
  avgTokens: number;
  modelClass: "cheap" | "frontier" | "mixed";
  heat: "green" | "yellow" | "red";
}

interface FinOpsSnapshot {
  requests: number;
  totalCostUsd: number;
  totalTokens: number;
  avgCostPerRequestUsd: number;
  latestRequestCostUsd: number;
  latestRequestAgentCount: number;
  latestRequestTokens: number;
  heatmap: FinOpsPathPoint[];
}

interface EconomicByPathRecord {
  path: string;
  totalTokens?: number;
  cacheHits?: number;
  cacheMisses?: number;
  estimatedCostUsd?: number;
  lastModelId?: string;
}

interface EconomicSummaryPayload {
  estimatedCostUsd?: number;
  tokensUsed?: number;
  byPath?: EconomicByPathRecord[];
}

function classifyModel(modelId: string | undefined): "cheap" | "frontier" {
  if (!modelId) {
    return "frontier";
  }

  const normalized = modelId.toLowerCase();
  if (
    normalized.includes("mini") ||
    normalized.includes("flash") ||
    normalized.includes("haiku") ||
    normalized.includes("nano")
  ) {
    return "cheap";
  }

  return "frontier";
}

function classifyHeat(avgCostUsd: number, cacheHitRate: number, modelClass: "cheap" | "frontier" | "mixed"): "green" | "yellow" | "red" {
  if (modelClass === "frontier" && (avgCostUsd > 0.05 || cacheHitRate < 0.1)) {
    return "red";
  }

  if (modelClass === "cheap" && avgCostUsd <= 0.01 && cacheHitRate >= 0.2) {
    return "green";
  }

  if (avgCostUsd <= 0.015 && cacheHitRate >= 0.15) {
    return "green";
  }

  return "yellow";
}

function createFinOpsStore() {
  const pathStats = new Map<
    string,
    {
      executions: number;
      totalCostUsd: number;
      totalTokens: number;
      cacheHits: number;
      cacheMisses: number;
      cheapCount: number;
      frontierCount: number;
    }
  >();

  let requests = 0;
  let totalCostUsd = 0;
  let totalTokens = 0;
  let latestRequestCostUsd = 0;
  let latestRequestAgentCount = 0;
  let latestRequestTokens = 0;

  function record(summary?: EconomicSummaryPayload): void {
    if (!summary) {
      return;
    }

    requests += 1;
    latestRequestCostUsd = summary.estimatedCostUsd ?? 0;
    latestRequestTokens = summary.tokensUsed ?? 0;
    latestRequestAgentCount = summary.byPath?.length ?? 0;

    totalCostUsd += latestRequestCostUsd;
    totalTokens += latestRequestTokens;

    for (const pathEntry of summary.byPath ?? []) {
      const existing = pathStats.get(pathEntry.path) ?? {
        executions: 0,
        totalCostUsd: 0,
        totalTokens: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cheapCount: 0,
        frontierCount: 0
      };

      existing.executions += 1;
      existing.totalCostUsd += pathEntry.estimatedCostUsd ?? 0;
      existing.totalTokens += pathEntry.totalTokens ?? 0;
      existing.cacheHits += pathEntry.cacheHits ?? 0;
      existing.cacheMisses += pathEntry.cacheMisses ?? 0;

      const modelClass = classifyModel(pathEntry.lastModelId);
      if (modelClass === "cheap") {
        existing.cheapCount += 1;
      } else {
        existing.frontierCount += 1;
      }

      pathStats.set(pathEntry.path, existing);
    }
  }

  function snapshot(): FinOpsSnapshot {
    const heatmap: FinOpsPathPoint[] = Array.from(pathStats.entries())
      .map(([path, value]) => {
        const avgCostUsd = value.executions > 0 ? value.totalCostUsd / value.executions : 0;
        const avgTokens = value.executions > 0 ? value.totalTokens / value.executions : 0;
        const cacheEvents = value.cacheHits + value.cacheMisses;
        const cacheHitRate = cacheEvents > 0 ? value.cacheHits / cacheEvents : 0;
        const modelClass: "cheap" | "frontier" | "mixed" =
          value.cheapCount > 0 && value.frontierCount > 0
            ? "mixed"
            : value.cheapCount > 0
              ? "cheap"
              : "frontier";

        return {
          path,
          executions: value.executions,
          totalCostUsd: Number(value.totalCostUsd.toFixed(6)),
          totalTokens: value.totalTokens,
          cacheHits: value.cacheHits,
          cacheMisses: value.cacheMisses,
          cacheHitRate,
          avgCostUsd,
          avgTokens,
          modelClass,
          heat: classifyHeat(avgCostUsd, cacheHitRate, modelClass)
        };
      })
      .sort((a, b) => b.avgCostUsd - a.avgCostUsd);

    return {
      requests,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      totalTokens,
      avgCostPerRequestUsd: requests > 0 ? Number((totalCostUsd / requests).toFixed(6)) : 0,
      latestRequestCostUsd,
      latestRequestAgentCount,
      latestRequestTokens,
      heatmap
    };
  }

  return {
    record,
    snapshot
  };
}

export interface AfrDevServerOptions extends RegistryReloaderOptions {
  port?: number;
}

function readBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf-8");
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function pageHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AFR Dev Server</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f7f4ec;
      --ink: #101828;
      --muted: #475467;
      --card: #fffdf7;
      --edge: #d6d6ca;
      --brand: #0f766e;
      --brand-2: #0369a1;
      --danger: #b42318;
      --warn: #b54708;
      --ok: #027a48;
      --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
      --display: "Space Grotesk", "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background:
        radial-gradient(circle at 20% 0%, rgba(14, 165, 233, 0.15), transparent 35%),
        radial-gradient(circle at 80% 0%, rgba(34, 197, 94, 0.12), transparent 32%),
        var(--bg);
      font-family: var(--display);
    }
    header {
      padding: 18px 20px;
      background: linear-gradient(120deg, #0b3d3a 0%, #0a4f70 60%, #0b3d3a 100%);
      color: #f8fafc;
      border-bottom: 3px solid rgba(255, 255, 255, 0.2);
    }
    header p {
      margin: 6px 0 0;
      opacity: 0.9;
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    main {
      display: grid;
      gap: 14px;
      grid-template-columns: 1.1fr 1fr;
      padding: 14px;
    }
    section {
      background: var(--card);
      border: 1px solid var(--edge);
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
    }
    .span-2 { grid-column: span 2; }
    h3 {
      margin: 0 0 10px;
      font-size: 18px;
      letter-spacing: 0.02em;
    }
    textarea, input {
      width: 100%;
      margin: 8px 0;
      padding: 10px;
      border: 1px solid var(--edge);
      border-radius: 8px;
      font-family: var(--mono);
      background: #ffffff;
    }
    button {
      background: linear-gradient(120deg, var(--brand), var(--brand-2));
      color: #f8fafc;
      border: 0;
      padding: 9px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    pre {
      background: #0f172a;
      color: #d4f1ff;
      padding: 10px;
      border-radius: 8px;
      max-height: 45vh;
      overflow: auto;
      font-family: var(--mono);
      font-size: 12px;
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    ul { padding-left: 18px; margin: 0; }
    .stats-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      margin-bottom: 12px;
    }
    .stat {
      border: 1px solid var(--edge);
      border-radius: 8px;
      padding: 8px;
      background: #fff;
    }
    .stat .label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .stat .value {
      font-size: 20px;
      font-family: var(--mono);
      font-weight: 500;
    }
    .heatmap-row {
      display: grid;
      grid-template-columns: 10px minmax(220px, 1fr) repeat(4, minmax(90px, 120px));
      gap: 8px;
      align-items: center;
      padding: 8px;
      border: 1px solid var(--edge);
      border-radius: 8px;
      margin-bottom: 8px;
      background: #fff;
      font-family: var(--mono);
      font-size: 12px;
    }
    .heat-pill { width: 10px; height: 100%; border-radius: 999px; }
    .heat-red { background: var(--danger); }
    .heat-yellow { background: var(--warn); }
    .heat-green { background: var(--ok); }
    .model-class {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #344054;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.06em;
    }
    .empty {
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      padding: 10px;
      border: 1px dashed var(--edge);
      border-radius: 8px;
    }
    @media (max-width: 980px) {
      main { grid-template-columns: 1fr; }
      .span-2 { grid-column: span 1; }
      .heatmap-row {
        grid-template-columns: 10px 1fr;
        gap: 6px;
      }
    }
  </style>
</head>
<body>
  <header>
    <strong>AFR Dev Server</strong>
    <p>Live graph, execution sandbox, and economic orchestration heatmap</p>
  </header>
  <main>
    <section>
      <h3>Run Agent</h3>
      <input id="agentPath" value="root" placeholder="agent path" />
      <textarea id="input" rows="6" placeholder="task input"></textarea>
      <button id="run">Execute</button>
      <pre id="result">No execution yet.</pre>
    </section>
    <section>
      <h3>Agent Graph</h3>
      <button id="refresh">Refresh Graph</button>
      <div id="graph"></div>
    </section>
    <section class="span-2">
      <h3>Economic Heatmap</h3>
      <div id="finopsStats" class="stats-grid"></div>
      <div id="heatmap"></div>
    </section>
  </main>
  <script>
    const resultEl = document.getElementById('result');
    const graphEl = document.getElementById('graph');
    const finopsStatsEl = document.getElementById('finopsStats');
    const heatmapEl = document.getElementById('heatmap');

    function usd(value) {
      return '$' + Number(value || 0).toFixed(4);
    }

    function pct(value) {
      return (Number(value || 0) * 100).toFixed(1) + '%';
    }

    async function loadGraph() {
      const res = await fetch('/api/graph');
      const data = await res.json();
      graphEl.innerHTML = '<ul>' + data.graph.map(n => '<li><strong>' + n.path + '</strong> -> ' + (n.children.length ? n.children.join(', ') : '(leaf)') + '</li>').join('') + '</ul>';
    }

    async function loadFinOps() {
      const res = await fetch('/api/finops');
      const data = await res.json();

      finopsStatsEl.innerHTML = [
        ['Requests', data.requests],
        ['Total COGS', usd(data.totalCostUsd)],
        ['Avg Cost/Req', usd(data.avgCostPerRequestUsd)],
        ['Latest Request', usd(data.latestRequestCostUsd)],
        ['Latest Tokens', Number(data.latestRequestTokens || 0).toLocaleString()],
        ['Agents Last Run', data.latestRequestAgentCount]
      ].map(([label, value]) => '<div class="stat"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>').join('');

      if (!data.heatmap || data.heatmap.length === 0) {
        heatmapEl.innerHTML = '<div class="empty">No executions yet. Run an agent to populate cost telemetry.</div>';
        return;
      }

      heatmapEl.innerHTML = data.heatmap.map((row) => {
        const heatClass = row.heat === 'red' ? 'heat-red' : (row.heat === 'green' ? 'heat-green' : 'heat-yellow');
        return '<div class="heatmap-row">'
          + '<div class="heat-pill ' + heatClass + '"></div>'
          + '<div><strong>' + row.path + '</strong> <span class="model-class">' + row.modelClass + '</span></div>'
          + '<div>Avg Cost<br/><strong>' + usd(row.avgCostUsd) + '</strong></div>'
          + '<div>Avg Tokens<br/><strong>' + Math.round(row.avgTokens).toLocaleString() + '</strong></div>'
          + '<div>Cache Hit<br/><strong>' + pct(row.cacheHitRate) + '</strong></div>'
          + '<div>Runs<br/><strong>' + row.executions + '</strong></div>'
          + '</div>';
      }).join('');
    }

    document.getElementById('refresh').addEventListener('click', loadGraph);

    document.getElementById('run').addEventListener('click', async () => {
      const payload = {
        agentPath: document.getElementById('agentPath').value || 'root',
        input: document.getElementById('input').value || ''
      };

      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      resultEl.textContent = JSON.stringify(data, null, 2);
      loadGraph();
      loadFinOps();
    });

    loadGraph();
    loadFinOps();
  </script>
</body>
</html>`;
}

export async function startAfrDevServer(options: AfrDevServerOptions): Promise<void> {
  const port = options.port ?? 3000;
  const reloader = new RegistryReloader(options);
  const snapshotStore = new FileSnapshotStore();
  const finOpsStore = createFinOpsStore();
  await reloader.start();

  const server = createServer(async (req, res) => {
    try {
      if (!req.url) {
        res.writeHead(404).end("Not Found");
        return;
      }

      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(pageHtml());
        return;
      }

      if (req.method === "GET" && req.url === "/api/graph") {
        const registry = reloader.getRegistry();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ graph: registry ? toGraph(registry) : [] }));
        return;
      }

      if (req.method === "GET" && req.url === "/api/finops") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(finOpsStore.snapshot()));
        return;
      }

      if (req.method === "POST" && req.url === "/api/execute") {
        const registry = reloader.getRegistry();
        if (!registry) {
          res.writeHead(503, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Registry not ready" }));
          return;
        }

        const body = await readBody(req);
        const agentPath = String(body.agentPath || "root");
        const input = String(body.input || "");

        const result = await executeAgent(
          registry,
          agentPath,
          input,
          body.context && typeof body.context === "object" ? body.context : {},
          {
            modelConfig: body.modelConfig,
            snapshotStore
          }
        );

        const economic = (result.context.metadata?.economic ?? undefined) as EconomicSummaryPayload | undefined;
        finOpsStore.record(economic);

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === "POST" && req.url === "/api/resume") {
        const registry = reloader.getRegistry();
        if (!registry) {
          res.writeHead(503, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Registry not ready" }));
          return;
        }

        const body = await readBody(req);
        const sessionId = String(body.sessionId || "");
        const approvalData = body.approvalData;

        const result = await resumeAgent(registry, sessionId, approvalData, {
          modelConfig: body.modelConfig,
          snapshotStore
        });

        const economic = (result.context.metadata?.economic ?? undefined) as EconomicSummaryPayload | undefined;
        finOpsStore.record(economic);

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      res.writeHead(404).end("Not Found");
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error)
        })
      );
    }
  });

  server.listen(port, () => {
    console.log(`AFR dev server running at http://localhost:${port}`);
  });

  process.on("SIGINT", () => {
    reloader.stop();
    server.close();
    process.exit(0);
  });
}
