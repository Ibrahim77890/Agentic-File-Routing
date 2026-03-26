import { createServer } from "node:http";
import { RegistryReloader, toGraph, type RegistryReloaderOptions } from "./reloader.js";
import { executeAgent, resumeAgent } from "../executor/executor.js";
import { FileSnapshotStore } from "../snapshots/store.js";

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
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; background: #f7f7f7; }
    header { padding: 16px 20px; background: #111827; color: #fff; }
    main { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; padding: 16px; }
    section { background: #fff; border-radius: 8px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    textarea, input { width: 100%; box-sizing: border-box; margin: 8px 0; padding: 8px; }
    button { background: #2563eb; color: #fff; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
    pre { background: #0b1020; color: #d1e7ff; padding: 8px; border-radius: 6px; max-height: 50vh; overflow: auto; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <header><strong>AFR Dev Server</strong> - Live graph + execution sandbox</header>
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
  </main>
  <script>
    const resultEl = document.getElementById('result');
    const graphEl = document.getElementById('graph');

    async function loadGraph() {
      const res = await fetch('/api/graph');
      const data = await res.json();
      graphEl.innerHTML = '<ul>' + data.graph.map(n => '<li><strong>' + n.path + '</strong> -> ' + (n.children.length ? n.children.join(', ') : '(leaf)') + '</li>').join('') + '</ul>';
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
    });

    loadGraph();
  </script>
</body>
</html>`;
}

export async function startAfrDevServer(options: AfrDevServerOptions): Promise<void> {
  const port = options.port ?? 3000;
  const reloader = new RegistryReloader(options);
  const snapshotStore = new FileSnapshotStore();
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
