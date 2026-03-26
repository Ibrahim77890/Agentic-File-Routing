# Obsidian Vault Configuration

This directory contains configuration for the Obsidian MCP server vault.

## Structure

```
vault-config/
├── settings.json       # Vault settings
├── templates/          # Note templates
└── README.md           # Vault documentation
```

## Quick Start

1. **Start the MCP Server**:
   ```bash
   docker-compose up -d
   ```

2. **Verify Server Health**:
   ```bash
   curl http://localhost:3000/health
   ```

3. **List Available Tools**:
   ```bash
   curl http://localhost:3000/tools
   ```

4. **Create a Note** (directly via HTTP):
   ```bash
   curl -X POST http://localhost:3000/execute-tool \
     -H "Content-Type: application/json" \
     -d '{
       "tool": "createNote",
       "params": {
         "title": "Test Note",
         "content": "# Hello World\n\nThis is a test note.",
         "tags": ["test"]
       }
     }'
   ```

## Integration with AFR Agents

The Knowledge agent automatically discovers the Obsidian MCP server through:
1. `/examples/agents/knowledge/mcp_tools.ts` configuration
2. MCPConfigLoader reads this configuration during registry initialization
3. Tools are injected into the agent's system prompt
4. Agent can delegate note operations to MCP server

## Supported Tools

- **createNote**: Create new markdown notes
- **listNotes**: List notes in vault
- **updateNote**: Update existing notes
- **deleteNote**: Remove notes
- **searchNotes**: Full-text search

See `/examples/agents/knowledge/mcp_tools.ts` for complete tool definitions.
