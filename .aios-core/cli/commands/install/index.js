/**
 * Install Command
 *
 * Installs AIOS framework into the current project directory.
 * Copies .aios-core/ and .claude/ (from claude-config/) to the target project.
 *
 * Usage:
 *   aios-core install [--force] [--skip-deps]
 *
 * @module cli/commands/install
 */

'use strict';

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const yaml = require('js-yaml');

/**
 * Resolve the AIOS package root (where .aios-core/ lives as a package).
 * This is the directory containing package.json, two levels up from cli/commands/install/.
 */
function getPackageRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

/**
 * Get the version from package.json
 */
function getPackageVersion() {
  const pkgPath = path.join(getPackageRoot(), 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Items to exclude when copying .aios-core/ to target project.
 */
const COPY_EXCLUDE = [
  'node_modules',
  '.DS_Store',
  'claude-config',
  'package-lock.json',
];

/**
 * Install action handler
 */
async function installAction(options) {
  const cwd = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getPackageVersion();

  console.log(chalk.bold('\n  AIOS Core Installer'));
  console.log(chalk.gray(`  Version: ${version}\n`));

  // 1. Check if already installed
  const targetAiosCore = path.join(cwd, '.aios-core');
  if (fs.existsSync(targetAiosCore) && !options.force) {
    console.log(chalk.red('  Error: .aios-core/ already exists in this directory.'));
    console.log(chalk.gray('  Use --force to overwrite.\n'));
    process.exit(1);
  }

  // 2. Check if running from within the package itself
  if (path.resolve(cwd) === path.resolve(packageRoot) ||
      path.resolve(cwd) === path.resolve(packageRoot, '..')) {
    console.log(chalk.red('  Error: Cannot install into the AIOS source directory.'));
    console.log(chalk.gray('  Run this command from your target project directory.\n'));
    process.exit(1);
  }

  // 3. Copy .aios-core/ to target (excluding node_modules, claude-config, etc.)
  console.log(chalk.cyan('  Copying .aios-core/ framework...'));
  await fs.copy(packageRoot, targetAiosCore, {
    filter: (src) => {
      const relative = path.relative(packageRoot, src);
      if (!relative) return true; // root dir itself
      const topLevel = relative.split(path.sep)[0];
      return !COPY_EXCLUDE.includes(topLevel);
    },
    overwrite: options.force || false,
  });
  console.log(chalk.green('    Done.'));

  // 4. Copy claude-config/ → .claude/
  const claudeConfigSrc = path.join(packageRoot, 'claude-config');
  const claudeTarget = path.join(cwd, '.claude');

  if (fs.existsSync(claudeConfigSrc)) {
    console.log(chalk.cyan('  Setting up .claude/ configuration...'));

    if (!fs.existsSync(claudeTarget)) {
      // Fresh install: copy everything
      await fs.copy(claudeConfigSrc, claudeTarget);
      console.log(chalk.green('    Created .claude/ directory.'));
    } else if (options.force) {
      // Force: overwrite
      await fs.copy(claudeConfigSrc, claudeTarget, { overwrite: true });
      console.log(chalk.green('    Overwrote .claude/ directory.'));
    } else {
      // Merge: copy new files, don't overwrite existing
      await fs.copy(claudeConfigSrc, claudeTarget, { overwrite: false, errorOnExist: false });
      console.log(chalk.green('    Merged into existing .claude/ (no overwrites).'));
    }
  } else {
    console.log(chalk.yellow('  Warning: claude-config/ not found in package.'));
    console.log(chalk.gray('  Run "aios-core sync" in the hub to generate it first.\n'));
  }

  // 5. Install dependencies
  if (!options.skipDeps) {
    console.log(chalk.cyan('  Installing dependencies...'));
    try {
      const { execSync } = require('child_process');
      execSync('npm install --production', {
        cwd: targetAiosCore,
        stdio: 'pipe',
      });
      console.log(chalk.green('    Done.'));
    } catch (error) {
      console.log(chalk.yellow(`    Warning: npm install failed: ${error.message}`));
      console.log(chalk.gray('    You may need to run "npm install" manually in .aios-core/\n'));
    }
  } else {
    console.log(chalk.gray('  Skipping dependency install (--skip-deps).'));
  }

  // 6. Generate install manifest
  const manifest = {
    installed_at: new Date().toISOString(),
    version,
    source: packageRoot,
    force: options.force || false,
    skip_deps: options.skipDeps || false,
  };

  const manifestPath = path.join(targetAiosCore, 'install-manifest.yaml');
  fs.writeFileSync(manifestPath, yaml.dump(manifest, { lineWidth: 120 }));

  // 7. Summary
  console.log(chalk.bold.green('\n  Installation complete!\n'));
  console.log('  Installed:');
  console.log(chalk.gray(`    .aios-core/  (framework v${version})`));
  if (fs.existsSync(claudeTarget)) {
    console.log(chalk.gray('    .claude/     (Claude Code configuration)'));
  }
  console.log(chalk.gray(`    install-manifest.yaml`));
  console.log('');
  console.log('  Next steps:');
  console.log(chalk.gray('    1. Review .claude/CLAUDE.md and customize for your project'));
  console.log(chalk.gray('    2. Add .claude/settings.local.json to .gitignore'));
  console.log(chalk.gray('    3. Run "aios-core doctor" to verify installation'));
  console.log('');
}

/**
 * Create the `aios-core install` command.
 * @returns {Command}
 */
function createInstallCommand() {
  const cmd = new Command('install')
    .description('Install AIOS framework into the current project')
    .option('-f, --force', 'Overwrite existing installation')
    .option('--skip-deps', 'Skip npm install in .aios-core/')
    .action(installAction);

  return cmd;
}

module.exports = { createInstallCommand };
