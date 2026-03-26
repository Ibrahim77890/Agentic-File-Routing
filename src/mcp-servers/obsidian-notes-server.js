/**
 * Obsidian Notes MCP Server Implementation
 * 
 * A Model Context Protocol server that provides note CRUD operations
 * This server is designed to run in a Docker container and communicate
 * with AFR agents via the MCP standard interface.
 * 
 * Tools Provided:
 * - createNote: Create new markdown notes
 * - listNotes: List notes in vault with metadata
 * - updateNote: Update existing notes
 * - deleteNote: Delete notes
 * - searchNotes: Full-text search across vault
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

class ObsidianNotesServer {
  constructor(vaultPath = '/data/vault') {
    this.vaultPath = vaultPath;
    this.port = process.env.MCP_SERVER_PORT || 3000;
    
    // Ensure vault directory exists
    if (!fs.existsSync(this.vaultPath)) {
      fs.mkdirSync(this.vaultPath, { recursive: true });
    }
    
    console.log(`[ObsidianNotesServer] Initialized with vault at: ${this.vaultPath}`);
  }

  /**
   * Create a new note in the vault
   */
  createNote(params) {
    try {
      const { title, content, tags = [], path: folderPath = '' } = params;
      
      if (!title || !content) {
        return {
          success: false,
          error: 'Missing required fields: title and content'
        };
      }

      // Create folder if specified
      const folder = folderPath ? path.join(this.vaultPath, folderPath) : this.vaultPath;
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }

      // Generate filename from title
      const filename = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
      const filepath = path.join(folder, filename);

      // Prepare frontmatter
      const frontmatter = [
        '---',
        `title: ${title}`,
        `created: ${new Date().toISOString()}`,
        `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
        '---',
        ''
      ].join('\n');

      // Write file
      const fullContent = frontmatter + content;
      fs.writeFileSync(filepath, fullContent, 'utf8');

      console.log(`[createNote] Created: ${filepath}`);
      
      return {
        success: true,
        filename,
        filepath: path.relative(this.vaultPath, filepath),
        size: Buffer.byteLength(fullContent, 'utf8'),
        created: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all notes in the vault
   */
  listNotes(params) {
    try {
      const { path: folderPath = '', limit = 50 } = params;
      const folder = folderPath ? path.join(this.vaultPath, folderPath) : this.vaultPath;

      if (!fs.existsSync(folder)) {
        return {
          success: false,
          error: 'Folder not found'
        };
      }

      const notes = [];
      const walkDir = (dir, relPath = '') => {
        if (notes.length >= limit) return;

        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (notes.length >= limit) break;

          const filepath = path.join(dir, file);
          const stat = fs.statSync(filepath);
          const rel = path.join(relPath, file).replace(/\\/g, '/');

          if (stat.isDirectory()) {
            walkDir(filepath, rel);
          } else if (file.endsWith('.md')) {
            const content = fs.readFileSync(filepath, 'utf8');
            notes.push({
              filename: file,
              path: rel,
              size: stat.size,
              created: stat.birthtime.toISOString(),
              modified: stat.mtime.toISOString(),
              preview: content.substring(0, 200)
            });
          }
        }
      };

      walkDir(folder);

      return {
        success: true,
        count: notes.length,
        notes,
        limit
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update an existing note
   */
  updateNote(params) {
    try {
      const { filename, content } = params;

      if (!filename || !content) {
        return {
          success: false,
          error: 'Missing required fields: filename and content'
        };
      }

      // Find the file
      let filepath = path.join(this.vaultPath, filename);
      
      if (!fs.existsSync(filepath)) {
        // Try searching recursively
        const found = this.findFile(this.vaultPath, filename);
        if (!found) {
          return {
            success: false,
            error: `File not found: ${filename}`
          };
        }
        filepath = found;
      }

      // Preserve frontmatter, update content
      let fileContent = fs.readFileSync(filepath, 'utf8');
      const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n/);
      
      const frontmatter = frontmatterMatch 
        ? frontmatterMatch[0] 
        : `---\nlastModified: ${new Date().toISOString()}\n---\n`;

      const newContent = frontmatter + content;
      fs.writeFileSync(filepath, newContent, 'utf8');

      console.log(`[updateNote] Updated: ${filepath}`);

      return {
        success: true,
        filename,
        filepath: path.relative(this.vaultPath, filepath),
        size: Buffer.byteLength(newContent, 'utf8'),
        modified: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a note from the vault
   */
  deleteNote(params) {
    try {
      const { filename } = params;

      if (!filename) {
        return {
          success: false,
          error: 'Missing required field: filename'
        };
      }

      let filepath = path.join(this.vaultPath, filename);
      
      if (!fs.existsSync(filepath)) {
        const found = this.findFile(this.vaultPath, filename);
        if (!found) {
          return {
            success: false,
            error: `File not found: ${filename}`
          };
        }
        filepath = found;
      }

      fs.unlinkSync(filepath);
      console.log(`[deleteNote] Deleted: ${filepath}`);

      return {
        success: true,
        filename,
        deleted: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search for notes by keyword
   */
  searchNotes(params) {
    try {
      const { query = '', limit = 20 } = params;

      if (!query) {
        return {
          success: false,
          error: 'Missing required field: query'
        };
      }

      const results = [];
      const searchQuery = query.toLowerCase();

      const walkDir = (dir) => {
        if (results.length >= limit) return;

        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (results.length >= limit) break;

          const filepath = path.join(dir, file);
          const stat = fs.statSync(filepath);

          if (stat.isDirectory()) {
            walkDir(filepath);
          } else if (file.endsWith('.md')) {
            const content = fs.readFileSync(filepath, 'utf8');
            if (content.toLowerCase().includes(searchQuery)) {
              results.push({
                filename: file,
                path: path.relative(this.vaultPath, filepath),
                matchCount: (content.match(new RegExp(searchQuery, 'gi')) || []).length,
                preview: this.getMatchContext(content, searchQuery)
              });
            }
          }
        }
      };

      walkDir(this.vaultPath);

      return {
        success: true,
        query,
        count: results.length,
        results,
        limit
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Find file recursively
   */
  findFile(dir, filename) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filepath = path.join(dir, file);
      if (file === filename) return filepath;
      
      const stat = fs.statSync(filepath);
      if (stat.isDirectory()) {
        const found = this.findFile(filepath, filename);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Helper: Get context around search match
   */
  getMatchContext(content, query, contextLength = 100) {
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return content.substring(0, contextLength);
    
    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + contextLength);
    return `...${content.substring(start, end)}...`;
  }

  /**
   * Start the HTTP server
   */
  start() {
    const server = http.createServer((req, res) => {
      // Parse URL
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const pathname = parsedUrl.pathname;

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check endpoint
      if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          service: 'obsidian-notes-mcp-server',
          uptime: process.uptime()
        }));
        return;
      }

      // Tool execution endpoint
      if (pathname === '/execute-tool' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { tool, params } = JSON.parse(body);

            let result;
            switch (tool) {
              case 'createNote':
                result = this.createNote(params);
                break;
              case 'listNotes':
                result = this.listNotes(params);
                break;
              case 'updateNote':
                result = this.updateNote(params);
                break;
              case 'deleteNote':
                result = this.deleteNote(params);
                break;
              case 'searchNotes':
                result = this.searchNotes(params);
                break;
              default:
                result = { success: false, error: `Unknown tool: ${tool}` };
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: error.message
            }));
          }
        });
        return;
      }

      // List available tools endpoint
      if (pathname === '/tools' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          tools: [
            'createNote',
            'listNotes',
            'updateNote',
            'deleteNote',
            'searchNotes'
          ]
        }));
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Not found',
        path: pathname
      }));
    });

    server.listen(this.port, '0.0.0.0', () => {
      console.log(`🚀 Obsidian Notes MCP Server listening on http://0.0.0.0:${this.port}`);
      console.log(`📁 Vault location: ${this.vaultPath}`);
      console.log(`📝 Available endpoints:`);
      console.log(`   GET  /health         - Server health check`);
      console.log(`   POST /execute-tool   - Execute a tool (createNote, listNotes, etc.)`);
      console.log(`   GET  /tools          - List available tools`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  }
}

// Start the server
const server = new ObsidianNotesServer();
server.start();
