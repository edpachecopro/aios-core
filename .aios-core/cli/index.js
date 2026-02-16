/**
 * AIOS CLI Entry Point
 *
 * Main entry point for the AIOS CLI with Commander.js integration.
 * Registers all subcommands including workers, agents, etc.
 *
 * @module cli
 * @version 1.0.0
 * @story 2.7 - Discovery CLI Search
 */

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');

// Read package.json for version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
let packageVersion = '0.0.0';
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageVersion = packageJson.version;
} catch (error) {
  // Fallback version if package.json not found
}

/**
 * Safely load a command module. Returns null if the module fails to load
 * (e.g., missing transitive dependencies in partial installations).
 */
function safeRequire(modulePath, commandName) {
  try {
    return require(modulePath);
  } catch (error) {
    if (process.env.AIOS_DEBUG) {
      console.error(`Warning: Failed to load "${commandName}" command: ${error.message}`);
    }
    return null;
  }
}

/**
 * Safely add a command to the program.
 */
function safeAddCommand(program, modulePath, commandName, factoryName) {
  const mod = safeRequire(modulePath, commandName);
  if (mod && typeof mod[factoryName] === 'function') {
    program.addCommand(mod[factoryName]());
  }
}

/**
 * Create the main CLI program
 * @returns {Command} Commander program instance
 */
function createProgram() {
  const program = new Command();

  program
    .name('aios-core')
    .version(packageVersion)
    .description('AIOS-FullStack: AI-Orchestrated System for Full Stack Development')
    .addHelpText('after', `
Commands:
  install           Install AIOS framework into current project
  update            Update existing AIOS installation
  sync              Sync .claude/ to .aios-core/claude-config/ (dev only)
  workers           Manage and discover workers
  manifest          Manage manifest files (validate, regenerate)
  qa                Quality Gate Manager (run, status)
  metrics           Quality Gate Metrics (record, show, seed, cleanup)
  config            Manage layered configuration (show, diff, migrate, validate)
  pro               AIOS Pro license management (activate, status, deactivate, features)
  mcp               Manage global MCP configuration
  migrate           Migrate from v2.0 to v4.0.4 structure
  generate          Generate documents from templates (prd, adr, pmdr, etc.)
  info              Show system information
  doctor            Run system diagnostics

For command help:
  $ aios-core <command> --help

Examples:
  $ aios-core install
  $ aios-core install --force
  $ aios-core update
  $ aios-core sync
  $ aios-core workers search "json transformation"
  $ aios-core config show
  $ aios-core doctor
`);

  // Core commands (install/update/sync) — always available
  safeAddCommand(program, './commands/install', 'install', 'createInstallCommand');
  safeAddCommand(program, './commands/update', 'update', 'createUpdateCommand');
  safeAddCommand(program, './commands/sync', 'sync', 'createSyncCommand');

  // Framework commands — gracefully degrade if dependencies missing
  safeAddCommand(program, './commands/workers', 'workers', 'createWorkersCommand');
  safeAddCommand(program, './commands/manifest', 'manifest', 'createManifestCommand');
  safeAddCommand(program, './commands/qa', 'qa', 'createQaCommand');
  safeAddCommand(program, './commands/mcp', 'mcp', 'createMcpCommand');
  safeAddCommand(program, './commands/migrate', 'migrate', 'createMigrateCommand');
  safeAddCommand(program, './commands/generate', 'generate', 'createGenerateCommand');
  safeAddCommand(program, './commands/metrics', 'metrics', 'createMetricsCommand');
  safeAddCommand(program, './commands/config', 'config', 'createConfigCommand');
  safeAddCommand(program, './commands/pro', 'pro', 'createProCommand');

  return program;
}

/**
 * Run the CLI
 * @param {string[]} args - Command line arguments
 * @returns {Promise<void>}
 */
async function run(args = process.argv) {
  const program = createProgram();

  try {
    await program.parseAsync(args);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  createProgram,
  run,
};
