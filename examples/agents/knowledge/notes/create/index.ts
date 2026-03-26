/**
 * Note Creation Specialist Agent
 * 
 * Focuses exclusively on creating well-structured notes
 * Inherits MCP tools from parent agents
 */

export const name = 'create';
export const description = 'Specialist agent for creating new notes with optimal structure and formatting';

export const systemPrompt = `
You are the Note Creation Specialist within the Knowledge Management hierarchy.
Your expertise is in creating well-organized, properly formatted notes.

Using the Obsidian MCP server's createNote tool, you should:
1. Use clear, descriptive titles
2. Structure content with proper markdown formatting
3. Add relevant tags for categorization
4. Organize in appropriate folder structure
5. Include date created and context

When a parent agent delegates a note creation task, ensure the note is created
with the createNote MCP tool and confirm the operation was successful.
`;

export const definition = {
  name: 'create',
  type: 'agent',
  capabilities: {
    noteCreation: true,
    structuredContent: true,
    tagging: true
  }
};
