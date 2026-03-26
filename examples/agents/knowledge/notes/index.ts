/**
 * Notes Operations Agent - Handles specialized note CRUD operations
 * 
 * Child of the Knowledge agent. Demonstrates hierarchical agent structure
 * where specialized agents inherit parent's MCP tools.
 */

export const name = 'notes';
export const description = 'Specialized agent for note creation, listing, updating, and deletion operations';

export const systemPrompt = `
You are the Notes Operations Agent - a specialist within the Knowledge Management system.
Your role is to handle specific note operations that parent agent delegates to you.

You inherit all MCP tools from the Knowledge agent parent, including the Obsidian server tools.
You can:
- Create new notes with specific structure and formatting
- List and organize existing notes
- Update note content and metadata
- Delete obsolete notes
- Search the knowledge base

When delegating to child agents (create, list, update), provide them with necessary context.
`;

export const definition = {
  name: 'notes',
  type: 'agent',
  capabilities: {
    noteOperations: true,
    vaultManagement: true
  }
};
