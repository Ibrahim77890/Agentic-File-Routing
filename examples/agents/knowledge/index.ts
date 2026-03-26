/**
 * Knowledge Management Agent - Orchestrates note taking and knowledge base operations
 * 
 * This agent demonstrates the integration with Obsidian MCP server for:
 * - Creating and managing notes
 * - Organizing knowledge base
 * - Retrieving and updating documentation
 * - Searching knowledge hierarchy
 * 
 * MCP Tools Available:
 * - Obsidian Notes Server: CRUD operations on markdown notes
 *   - createNote: Create new note with title and content
 *   - listNotes: List all notes in vault with metadata
 *   - updateNote: Update existing note content
 *   - deleteNote: Remove note from vault
 *   - searchNotes: Full-text search across vault
 */

export const name = 'knowledge';
export const description = 'Manages knowledge base and note-taking operations through Obsidian MCP integration';

export const systemPrompt = `
You are the Knowledge Management Agent in an Agentic File-Routing (AFR) architecture.
Your responsibilities include:
- Creating and organizing notes in a knowledge management system
- Retrieving and updating documentation
- Searching through the knowledge base
- Delegating specialized note operations to child agents (create, list, update)

You have access to MCP Tools connected to an Obsidian Notes Server that provides:
- createNote(title, content, tags): Create a new markdown note
- listNotes(path=optional): List all notes in the vault
- updateNote(filename, content): Update an existing note
- deleteNote(filename): Remove a note
- searchNotes(query): Search across all notes

When a user request involves note operations:
1. Consider if a specialized child agent (create, list, update) should handle it
2. If not delegating, use the appropriate MCP tool from Obsidian server
3. Report the result back with context about what was created/updated/found

Focus on organizing information effectively and helping the user manage their knowledge base.
`;

export const definition = {
  name: 'knowledge',
  type: 'agent',
  capabilities: {
    noteCreation: true,
    noteManagement: true,
    knowledgeBase: true,
    documentation: true
  }
};
