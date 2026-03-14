/**
 * Project scaffolder for AFR-based agent systems
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import {
  ScaffoldOptions,
  ScaffoldResult,
  TemplateContext,
  AgentStubOptions,
  GeneratedFile,
} from './types.js';
import {
  generatePackageJsonTemplate,
  generateTsConfigTemplate,
  generateRootAgentTemplate,
  generateChildAgentTemplate,
  generateConfigTemplate,
  generateDemoTemplate,
  generateReadmeTemplate,
  generateGitIgnoreTemplate,
} from './templates.js';

export class AfrScaffolder {
  /**
   * Scaffold a new AFR project
   */
  async scaffoldProject(options: ScaffoldOptions): Promise<ScaffoldResult> {
    const { projectName, projectPath, agentsDir, useTypeScript, includeExamples, template } =
      options;

    const context: TemplateContext = {
      projectName,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };

    const filesCreated: string[] = [];
    const filesToCreate: GeneratedFile[] = [];

    try {
      // Core config files
      filesToCreate.push(generatePackageJsonTemplate(context));
      filesToCreate.push(generateTsConfigTemplate());
      filesToCreate.push(generateReadmeTemplate(projectName));
      filesToCreate.push(generateGitIgnoreTemplate());

      // Agent templates
      filesToCreate.push(generateRootAgentTemplate(projectName));

      // Add example agents if requested
      if (includeExamples) {
        filesToCreate.push(generateChildAgentTemplate('research', 'Handle research tasks'));
        filesToCreate.push(generateChildAgentTemplate('writing', 'Handle writing tasks'));
        filesToCreate.push(generateChildAgentTemplate('analysis', 'Handle data analysis tasks'));

        // Configs for examples
        filesToCreate.push(generateConfigTemplate('research'));
        filesToCreate.push(generateConfigTemplate('writing'));
        filesToCreate.push(generateConfigTemplate('analysis'));
      }

      // Demo file
      filesToCreate.push(generateDemoTemplate(projectName));

      // Write all files
      for (const file of filesToCreate) {
        const filePath = join(projectPath, file.path);
        await this.ensureDirectoryExists(dirname(filePath));
        await writeFile(filePath, file.content, 'utf-8');
        filesCreated.push(file.path);
      }

      return {
        projectPath,
        filesCreated,
        success: true,
        message: `✓ Project ${projectName} scaffolded successfully!`,
      };
    } catch (error) {
      return {
        projectPath,
        filesCreated,
        success: false,
        message: `✗ Failed to scaffold project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Generate a new agent stub in an existing project
   */
  async generateAgentStub(projectPath: string, options: AgentStubOptions): Promise<string[]> {
    const filesCreated: string[] = [];
    const agentPath = join(projectPath, 'src', 'agents', options.agentPath.replace(/\./g, '/'));

    try {
      await this.ensureDirectoryExists(agentPath);

      // Generate agent file
      const agentFile = generateChildAgentTemplate(
        options.agentPath,
        options.description || `Agent: ${options.agentName}`,
        options.hasChildren
      );

      await writeFile(join(agentPath, 'index.ts'), agentFile.content, 'utf-8');
      filesCreated.push(`src/agents/${options.agentPath.replace(/\./g, '/')}/index.ts`);

      // Generate config file
      const configFile = generateConfigTemplate(options.agentPath);
      await writeFile(join(agentPath, 'config.json'), configFile.content, 'utf-8');
      filesCreated.push(`src/agents/${options.agentPath.replace(/\./g, '/')}/config.json`);

      return filesCreated;
    } catch (error) {
      throw new Error(`Failed to generate agent stub: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure directory exists, creating it if needed
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        return;
      }
      throw error;
    }
  }
}

export async function createProject(projectName: string, targetPath: string): Promise<void> {
  const scaffolder = new AfrScaffolder();

  const result = await scaffolder.scaffoldProject({
    projectName,
    projectPath: targetPath,
    agentsDir: 'agents',
    useTypeScript: true,
    includeExamples: true,
    template: 'basic',
  });

  console.log(result.message);

  if (result.success) {
    console.log(`\nCreated files:`);
    result.filesCreated.forEach((file) => {
      console.log(`  - ${file}`);
    });

    console.log(`\nNext steps:`);
    console.log(`  cd ${targetPath}`);
    console.log(`  npm install`);
    console.log(`  npm run build`);
    console.log(`  npm run start:demo`);
  } else {
    process.exit(1);
  }
}
