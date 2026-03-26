/**
 * Demo 5: Knowledge Agent with Obsidian MCP Tools
 * 
 * This demo showcases the Localized MCP Tool Injection feature by:
 * 1. Setting up a Knowledge Management agent hierarchy with MCP tools
 * 2. Executing the root agent with prompts that trigger note operations
 * 3. Verifying that the agent considers MCP tools in its decision-making
 * 4. Demonstrating hierarchical delegation to specialized child agents
 * 
 * Setup Required:
 * - Docker: docker-compose up -d (starts Obsidian MCP server)
 * - Environment: Set OPENROUTER_API_KEY in .env file
 */

import * as fs from 'fs';
import { AfrExecutor } from './executor/executor.js';
import { buildAgentRegistry } from './loader/registry.js';

async function main() {
  try {
    console.log('\n🚀 Knowledge Agent with Obsidian MCP Tools Demo\n');

    // Load registry (includes MCP tool discovery)
    console.log('📚 Loading agent registry with MCP tools...');
    const registry = await buildAgentRegistry({ agentsRootDir: './examples/agents' });

    // Verify knowledge agent is loaded
    const knowledgeAgent = registry.records['knowledge'];
    if (!knowledgeAgent) {
      console.error('❌ Knowledge agent not found in registry');
      process.exit(1);
    }

    console.log(`✅ Loaded ${Object.keys(registry.records).length} agents`);
    console.log(`   Knowledge agent: ${knowledgeAgent.definition?.name || 'unknown'}`);
    if (knowledgeAgent.mcpConfig?.hasMcpConfig) {
      const mcpServers = (knowledgeAgent.mcpConfig.config as any)?.servers as any[];
      if (mcpServers) {
        console.log(`   📡 MCP Servers: ${mcpServers.map((s: any) => s.name).join(', ')}`);
      }
    }

    // Create executor
    const executor = new AfrExecutor(registry);

    // Define test prompts that should trigger MCP tool consideration
    const testPrompts = [
      {
        name: 'Project Documentation',
        prompt: `I need to document the AFR architecture and MCP tool injection feature. 
                 Please create a comprehensive note that explains:
                 1. How AFR discovers and loads agents
                 2. The hierarchical scoping of MCP tools
                 3. How tools are exposed to child agents
                 4. An example of the Obsidian note-taking integration
                 
                 Use the knowledge management system to create this documentation.`,
        expectedTools: ['createNote']
      },
      {
        name: 'Knowledge Base Query',
        prompt: `I want to see all the notes we have about the AFR project and MCP integration.
                 Please list the notes in our knowledge base and show me what documentation 
                 we already have about this feature.`,
        expectedTools: ['listNotes', 'searchNotes']
      },
      {
        name: 'Documentation Update',
        prompt: `We just completed the Docker integration for the MCP Obsidian server.
                 Update the AFR architecture note to include information about:
                 - The Docker containerization approach
                 - How to run the Obsidian server
                 - The MCP tool endpoints and their functionality`,
        expectedTools: ['updateNote']
      }
    ];

    // Execute prompts and collect results
    const mcpServers = (knowledgeAgent.mcpConfig?.config as any)?.servers as any[];
    const results: any = {
      timestamp: new Date().toISOString(),
      agent: knowledgeAgent.definition?.name,
      mcp_tools: mcpServers?.map((s: any) => s.name) || [],
      prompts: []
    };

    for (const testCase of testPrompts) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🧠 Prompt: ${testCase.name}`);
      console.log(`${'='.repeat(70)}`);
      console.log(`\nUser: ${testCase.prompt}\n`);

      try {
        const startTime = Date.now();
        const response = await executor.execute('knowledge', testCase.prompt);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`\nAssistant: ${response.messages.map(m => m.content).join(' ')}`);
        console.log(`\n⏱️  Response time: ${duration}s`);

        // Check for mentions of MCP tools
        const response_text = response.messages.map((m: any) => m.content).join(' ').toLowerCase();
        const mentioned_tools = testCase.expectedTools.filter(tool =>
          response_text.includes(tool.toLowerCase())
        );

        console.log(`\n📊 Analysis:`);
        console.log(`   Expected tools: ${testCase.expectedTools.join(', ')}`);
        console.log(`   Mentioned tools: ${mentioned_tools.length > 0 ? mentioned_tools.join(', ') : 'none'}`);

        // Check if tool calls are present
        const hasToolCalls = response_text.includes('tool') || response_text.includes('function');
        console.log(`   Tool delegation: ${hasToolCalls ? '✅ Detected' : '❌ Not detected'}`);

        results.prompts.push({
          name: testCase.name,
          prompt: testCase.prompt,
          responseTime: parseFloat(duration),
          mentionedTools: mentioned_tools,
          hasToolDelegation: hasToolCalls,
          response: response.messages.map((m: any) => m.content).join(' ')
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error executing prompt: ${errorMessage}`);
        results.prompts.push({
          name: testCase.name,
          error: errorMessage
        });
      }
    }

    // Save results to file
    const outputFile = 'demo5-knowledge-agent-output.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n\n📁 Full results saved to: ${outputFile}`);

    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📈 Summary`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Total prompts executed: ${results.prompts.filter((p: any) => !p.error).length}/${results.prompts.length}`);

    const toolMentions = results.prompts.reduce((sum: number, p: any) => sum + (p.mentionedTools?.length || 0), 0);
    console.log(`Tool mentions found: ${toolMentions}`);

    const avgTime = results.prompts
      .filter((p: any) => p.responseTime)
      .reduce((sum: number, p: any) => sum + p.responseTime, 0) / results.prompts.filter((p: any) => p.responseTime).length;
    console.log(`Average response time: ${avgTime.toFixed(1)}s`);

    console.log(`\n✨ MCP Tool Injection demo completed!`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
