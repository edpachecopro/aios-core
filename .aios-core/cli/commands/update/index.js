/**
 * Update Command
 *
 * Updates an existing AIOS installation, preserving local configurations.
 *
 * Usage:
 *   aios-core update [--force]
 *
 * @module cli/commands/update
 */

'use strict';

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const yaml = require('js-yaml');

function getPackageRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

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
 * Files to preserve during update (local configs that should not be overwritten).
 */
const LOCAL_CONFIGS = [
  'core-config.yaml',
  'local-config.yaml',
  'install-manifest.yaml',
];

/**
 * Items to exclude when copying .aios-core/ to target.
 */
const COPY_EXCLUDE = [
  'node_modules',
  '.DS_Store',
  'claude-config',
  'package-lock.json',
];

async function updateAction(options) {
  const cwd = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getPackageVersion();
  const targetAiosCore = path.join(cwd, '.aios-core');

  console.log(chalk.bold('\n  AIOS Core Updater'));
  console.log(chalk.gray(`  Version: ${version}\n`));

  // 1. Verify existing installation
  if (!fs.existsSync(targetAiosCore)) {
    console.log(chalk.red('  Error: No .aios-core/ found in this directory.'));
    console.log(chalk.gray('  Run "aios-core install" first.\n'));
    process.exit(1);
  }

  // 2. Read current manifest
  const manifestPath = path.join(targetAiosCore, 'install-manifest.yaml');
  let currentVersion = 'unknown';
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8'));
      currentVersion = manifest.version || 'unknown';
    } catch {
      // ignore
    }
  }

  console.log(chalk.gray(`  Current version: ${currentVersion}`));
  console.log(chalk.gray(`  New version:     ${version}\n`));

  // 3. Backup local configs
  const backups = {};
  console.log(chalk.cyan('  Backing up local configs...'));
  for (const configFile of LOCAL_CONFIGS) {
    const configPath = path.join(targetAiosCore, configFile);
    if (fs.existsSync(configPath)) {
      backups[configFile] = fs.readFileSync(configPath, 'utf8');
      console.log(chalk.gray(`    Backed up: ${configFile}`));
    }
  }

  // Also backup .claude/CLAUDE.md if it was customized
  const claudeMdPath = path.join(cwd, '.claude', 'CLAUDE.md');
  let claudeMdBackup = null;
  if (fs.existsSync(claudeMdPath)) {
    claudeMdBackup = fs.readFileSync(claudeMdPath, 'utf8');
  }

  // Also backup .claude/settings.local.json
  const settingsLocalPath = path.join(cwd, '.claude', 'settings.local.json');
  let settingsLocalBackup = null;
  if (fs.existsSync(settingsLocalPath)) {
    settingsLocalBackup = fs.readFileSync(settingsLocalPath, 'utf8');
  }

  // 4. Update .aios-core/ framework files
  console.log(chalk.cyan('  Updating .aios-core/ framework...'));
  await fs.copy(packageRoot, targetAiosCore, {
    filter: (src) => {
      const relative = path.relative(packageRoot, src);
      if (!relative) return true;
      const topLevel = relative.split(path.sep)[0];
      if (COPY_EXCLUDE.includes(topLevel)) return false;
      // Don't overwrite local configs unless --force
      if (!options.force && LOCAL_CONFIGS.includes(relative)) return false;
      return true;
    },
    overwrite: true,
  });
  console.log(chalk.green('    Done.'));

  // 5. Update .claude/ (commands and rules replaced, CLAUDE.md preserved)
  const claudeConfigSrc = path.join(packageRoot, 'claude-config');
  const claudeTarget = path.join(cwd, '.claude');

  if (fs.existsSync(claudeConfigSrc)) {
    console.log(chalk.cyan('  Updating .claude/ configuration...'));

    // Replace commands/ and rules/ entirely
    const commandsSrc = path.join(claudeConfigSrc, 'commands');
    const rulesSrc = path.join(claudeConfigSrc, 'rules');
    const hooksSrc = path.join(claudeConfigSrc, 'hooks');

    if (fs.existsSync(commandsSrc)) {
      await fs.remove(path.join(claudeTarget, 'commands'));
      await fs.copy(commandsSrc, path.join(claudeTarget, 'commands'));
      console.log(chalk.gray('    Updated: commands/'));
    }

    if (fs.existsSync(rulesSrc)) {
      await fs.remove(path.join(claudeTarget, 'rules'));
      await fs.copy(rulesSrc, path.join(claudeTarget, 'rules'));
      console.log(chalk.gray('    Updated: rules/'));
    }

    if (fs.existsSync(hooksSrc)) {
      await fs.remove(path.join(claudeTarget, 'hooks'));
      await fs.copy(hooksSrc, path.join(claudeTarget, 'hooks'));
      console.log(chalk.gray('    Updated: hooks/'));
    }

    // Update settings.json (base settings)
    const settingsSrc = path.join(claudeConfigSrc, 'settings.json');
    if (fs.existsSync(settingsSrc)) {
      await fs.copy(settingsSrc, path.join(claudeTarget, 'settings.json'), { overwrite: true });
      console.log(chalk.gray('    Updated: settings.json'));
    }

    // CLAUDE.md: only update if not customized or --force
    const claudeMdSrc = path.join(claudeConfigSrc, 'CLAUDE.md');
    if (fs.existsSync(claudeMdSrc)) {
      const templateContent = fs.readFileSync(claudeMdSrc, 'utf8');
      if (!claudeMdBackup || claudeMdBackup === templateContent || options.force) {
        await fs.copy(claudeMdSrc, claudeMdPath, { overwrite: true });
        console.log(chalk.gray('    Updated: CLAUDE.md'));
      } else {
        console.log(chalk.gray('    Preserved: CLAUDE.md (customized)'));
      }
    }

    console.log(chalk.green('    Done.'));
  }

  // 6. Restore local configs
  console.log(chalk.cyan('  Restoring local configs...'));
  for (const [configFile, content] of Object.entries(backups)) {
    const configPath = path.join(targetAiosCore, configFile);
    fs.writeFileSync(configPath, content);
    console.log(chalk.gray(`    Restored: ${configFile}`));
  }

  // Restore settings.local.json
  if (settingsLocalBackup) {
    fs.writeFileSync(settingsLocalPath, settingsLocalBackup);
    console.log(chalk.gray('    Restored: settings.local.json'));
  }

  // 7. Update manifest
  const manifest = {
    installed_at: backups['install-manifest.yaml']
      ? yaml.load(backups['install-manifest.yaml']).installed_at
      : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version,
    previous_version: currentVersion,
    source: packageRoot,
  };

  fs.writeFileSync(manifestPath, yaml.dump(manifest, { lineWidth: 120 }));

  // 8. Summary
  console.log(chalk.bold.green('\n  Update complete!\n'));
  console.log(chalk.gray(`  ${currentVersion} → ${version}`));
  console.log('');
}

function createUpdateCommand() {
  const cmd = new Command('update')
    .description('Update existing AIOS installation preserving local configs')
    .option('-f, --force', 'Force overwrite all files including local configs')
    .action(updateAction);

  return cmd;
}

module.exports = { createUpdateCommand };
