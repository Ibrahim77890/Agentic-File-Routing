/**
 * MCP Tools Configuration for Knowledge Agent
 * Connects to Obsidian Notes Server via Docker container
 * 
 * This demonstrates the Localized MCP Tool Injection feature where MCP tools
 * are discovered and loaded based on folder scope during agent initialization.
 */

export default {
  servers: [
    {
      name: 'obsidian',
      description: 'Obsidian Notes Management Server - CRUD operations on markdown vault',
      version: '1.0.0',
      
      // Connection method: Docker compose exec
      command: 'docker',
      args: [
        'exec',
        'afr-obsidian-mcp-server',
        'node',
        '/app/dist/mcp-servers/obsidian-notes-server.js'
      ],
      
      // Environment configuration
      env: {
        VAULT_PATH: './vault-data',
        LOG_LEVEL: 'info',
        NODE_ENV: 'production'
      },
      
      // Server health configuration
      health: {
        checkInterval: 10000,
        timeout: 5000,
        retries: 5,
        healthEndpoint: 'http://localhost:3000/health'
      },
      
      // Tool definitions that will be exposed to LLM
      tools: [
        {
          name: 'createNote',
          description: 'Create a new note in the Obsidian vault',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the note'
              },
              content: {
                type: 'string',
                description: 'Markdown content of the note'
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags to categorize the note'
              },
              path: {
                type: 'string',
                description: 'Optional folder path within vault (e.g., "project/subdir")'
              }
            },
            required: ['title', 'content']
          }
        },
        {
          name: 'listNotes',
          description: 'List all notes in the vault with metadata',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Optional folder path to list notes from'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of notes to return (default: 50)'
              }
            }
          }
        },
        {
          name: 'updateNote',
          description: 'Update an existing note with new content',
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Filename of the note to update'
              },
              content: {
                type: 'string',
                description: 'New markdown content'
              }
            },
            required: ['filename', 'content']
          }
        },
        {
          name: 'deleteNote',
          description: 'Delete a note from the vault',
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Filename of the note to delete'
              }
            },
            required: ['filename']
          }
        },
        {
          name: 'searchNotes',
          description: 'Search for notes by keyword or content',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query string'
              },
              limit: {
                type: 'number',
                description: 'Maximum results to return (default: 20)'
              }
            },
            required: ['query']
          }
        }
      ]
    }
  ]
};
