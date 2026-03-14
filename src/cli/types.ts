/**
 * CLI Type definitions for AFR scaffolding
 */

export interface ScaffoldOptions {
  projectName: string;
  projectPath: string;
  agentsDir: string;
  useTypeScript: boolean;
  includeExamples: boolean;
  template?: 'basic' | 'advanced' | 'custom';
}

export interface AgentStubOptions {
  agentName: string;
  agentPath: string;
  description?: string;
  hasChildren?: boolean;
  model?: string;
}

export interface TemplateContext {
  projectName: string;
  timestamp: string;
  version: string;
  author?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'typescript' | 'javascript' | 'json' | 'markdown';
}

export interface ScaffoldResult {
  projectPath: string;
  filesCreated: string[];
  success: boolean;
  message: string;
}
