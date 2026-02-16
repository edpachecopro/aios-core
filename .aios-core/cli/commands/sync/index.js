/**
 * Sync Command
 *
 * Synchronizes .claude/ from the current project into .aios-core/claude-config/
 * for distribution. This is a development-only command used in the AIOS hub (mmos/).
 *
 * Usage:
 *   aios-core sync
 *
 * @module cli/commands/sync
 */

'use strict';

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

/**
 * Directories/files to sync from .claude/ to claude-config/
 */
const SYNC_ITEMS = [
  'commands',
  'rules',
  'hooks',
  'CLAUDE.md',
  'settings.json',
];

/**
 * Items that should NEVER be synced (local-only).
 */
const NEVER_SYNC = [
  'settings.local.json',
];

async function syncAction() {
  const cwd = process.cwd();
  const claudeDir = path.join(cwd, '.claude');
  const claudeConfigDir = path.join(cwd, '.aios-core', 'claude-config');

  console.log(chalk.bold('\n  AIOS Sync: .claude/ → .aios-core/claude-config/\n'));

  // 1. Verify .claude/ exists
  if (!fs.existsSync(claudeDir)) {
    console.log(chalk.red('  Error: .claude/ not found in current directory.'));
    console.log(chalk.gray('  Run this from the AIOS hub directory (mmos/).\n'));
    process.exit(1);
  }

  // 2. Verify .aios-core/ exists
  if (!fs.existsSync(path.join(cwd, '.aios-core'))) {
    console.log(chalk.red('  Error: .aios-core/ not found in current directory.'));
    console.log(chalk.gray('  Run this from the AIOS hub directory (mmos/).\n'));
    process.exit(1);
  }

  // 3. Ensure claude-config/ exists
  await fs.ensureDir(claudeConfigDir);

  // 4. Sync each item
  let syncedCount = 0;
  let skippedCount = 0;

  for (const item of SYNC_ITEMS) {
    const src = path.join(claudeDir, item);
    const dest = path.join(claudeConfigDir, item);

    if (!fs.existsSync(src)) {
      console.log(chalk.gray(`  Skip: ${item} (not found)`));
      skippedCount++;
      continue;
    }

    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      // Remove target dir first for clean sync, then copy
      await fs.remove(dest);
      await fs.copy(src, dest, {
        filter: (srcPath) => {
          const basename = path.basename(srcPath);
          return !NEVER_SYNC.includes(basename) && basename !== '.DS_Store';
        },
      });
      // Count items in directory
      const items = await countItems(dest);
      console.log(chalk.green(`  Synced: ${item}/ (${items} items)`));
    } else {
      await fs.copy(src, dest, { overwrite: true });
      console.log(chalk.green(`  Synced: ${item}`));
    }
    syncedCount++;
  }

  // 5. Verify NEVER_SYNC items are NOT in target
  for (const item of NEVER_SYNC) {
    const forbidden = path.join(claudeConfigDir, item);
    if (fs.existsSync(forbidden)) {
      await fs.remove(forbidden);
      console.log(chalk.yellow(`  Removed: ${item} (local-only, should not be distributed)`));
    }
  }

  // 6. Summary
  console.log(chalk.bold.green(`\n  Sync complete: ${syncedCount} synced, ${skippedCount} skipped.\n`));
  console.log(chalk.gray('  The .aios-core/claude-config/ directory is ready for distribution.'));
  console.log(chalk.gray('  Commit and push to make it available to other projects.\n'));
}

/**
 * Recursively count files in a directory.
 */
async function countItems(dir) {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += await countItems(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

function createSyncCommand() {
  const cmd = new Command('sync')
    .description('Sync .claude/ into .aios-core/claude-config/ for distribution (dev only)')
    .action(syncAction);

  return cmd;
}

module.exports = { createSyncCommand };
