#!/usr/bin/env node

/**
 * AIOS Core CLI Entry Point
 *
 * This is the bin entry point declared in package.json.
 * Delegates to the CLI module for command registration and execution.
 *
 * @module bin/aios-core
 */

'use strict';

const { run } = require('../cli/index');

run(process.argv);
